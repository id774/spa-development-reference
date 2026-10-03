// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { Keyset } from '../../src/common/cursor.js';
import type { RequestRecord } from '../../src/capabilities/requests/domain/request.js';
import type {
  ApprovalRecord,
  AttachmentRecord,
  AuditRecord,
  OutboxRow,
  Persistence,
  Repositories,
  TransactionRepositories,
} from '../../src/capabilities/shared/ports.js';

interface State {
  requests: Map<string, RequestRecord>;
  approvals: Map<string, ApprovalRecord>;
  attachments: Map<string, AttachmentRecord>;
  audit: AuditRecord[];
  outbox: OutboxRow[];
}

function emptyState(): State {
  return {
    requests: new Map(),
    approvals: new Map(),
    attachments: new Map(),
    audit: [],
    outbox: [],
  };
}

function cloneState(state: State): State {
  return {
    requests: new Map([...state.requests].map(([k, v]) => [k, { ...v }])),
    approvals: new Map([...state.approvals].map(([k, v]) => [k, { ...v }])),
    attachments: new Map([...state.attachments].map(([k, v]) => [k, { ...v }])),
    audit: state.audit.map((e) => ({ ...e })),
    outbox: state.outbox.map((r) => ({ ...r })),
  };
}

function after(at: Date, id: string, position: Keyset | undefined, direction: 'asc' | 'desc') {
  if (position === undefined) return true;
  const t = at.getTime();
  const p = position.at.getTime();
  const beyond = direction === 'asc' ? t > p : t < p;
  return beyond || (t === p && id > position.id);
}

function sorted<T>(rows: T[], at: (r: T) => Date, id: (r: T) => string, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      sign * (at(a).getTime() - at(b).getTime()) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0),
  );
}

function repositories(state: State): Repositories {
  return {
    requests: {
      async findById(id) {
        const found = state.requests.get(id);
        return found ? { ...found } : null;
      },
      async insert(request) {
        state.requests.set(request.id, { ...request });
      },
      async update(request) {
        state.requests.set(request.id, { ...request });
      },
      async list({ ownerId, after: position, limit }) {
        const rows = [...state.requests.values()].filter(
          (r) =>
            (ownerId === undefined || r.requesterId === ownerId) &&
            after(r.updatedAt, r.id, position, 'desc'),
        );
        return sorted(
          rows,
          (r) => r.updatedAt,
          (r) => r.id,
          'desc',
        ).slice(0, limit);
      },
      async listSubmitted({ after: position, limit }) {
        const rows = [...state.requests.values()].filter(
          (r) => r.status === 'SUBMITTED' && after(r.updatedAt, r.id, position, 'asc'),
        );
        return sorted(
          rows,
          (r) => r.updatedAt,
          (r) => r.id,
          'asc',
        ).slice(0, limit);
      },
    },
    approvals: {
      async insert(approval) {
        for (const existing of state.approvals.values()) {
          if (existing.requestId === approval.requestId) throw new Error('unique violation');
        }
        state.approvals.set(approval.id, { ...approval });
      },
    },
    attachments: {
      async insert(attachment) {
        state.attachments.set(attachment.id, { ...attachment });
      },
      async findById(id) {
        const found = state.attachments.get(id);
        return found ? { ...found } : null;
      },
      async listByRequest({ requestId, after: position, limit }) {
        const rows = [...state.attachments.values()].filter(
          (a) => a.requestId === requestId && after(a.createdAt, a.id, position, 'asc'),
        );
        return sorted(
          rows,
          (a) => a.createdAt,
          (a) => a.id,
          'asc',
        ).slice(0, limit);
      },
    },
    audit: {
      async insert(event) {
        state.audit.push({ ...event });
      },
      async list({ requestId, after: position, limit }) {
        const rows = state.audit.filter(
          (e) =>
            (requestId === undefined || e.requestId === requestId) &&
            after(e.occurredAt, e.id, position, 'desc'),
        );
        return sorted(
          rows,
          (e) => e.occurredAt,
          (e) => e.id,
          'desc',
        ).slice(0, limit);
      },
    },
    outbox: {
      async insertMany(rows) {
        state.outbox.push(...rows.map((r) => ({ ...r })));
      },
    },
  };
}

/**
 * A test double of the Persistence port. Transactions are serialized (like row
 * locks) and are atomic: a failing transaction leaves no trace.
 */
export class InMemoryPersistence implements Persistence {
  private state = emptyState();
  private queue: Promise<unknown> = Promise.resolve();
  /** Optional failure injection, called when a transaction is about to commit. */
  failOnCommit: (() => Error | undefined) | undefined;

  get repositories(): Repositories {
    return repositories(this.state);
  }

  get snapshot(): Readonly<State> {
    return this.state;
  }

  transaction<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const working = cloneState(this.state);
      const repos = repositories(working);
      const result = await work({
        ...repos,
        lockRequest: (id) => repos.requests.findById(id),
      });
      const failure = this.failOnCommit?.();
      if (failure) throw failure;
      this.state = working;
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
