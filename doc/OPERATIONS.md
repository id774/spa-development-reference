# Operations reference

How the running implementation behaves, for people who operate it. It describes what the code and the CDK stack do today; there is no operational automation beyond what is stated here. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the stack and [`CONFIGURATION.md`](CONFIGURATION.md) for the settings mentioned below.

## 1. Health

| Endpoint | Where | Meaning |
| --- | --- | --- |
| `GET /health/live` | backend | The process is running. Always `200` with `{"status":"ok"}`; it calls nothing remote. |
| `GET /health/ready` | backend | `200` with `{"status":"ok"}` when a trivial query to the database succeeds, otherwise `503` with `{"status":"not_ready"}`. It does not call Cognito, S3, SES, or SNS. The ALB backend target group uses it. |
| `GET /healthz` | frontend | `200` with `ok`, served by nginx. The ALB frontend target group uses it. |

The responses never include host names, connection strings, or error details. The ALB sends only `/api/*` to the backend, so the backend health endpoints are for the target group and for direct access, not for public clients.

## 2. Logging

- The backend writes one JSON object per line to standard output. Fields: `timestamp`, `level` (`info`, `warn`, `error`), `message`, plus `traceId`, `userId`, `operation`, and `capability` when known, and event-specific fields. In the AWS deployment the container logs go to CloudWatch Logs (stream prefix `backend`; the frontend uses `frontend` and the migration task `migrate`), retained for one month.
- Every request has a `traceId`. A well-formed `X-Request-Id` request header is reused; otherwise one is generated. It is returned in the `X-Request-Id` response header and in the `traceId` field of every error response, so a client-visible error can be matched with the server log lines of that request.
- Every request logs a `request completed` line (method, path, status, duration). Rejected requests log `request rejected` with the error `code`; server-side failures log `request failed` at `error` level with a sanitized description.
- Bearer tokens, refresh tokens, passwords, secrets, and private keys are redacted from log fields, and error descriptions have bearer tokens and JWTs removed. Request payloads and file contents are not logged.
- The business audit history is separate: it lives in the `audit_events` table and is read through the audit API. Logs are not the audit record and log retention does not affect it.

## 3. Outbox (email and event delivery)

Each submit, approve, and reject writes two rows into `outbox_deliveries` in the same transaction as the state change: one `EMAIL` (to the address stored on the request) and one `EVENT` (published to SNS). A background worker inside every backend task delivers them after the commit.

| Status | Meaning |
| --- | --- |
| `PENDING` | Waiting to be delivered; due when `next_attempt_at` has passed. |
| `PROCESSING` | Claimed by a worker (a lease of 60 seconds by default). |
| `DELIVERED` | Sent. |
| `FAILED` | Out of automatic attempts. |

Behavior:

- Every poll cycle (5 seconds by default) the worker recovers expired claims, claims up to the batch size of due `PENDING` rows, and delivers them. Claiming uses row locking that skips locked rows, so several backend tasks do not take the same row.
- Calls to SES and SNS happen outside any database transaction, with a timeout of 15 seconds by default. A failed delivery never rolls back the business change.
- After a failed attempt the row returns to `PENDING` with a delay by attempt number: 30, 120, 600, then 1800 seconds. The fifth failed attempt sets `FAILED`, and automatic retrying stops. These are the defaults; they come from [`CONFIGURATION.md`](CONFIGURATION.md).
- If a worker stops while holding a claim, the claim expires and the row is picked up again (immediately due), or set to `FAILED` if it already used its last attempt, without another provider call. A worker whose claim was replaced cannot overwrite the newer result.
- Delivery is **at-least-once**: a message sent just before a crash can be sent again. SNS consumers can de-duplicate on the `eventId` field of the payload, which is the delivery row's ID. Email is not de-duplicated.
- `EMAIL` and `EVENT` rows succeed or fail independently. `last_error` holds a short, sanitized reason (at most 1000 characters).

There is no manual retry command, no purge job, and no alerting in this implementation; rows are never deleted. To look at the state, query the table, for example:

```sql
SELECT channel, status, count(*) FROM outbox_deliveries GROUP BY channel, status;
SELECT id, channel, event_type, attempt_count, last_error FROM outbox_deliveries WHERE status = 'FAILED';
```

## 4. Database migrations

Migrations are version controlled in `backend/prisma/migrations/`. Starting the backend does not apply them. They are applied by `npm run migrate:deploy` (locally) or, in AWS, by running the stack's separate one-off migration task. See [`DEVELOPMENT.md`](DEVELOPMENT.md), section 4, and [`DEPLOYMENT.md`](DEPLOYMENT.md), section 6. The readiness check only tests connectivity, so a backend can be ready before the migrations have been applied.

## 5. Attachments

- File content is stored in the S3 bucket under `attachments/<requestId>/<attachmentId>`; the file name is never part of the key. Metadata (name, type, size, uploader) is in the `attachments` table.
- The bucket blocks all public access. Browsers never receive storage credentials or links: uploads and downloads go through the backend, which checks permissions first.
- If the object is written but the metadata cannot be committed (including when the request was submitted during a slow upload), the backend tries to delete the new object. If that deletion fails it logs `orphan object could not be deleted` with the object key, and the upload still fails.
- The maximum size is `ATTACHMENT_MAX_BYTES` (10 MiB by default). Accepted types are PDF, PNG, JPEG, and UTF-8 text; there is no virus scanning.

## 6. Backup and retention behavior defined by the stack

Only what [`infra/lib/reference-stack.ts`](../infra/lib/reference-stack.ts) sets:

| Resource | Behavior |
| --- | --- |
| Aurora cluster | Storage encrypted, deletion protection on, and a snapshot is taken if the cluster is removed with the stack. The stack sets no backup retention period, so the service default applies. |
| S3 attachment bucket | Retained when the stack is deleted. No lifecycle rule is defined. |
| Cognito user pool | Retained when the stack is deleted. |
| CloudWatch log groups | Retained for one month; deleted with the stack. |

## 7. Observing common failures

| Situation | What you see | Where to look |
| --- | --- | --- |
| Database unreachable | `/health/ready` returns `503`; the ALB marks the backend target unhealthy; business requests fail with `500 INTERNAL_ERROR`. | `request failed` log lines |
| Identity provider unavailable | `503 IDENTITY_PROVIDER_UNAVAILABLE` when the Cognito signing keys are needed but cannot be fetched, or when UserInfo cannot be reached. A token whose key is already cached keeps validating. | `jwks retrieval failed`, `userinfo request failed` |
| Object storage unavailable | `503 OBJECT_STORAGE_UNAVAILABLE` on upload or download; the request and its other data are unaffected. | `object storage write failed`, `object storage read failed` |
| Notification delivery failing | Business operations succeed; rows stay `PENDING` with growing `attempt_count`, then `FAILED`. | `outbox delivery failed` log lines (fields `deliveryId`, `channel`, `attempt`, `final`) and the `outbox_deliveries` table |
| Invalid configuration | The backend exits at start-up with code 1 and a message `Invalid configuration:` listing each problem on standard error. The frontend container exits when a required runtime variable is missing. ECS keeps trying to start replacement tasks. | Container logs |
| Unexpected error in a request | `500 INTERNAL_ERROR` with a `traceId` and no internal detail. | Search the logs for that `traceId` |
