// License: The GPL version 3, or LGPL version 3 (Dual License).
import { PrismaPg } from '@prisma/adapter-pg';
import type { Keyset } from '../../common/cursor.js';
import { PrismaClient, type Prisma } from '../../generated/prisma/client.js';
import type {
  ApprovalRepository,
  AttachmentRecord,
  AttachmentRepository,
  AuditRecord,
  AuditRepository,
  OutboxRow,
  OutboxWriter,
  Persistence,
  Repositories,
  RequestRepository,
  TransactionRepositories,
} from '../../capabilities/shared/ports.js';
import type { RequestRecord } from '../../capabilities/requests/domain/request.js';

type Db = Prisma.TransactionClient;
type RequestRow = Awaited<ReturnType<Db['request']['findUniqueOrThrow']>>;

function toRequest(row: RequestRow): RequestRecord {
  return {
    id: row.id,
    requesterId: row.requesterId,
    requesterEmail: row.requesterEmail,
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Keyset predicate for ORDER BY <field> <direction>, id ASC, after the given position. */
function keysetAfter<F extends string>(
  field: F,
  direction: 'asc' | 'desc',
  after: Keyset | undefined,
): Record<string, unknown> {
  if (after === undefined) return {};
  const beyond = { [field]: direction === 'asc' ? { gt: after.at } : { lt: after.at } };
  return { OR: [beyond, { [field]: after.at, id: { gt: after.id } }] };
}

function requestRepository(db: Db): RequestRepository {
  return {
    async findById(id) {
      const row = await db.request.findUnique({ where: { id } });
      return row === null ? null : toRequest(row);
    },
    async insert(request) {
      await db.request.create({ data: { ...request } });
    },
    async update(request) {
      await db.request.update({
        where: { id: request.id },
        data: {
          title: request.title,
          description: request.description,
          status: request.status,
          version: request.version,
          updatedAt: request.updatedAt,
        },
      });
    },
    async list({ ownerId, after, limit }) {
      const rows = await db.request.findMany({
        where: {
          ...(ownerId === undefined ? {} : { requesterId: ownerId }),
          ...keysetAfter('updatedAt', 'desc', after),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
      });
      return rows.map(toRequest);
    },
    async listSubmitted({ after, limit }) {
      const rows = await db.request.findMany({
        where: { status: 'SUBMITTED', ...keysetAfter('updatedAt', 'asc', after) },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      });
      return rows.map(toRequest);
    },
  };
}

function approvalRepository(db: Db): ApprovalRepository {
  return {
    async insert(approval) {
      await db.approval.create({ data: { ...approval } });
    },
  };
}

function attachmentRepository(db: Db): AttachmentRepository {
  return {
    async insert(attachment) {
      await db.attachment.create({ data: { ...attachment } });
    },
    async findById(id) {
      return db.attachment.findUnique({ where: { id } });
    },
    async listByRequest({ requestId, after, limit }): Promise<AttachmentRecord[]> {
      return db.attachment.findMany({
        where: { requestId, ...keysetAfter('createdAt', 'asc', after) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
      });
    },
  };
}

function auditRepository(db: Db): AuditRepository {
  return {
    async insert(event) {
      await db.auditEvent.create({
        data: {
          id: event.id,
          requestId: event.requestId,
          eventType: event.eventType,
          actorId: event.actorId,
          fromState: event.fromState,
          toState: event.toState,
          details: (event.details ?? undefined) as Prisma.InputJsonValue | undefined,
          occurredAt: event.occurredAt,
        },
      });
    },
    async list({ requestId, after, limit }) {
      const rows = await db.auditEvent.findMany({
        where: {
          ...(requestId === undefined ? {} : { requestId }),
          ...keysetAfter('occurredAt', 'desc', after),
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        take: limit,
      });
      return rows.map((row): AuditRecord => ({
        id: row.id,
        requestId: row.requestId,
        eventType: row.eventType,
        actorId: row.actorId,
        fromState: row.fromState,
        toState: row.toState,
        details: (row.details ?? null) as Record<string, unknown> | null,
        occurredAt: row.occurredAt,
      }));
    },
  };
}

function outboxWriter(db: Db): OutboxWriter {
  return {
    async insertMany(rows: OutboxRow[]) {
      await db.outboxDelivery.createMany({
        data: rows.map((row) => ({ ...row, payload: row.payload as Prisma.InputJsonValue })),
      });
    },
  };
}

export function createRepositories(db: Db): Repositories {
  return {
    requests: requestRepository(db),
    approvals: approvalRepository(db),
    attachments: attachmentRepository(db),
    audit: auditRepository(db),
    outbox: outboxWriter(db),
  };
}

export class PrismaPersistence implements Persistence {
  readonly client: PrismaClient;
  readonly repositories: Repositories;

  constructor(databaseUrl: string) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    this.repositories = createRepositories(this.client as unknown as Db);
  }

  async transaction<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T> {
    return this.client.$transaction(
      async (db) => {
        const repositories = createRepositories(db);
        return work({
          ...repositories,
          // Parameterized row lock; the request is then read through the same transaction.
          lockRequest: async (id) => {
            await db.$queryRaw`SELECT id FROM requests WHERE id = ${id}::uuid FOR UPDATE`;
            return repositories.requests.findById(id);
          },
        });
      },
      { isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 30_000 },
    );
  }

  async isReady(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
  }
}
