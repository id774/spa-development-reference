-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('REQUEST_CREATED', 'REQUEST_UPDATED', 'REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'ATTACHMENT_ADDED');

-- CreateEnum
CREATE TYPE "OutboxChannel" AS ENUM ('EMAIL', 'EVENT');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "requester_id" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "approver_id" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" VARCHAR(2000),
    "decided_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "media_type" VARCHAR(255) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "event_type" "AuditEventType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "from_state" "RequestStatus",
    "to_state" "RequestStatus",
    "details" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_deliveries" (
    "id" UUID NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" "OutboxEventType" NOT NULL,
    "channel" "OutboxChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "delivered_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(1000),
    "claim_token" TEXT,
    "claimed_at" TIMESTAMPTZ(3),
    "claim_expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_updated_at_id_idx" ON "requests"("updated_at" DESC, "id");

-- CreateIndex
CREATE INDEX "requests_requester_id_updated_at_id_idx" ON "requests"("requester_id", "updated_at" DESC, "id");

-- CreateIndex
CREATE INDEX "requests_status_updated_at_id_idx" ON "requests"("status", "updated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_request_id_key" ON "approvals"("request_id");

-- CreateIndex
CREATE INDEX "attachments_request_id_created_at_id_idx" ON "attachments"("request_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_id_idx" ON "audit_events"("occurred_at" DESC, "id");

-- CreateIndex
CREATE INDEX "audit_events_request_id_occurred_at_id_idx" ON "audit_events"("request_id", "occurred_at" DESC, "id");

-- CreateIndex
CREATE INDEX "outbox_deliveries_status_next_attempt_at_idx" ON "outbox_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_deliveries_status_claim_expires_at_idx" ON "outbox_deliveries"("status", "claim_expires_at");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Value constraints that mirror the public contract and the lifecycle rules.
ALTER TABLE "requests" ADD CONSTRAINT "requests_version_check" CHECK ("version" >= 1);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_bytes_check" CHECK ("size_bytes" >= 1);
ALTER TABLE "outbox_deliveries" ADD CONSTRAINT "outbox_deliveries_attempt_count_check" CHECK ("attempt_count" >= 0);
