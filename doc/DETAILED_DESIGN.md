# Detailed design: implementation semantics

## 1. Purpose

This document defines the implementation-significant semantics that govern the
current `spa-development-reference` implementation and constrain later changes.

The requirements define what the reference supports.
The basic design defines the architecture and responsibility boundaries.
The policy defines implementation and maintenance rules.
OpenAPI defines the browser-facing HTTP contract.

This document records the detailed-design decisions required to keep observable
behavior, security semantics, concurrency behavior, recovery behavior, and
provider boundaries unambiguous across the current implementation and later
maintenance.

This document does not replace the other specifications and does not introduce
future architecture into the current implementation.

## 2. Authority and precedence

The specification precedence is:

1. `REQUIREMENTS.md`
2. `BASIC_DESIGN.md`
3. `DETAILED_DESIGN.md`
4. `POLICY.md`
5. `../openapi/openapi.yaml` for the concrete browser-facing HTTP contract

OpenAPI is authoritative for concrete HTTP paths, methods, parameter shapes,
request and response schemas, status codes, and response headers.

This document is authoritative for the processing order and internal semantics
that produce those HTTP results.

If implementation reveals a contradiction among these sources, implementation
stops. The contradiction is corrected in the authoritative specification
before implementation continues.

## 3. Current implementation boundary

The current implementation has a shared application core and two adapter modes.

Shared application boundary:

- one React and TypeScript SPA;
- one NestJS and TypeScript backend deployable;
- one BFF browser-facing boundary;
- local in-process Requests, Approvals, Attachments, and Audit capabilities;
- PostgreSQL-compatible persistence;
- one transactional outbox;
- deployment-time static capability routing.

In `APP_MODE=aws`:

- Aurora PostgreSQL-compatible persistence is the deployed database;
- S3 provides object storage;
- Cognito provides identity;
- SES provides email delivery;
- SNS provides event publication; and
- frontend and backend run as ECS/Fargate containers behind an ALB.

In `APP_MODE=local`:

- PostgreSQL runs locally through the documented Compose path;
- the fixed local identity adapter replaces Cognito;
- local filesystem object storage replaces S3;
- local delivery recorders replace SES and SNS; and
- no AWS client is instantiated for those adapters.

The mode changes only the external infrastructure adapters. Evaluation order,
authorization, domain behavior, persistence semantics, audit, and outbox
semantics remain shared.

The detailed design shall not introduce a microservice, remote current
capability, orchestrator, aggregator, service registry, distributed transaction
coordinator, Java runtime, Azure implementation, or Google Cloud
implementation.

## 4. Common HTTP request processing

Authenticated business operations use one observable processing order.

### 4.1 Routing before business processing

Before business processing:

1. an unknown path returns `404 ROUTE_NOT_FOUND`;
2. a known path with an unsupported HTTP method returns
   `405 METHOD_NOT_ALLOWED`.

Both use `application/problem+json`.

### 4.2 Business-operation evaluation order

For a matched business operation, evaluate in this order:

1. authenticate the bearer access token;
2. enforce the operation's coarse role requirement;
3. validate path, query, content type, and request-body structure;
4. perform any identity enrichment required by the operation;
5. load the addressed resource, when the operation addresses a resource;
6. enforce resource-specific authorization such as ownership;
7. compare the caller-supplied optimistic-concurrency version, when required;
8. validate the current domain state;
9. apply operation-specific domain validation;
10. perform the business operation.

An earlier failure wins over a later failure.

Examples:

- missing or invalid authentication returns `401` even if the path UUID is
  malformed;
- a caller without the required coarse role receives `403` before the system
  reveals whether the addressed resource exists;
- after the coarse role check, a malformed UUID returns `400`;
- a valid UUID for a missing resource returns `404`;
- an existing resource that the caller may not access returns `403`;
- when both the supplied version is stale and the current resource state is
  invalid, return `409 CONCURRENCY_CONFLICT`;
- when the version matches but the state is invalid, return
  `409 REQUEST_INVALID_STATE`.

### 4.3 Structural validation

The following are `400 VALIDATION_ERROR`:

- malformed UUID path or query values;
- malformed cursor values;
- malformed JSON;
- missing required request fields;
- values that violate the OpenAPI validation constraints;
- unknown request-body properties where the OpenAPI schema forbids additional
  properties.

A request body sent with a media type not supported by that operation returns
`415 UNSUPPORTED_MEDIA_TYPE`.

Attachment size overflow is defined separately and returns
`413 PAYLOAD_TOO_LARGE`.

## 5. Text normalization

The current sample uses these normalization rules.

### 5.1 Request title

Before validation and persistence:

- remove leading and trailing Unicode whitespace;
- reject the result when it is empty;
- enforce the OpenAPI maximum length after trimming.

Persist and return the trimmed value.

### 5.2 Request description

Preserve the supplied text except that CRLF line endings may be normalized to
LF by the implementation.

Do not trim meaningful leading or trailing text.

Enforce the OpenAPI maximum length.

### 5.3 Approval or rejection comment

When supplied:

- remove leading and trailing Unicode whitespace;
- treat an empty result as `null`;
- enforce the maximum length after trimming.

The approval record stores the normalized value.

## 6. Authentication identity contract

## 6.1 AWS-mode OAuth flow

When the SPA runtime configuration uses `authMode: "cognito"` and the backend
runs with `APP_MODE=aws`, the SPA uses OAuth 2.0 Authorization Code with PKCE.

The authorization request uses:

- PKCE method `S256`;
- scopes `openid email`;
- a cryptographically random `state` value.

The SPA has no client secret.

The callback path is `/auth/callback`.

The signed-out path is `/signed-out`.

### 6.1.1 Local demo identity

When the backend runs with `APP_MODE=local` and the SPA runtime configuration
has `authMode` `local`, no OAuth flow is used. The sign-in screen offers one
button per role. Each button uses a fixed, non-secret demo bearer token
(`demo-requester`, `demo-approver`, `demo-administrator`) that the local
identity adapter maps to the subject `local-requester`, `local-approver`, or
`local-administrator`, one role, and the verified email
`requester@example.test`, `approver@example.test`, or
`administrator@example.test`. An unknown token is `401 AUTHENTICATION_REQUIRED`.
The SPA still obtains its session from `GET /api/session`, keeps the token in
memory only, and local sign-out clears that state without leaving the page.
With `APP_MODE=aws` (the default) these tokens are never accepted. Only the
adapters for identity, object storage, email delivery, and event publication
depend on the mode; evaluation order, authorization, and persistence do not.

### 6.2 Redirect transaction state

The authorization redirect requires temporary browser state that survives the
full-page redirect.

The SPA may store only the following authentication-transaction values in
`sessionStorage`:

- PKCE code verifier;
- OAuth `state`;
- the application return path.

These values are not access, refresh, or ID tokens.

They are deleted immediately after a successful callback or a failed callback
that cannot be retried.

They are never stored in `localStorage`.

### 6.3 Token storage

After code exchange:

- the access token is held only in browser memory;
- a refresh token, when Cognito issues one, is held only in browser memory;
- an ID token is not used as BFF authorization evidence and is not persisted.

No token is stored in:

- `localStorage`;
- `sessionStorage`;
- IndexedDB; or
- an application-managed persistent cookie.

A page reload therefore loses the application's token state.

### 6.4 AWS access-token validation

In `APP_MODE=aws`, the BFF validates the Cognito access token before a business
operation.

The validation requires:

- a valid JWT signature;
- a signing key from the configured Cognito user-pool JWKS;
- `iss` exactly equal to the configured user-pool issuer;
- `client_id` exactly equal to the configured SPA app-client ID;
- `token_use` exactly equal to `access`;
- `exp` not expired, with at most 60 seconds of validation clock skew;
- scopes containing both `openid` and `email`.

A decode-only implementation is forbidden.

When the token `kid` is not present in the currently cached JWKS, refresh the
JWKS once and retry key lookup.

If the refresh succeeds but the key still does not exist, authentication fails
with `401 AUTHENTICATION_REQUIRED`.

If validation cannot proceed because no usable cached key exists and Cognito
JWKS retrieval is unavailable, return
`503 IDENTITY_PROVIDER_UNAVAILABLE`.

In `APP_MODE=local`, this Cognito validation path is not used. Authentication is
performed by the local identity adapter defined in section 6.1.1.

### 6.5 Application identity

Successful authentication becomes an application identity with:

- `subject`;
- `roles`;
- `email`, absent until an operation explicitly requires verified email.

In AWS mode, `subject` comes from token `sub` and roles are mapped from
`cognito:groups`. In local mode, the local identity adapter supplies the fixed
subject and one role defined in section 6.1.1.

The exact group mapping is:

- Cognito group `Requester` -> application role `Requester`;
- Cognito group `Approver` -> application role `Approver`;
- Cognito group `Administrator` -> application role `Administrator`.

A user may have multiple roles. Permissions are the union of those roles.

A validated user with none of these groups is authenticated but has no
application role and receives `403 FORBIDDEN` for role-protected operations.

A browser-supplied role value is never accepted as authorization evidence.

### 6.6 Verified email enrichment

Request creation requires the Requester identity to have a verified email.

In AWS mode, the BFF identity adapter calls the configured Cognito UserInfo
endpoint with the validated access token.

The response is accepted only when:

- returned `sub` equals the validated token `sub`;
- `email` exists and is non-empty;
- `email_verified` is `true`.

If UserInfo returns authentication failure, return
`401 AUTHENTICATION_REQUIRED`.

If UserInfo is unavailable because of network or provider failure, return
`503 IDENTITY_PROVIDER_UNAVAILABLE`.

If the identity is authenticated but has no verified email, return
`403 FORBIDDEN`.

In local mode, no UserInfo call occurs. The local identity adapter supplies the
verified demo email defined in section 6.1.1.

The verified email is stored internally on request creation as
`requester_email`.

`requester_email` is not part of the browser-facing `Request` representation.

## 7. SPA session and sign-out behavior

### 7.1 Refresh

When an access token is near expiry and an in-memory refresh token exists, the
SPA may refresh the token before issuing the next business request.

A refresh failure clears all in-memory tokens and all UI role state, and moves
the SPA to the signed-out state.

After a successful refresh the SPA re-fetches `GET /api/session` and replaces its
UI role state with the result, so that a change of Cognito group membership
that is reflected in the new token is reflected in the SPA presentation.

### 7.2 BFF 401 response

When the BFF returns `401 AUTHENTICATION_REQUIRED`:

- clear in-memory access, refresh, and ID token values;
- discard the UI role state obtained from `GET /api/session`;
- navigate to `/signed-out`;
- do not automatically retry the failed business mutation.

The signed-out screen provides an explicit Sign in action.

### 7.3 Reload without tokens

When a protected SPA route is loaded without an in-memory access token, navigate
to `/signed-out`.

When a protected SPA route is loaded with an in-memory access token, the SPA
bootstraps its role state with `GET /api/session` as defined in section 22
before it renders role-dependent routes or controls.

Do not silently treat stale browser UI state as authentication.

### 7.4 Explicit sign-out

Explicit sign-out:

1. clears all in-memory tokens and the UI role state first;
2. clears any temporary authentication transaction state;
3. redirects the browser to the configured Cognito logout endpoint;
4. passes the configured app-client ID and the registered post-logout redirect
   URI for `/signed-out`.

After the browser returns to `/signed-out`, the SPA remains signed out until
the user chooses Sign in.

No BFF logout endpoint exists in the current design.

## 8. Authorization matrix

Administrator is not an implicit superuser for business mutations.

Permissions are the union of the caller's roles.

### 8.1 Request list

`GET /api/requests`

- Requester: only requests whose `requesterId` equals identity `subject`;
- Administrator: all requests;
- Approver without Requester or Administrator: forbidden.

### 8.2 Request creation

`POST /api/requests`

Requires Requester.

The server sets:

- `requesterId` from identity `subject`;
- internal `requester_email` from verified email.

The client cannot override either value.

### 8.3 Request detail

`GET /api/requests/{requestId}`

- Requester: own request in any state;
- Approver: request only when current state is `SUBMITTED`;
- Administrator: any request.

A missing request is `404`.

An existing but inaccessible request is `403`.

### 8.4 Draft update

`PUT /api/requests/{requestId}`

Requires Requester, ownership, matching version, and state `DRAFT`.

### 8.5 Submit

`POST /api/requests/{requestId}/submit`

Requires Requester, ownership, matching version, and state `DRAFT`.

### 8.6 Approval queue

`GET /api/approvals`

Requires Approver.

It returns current `SUBMITTED` requests.

### 8.7 Approve and reject

Approval and rejection require Approver, matching version, and state
`SUBMITTED`.

### 8.8 Attachment upload

Attachment upload requires Requester, ownership, and current request state
`DRAFT`.

The state is checked both before S3 transfer and again during attachment
metadata finalization as defined in section 14.

### 8.9 Attachment download

- Requester: attachment belonging to an own request in any state;
- Approver: attachment belonging to a request currently in `SUBMITTED`;
- Administrator: any attachment.

The attachment ID must actually belong to the request ID in the path.
A mismatch is `404 ATTACHMENT_NOT_FOUND`.

### 8.10 Audit read

`GET /api/admin/audit` requires Administrator.

### 8.11 Session read

`GET /api/session` requires a valid access token and no application role.

It is available to every authenticated caller, including a caller with no
recognized application role.

### 8.12 Attachment list

`GET /api/requests/{requestId}/attachments` uses the same visibility as
attachment download, applied to the addressed request:

- Requester: attachments of an own request in any state;
- Approver: attachments of a request currently in `SUBMITTED`;
- Administrator: attachments of any request.

A caller with none of the Requester, Approver, or Administrator roles receives
`403 FORBIDDEN` before the system reveals whether the request exists.

A missing request is `404 REQUEST_NOT_FOUND`.

An existing request that the caller may not access is `403 FORBIDDEN`.

## 9. Request persistence and concurrency

### 9.1 IDs and timestamps

Server-created entity IDs are UUIDs.

Persisted timestamps use UTC and PostgreSQL `timestamptz` semantics.

API timestamps use RFC 3339 / OpenAPI `date-time`.

### 9.2 Request version

A newly created request starts with `version = 1`.

The request version increments by one for:

- draft update;
- submit;
- approve;
- reject.

Attachment addition does not increment the request version and does not change
the request `updatedAt`.

### 9.3 Transaction isolation

Use PostgreSQL `READ COMMITTED` isolation for current local transactions.

For a versioned state-changing operation:

1. load the request row in the transaction with a row lock;
2. perform resource-specific authorization;
3. compare the supplied version with the locked current version;
4. validate current state;
5. apply the mutation;
6. increment version;
7. set `updatedAt`;
8. write the required audit and outbox records;
9. commit.

The version check precedes the state check to preserve the error precedence in
section 4.

### 9.4 Approval uniqueness

The current model permits one terminal approval decision per request.

The persistence schema enforces uniqueness of `approvals.request_id`.

Approval and rejection insert the decision row in the same transaction that
updates the request state.

### 9.5 No current delete operation

The current sample has no request-delete, attachment-delete, approval-delete,
or audit-delete business operation.

Do not add deletion merely because the persistence technology supports it.

## 10. List and cursor semantics

All current list APIs use keyset cursor pagination.

The contract-level cursor remains opaque to the client.

### 10.1 Common limit

- default `limit`: 50;
- minimum: 1;
- maximum: 100.

### 10.2 Cursor binding

A cursor represents:

- cursor format version;
- endpoint kind;
- active explicit filter values;
- last returned sort-key values.

A cursor from one endpoint cannot be used on another endpoint.

For audit queries, a cursor is bound to the `requestId` filter value.
Changing the filter while reusing the cursor returns
`400 VALIDATION_ERROR`.

For attachment-list queries, a cursor is bound to the endpoint kind and to the
`requestId` path value. Reusing the cursor with a different `requestId` returns
`400 VALIDATION_ERROR`.

A malformed or semantically incompatible cursor returns
`400 VALIDATION_ERROR`.

Current cursors have no time-based expiration.

### 10.3 Snapshot semantics

Pagination does not create a database snapshot spanning several HTTP requests.

Concurrent writes between pages can therefore cause an item whose sort key
changes to appear on a different page or to be skipped relative to the
caller's earlier view.

The implementation uses keyset pagination and shall not switch to offset
pagination merely to simplify the query.

### 10.4 Request list order

Apply caller visibility first.

Then sort by:

1. `updatedAt` descending;
2. `id` ascending.

The next cursor represents the last returned `(updatedAt, id)` tuple.

### 10.5 Approval queue order

Filter to `SUBMITTED`.

Then sort by:

1. `updatedAt` ascending;
2. `id` ascending.

Because submit changes `updatedAt`, this gives older submitted work priority.

### 10.6 Audit order

Apply optional `requestId` filter first.

Then sort by:

1. `occurredAt` descending;
2. `id` ascending.

### 10.7 Attachment list order

Apply the request-level authorization of section 8.12 first.

Then sort the attachments of the request by:

1. `createdAt` ascending;
2. `id` ascending.

The next cursor represents the last returned `(createdAt, id)` tuple.

## 11. Audit semantics

Audit event types are a closed current set:

- `REQUEST_CREATED`;
- `REQUEST_UPDATED`;
- `REQUEST_SUBMITTED`;
- `REQUEST_APPROVED`;
- `REQUEST_REJECTED`;
- `ATTACHMENT_ADDED`.

Audit-producing operations are:

| Operation | Event | fromState | toState | details |
| --- | --- | --- | --- | --- |
| create | `REQUEST_CREATED` | null | `DRAFT` | null |
| draft update | `REQUEST_UPDATED` | `DRAFT` | `DRAFT` | null |
| submit | `REQUEST_SUBMITTED` | `DRAFT` | `SUBMITTED` | null |
| approve | `REQUEST_APPROVED` | `SUBMITTED` | `APPROVED` | `{ "approvalId": "<uuid>" }` |
| reject | `REQUEST_REJECTED` | `SUBMITTED` | `REJECTED` | `{ "approvalId": "<uuid>" }` |
| attachment add | `ATTACHMENT_ADDED` | current state | same current state | `{ "attachmentId": "<uuid>" }` |

`actorId` is application identity `subject`.

One business operation uses one operation timestamp for its state change,
approval row, audit event, and outbox event timestamps where applicable.

The current sample does not create business audit events for:

- list;
- detail read;
- attachment download;
- audit read;
- sign-in;
- token refresh; or
- sign-out.

Approval comments, requester email, request description, file content, and
tokens are not copied into audit details.

## 12. Notification semantics

Current notification-producing business transitions are:

- `REQUEST_SUBMITTED`;
- `REQUEST_APPROVED`;
- `REQUEST_REJECTED`.

Each transition creates exactly two outbox rows in the same database
transaction:

1. channel `EMAIL`;
2. channel `EVENT`.

Request creation, draft update, and attachment addition create no outbox row.

### 12.1 Email recipient

The current email recipient is the persisted request `requester_email`.

The email address is captured at request creation from the verified email
supplied by the active identity adapter and is not re-resolved when a later
transition occurs. In AWS mode that email comes from verified Cognito UserInfo;
in local mode it comes from the fixed local identity.

### 12.2 Email payload

The immutable email outbox payload contains:

- `to`;
- `eventType`;
- `requestId`;
- `title`;
- `status`.

Subjects are:

- `REQUEST_SUBMITTED` -> `Request submitted`;
- `REQUEST_APPROVED` -> `Request approved`;
- `REQUEST_REJECTED` -> `Request rejected`.

The current email is UTF-8 plain text.

The body contains:

- request ID;
- request title;
- current status.

It does not contain request description, approval comment, attachment name,
audit details, credentials, or tokens.

### 12.3 SNS event payload

The immutable event payload contains:

- `eventId`: EVENT-channel outbox row ID;
- `eventType`;
- `occurredAt`;
- `requestId`;
- `actorId`;
- `fromStatus`;
- `toStatus`;
- `version`: request version after the transition.

SNS message body is the JSON serialization of this payload.

SNS message attribute `eventType` contains the same event type.

`eventId` is the de-duplication key exposed to downstream consumers.

## 13. Outbox lifecycle and recovery

## 13.1 Status model

Outbox status is one of:

- `PENDING`;
- `PROCESSING`;
- `DELIVERED`;
- `FAILED`.

The logical persistence fields include:

- existing outbox fields from the basic design;
- `claim_token`, nullable;
- `claimed_at`, nullable;
- `claim_expires_at`, nullable.

### 13.2 Eligibility

A `PENDING` row is eligible when `next_attempt_at <= now`.

A `PROCESSING` row is not eligible until its claim expires.

### 13.3 Stale-claim recovery

Before or as part of the normal claim cycle, recover rows whose:

- status is `PROCESSING`; and
- `claim_expires_at <= now`.

If `attempt_count < 5`:

- set status to `PENDING`;
- clear claim fields;
- set `next_attempt_at = now`.

If `attempt_count >= 5`:

- set status to `FAILED`;
- clear claim fields;
- do not call the external provider again automatically.

No separate operator action is required for worker restart recovery.

### 13.4 Claim transaction

Claim work inside a short database transaction.

The implementation uses PostgreSQL row locking equivalent to
`FOR UPDATE SKIP LOCKED` so several backend tasks can claim distinct rows.

Claiming a row:

- changes status to `PROCESSING`;
- increments `attempt_count` by one;
- assigns a new cryptographically random `claim_token`;
- sets `claimed_at = now`;
- sets `claim_expires_at = now + 60 seconds`.

Commit the claim transaction before the external network call.

### 13.5 Provider-call timeout

SES and SNS delivery calls use an application-level timeout no longer than
15 seconds.

The 60-second claim lease is deliberately longer than this timeout.

### 13.6 Successful completion

After successful provider delivery, update the row to `DELIVERED` only when:

- status is still `PROCESSING`; and
- the stored `claim_token` still equals the worker's token.

Set `delivered_at`.

Clear the claim fields.

A worker whose lease was replaced must not overwrite the newer claim result.

### 13.7 Failed delivery

Sanitize provider errors before persistence.

`last_error` contains a bounded diagnostic string with no token, credential,
email body, or provider response body containing private data.

When an attempt fails and `attempt_count < 5`:

- set status to `PENDING`;
- clear claim fields;
- set `next_attempt_at` using the policy retry delay.

When attempt 5 fails:

- set status to `FAILED`;
- clear claim fields;
- automatic retry stops.

The current sample retries all SES and SNS delivery failures through the same
bounded policy. It does not implement provider-specific permanent-error
classification.

### 13.8 At-least-once consequence

A provider call may succeed and the process may stop before the database row is
marked delivered.

After lease recovery, the delivery may therefore be sent again.

This is expected at-least-once behavior.

For SNS, consumers can de-duplicate using `eventId`.

The current design makes no exactly-once guarantee for email.

## 14. Attachment acceptance and storage

## 14.1 Size

Default maximum attachment size is 10 MiB (`10485760` bytes).

Deployment may override the limit with a positive integer up to 100 MiB.

An invalid configured value fails backend bootstrap.

An empty file is rejected.

A file larger than the configured limit returns
`413 PAYLOAD_TOO_LARGE`.

### 14.2 Accepted media types

The current sample accepts only:

- `application/pdf`;
- `image/png`;
- `image/jpeg`;
- `text/plain`.

The multipart file part must declare a supported media type.

Media-type comparison is case-insensitive on the type/subtype.
Parameters are ignored except that `text/plain` may specify no charset or
`charset=utf-8`.

Unsupported media type returns
`415 UNSUPPORTED_MEDIA_TYPE`.

### 14.3 Content validation

Do not trust the multipart Content-Type header alone.

Validate:

- PDF starts with `%PDF-`;
- PNG starts with the PNG eight-byte signature;
- JPEG starts with `FF D8 FF`;
- text/plain is valid UTF-8 and contains no NUL byte.

A declared supported media type whose content does not match is
`415 UNSUPPORTED_MEDIA_TYPE`.

Current attachment handling does not include antivirus scanning.

### 14.4 File name

The multipart file name is display metadata, never an object-storage path.

Normalize it to Unicode NFC.

Reject a name that:

- is empty;
- exceeds 255 characters;
- contains `/` or `\\`;
- contains NUL;
- contains CR or LF;
- contains another ASCII control character.

Required file-name extensions are:

- PDF: `.pdf`;
- PNG: `.png`;
- JPEG: `.jpg` or `.jpeg`;
- text/plain: `.txt`.

Extension comparison is case-insensitive.

A media-type/extension mismatch returns
`415 UNSUPPORTED_MEDIA_TYPE`.

### 14.5 Object key

Generate attachment ID before the S3 write.

The S3 key is:

`attachments/{requestId}/{attachmentId}`

The user-supplied file name is never part of the S3 key.

The stored S3 Content-Type is the validated media type.

### 14.6 Upload concurrency and finalization

Before S3 transfer:

- authenticate;
- enforce Requester role;
- validate request ID and upload metadata;
- load the request;
- enforce ownership;
- require `DRAFT`.

After S3 succeeds, begin a database transaction and lock the request row.

Re-check:

- request still exists;
- caller still owns it;
- request state is still `DRAFT`.

Then, in the same transaction:

- insert attachment metadata;
- insert `ATTACHMENT_ADDED` audit event;
- commit.

Attachment addition does not increment request version.

If the final re-check or database transaction fails after S3 succeeded, attempt
best-effort deletion of the newly written S3 object.

If cleanup fails, log an orphan-object condition with the object key and
`traceId`, but do not convert the failed upload to success.

This second state check prevents a request that was submitted during a slow S3
upload from acquiring a new attachment after submission.

### 14.7 Download headers

A successful download returns:

- `Content-Type`: stored validated media type;
- `Content-Length`: stored attachment size;
- `Content-Disposition`: `attachment`, never `inline`;
- `X-Content-Type-Options: nosniff`;
- `Cache-Control: private, no-store`.

`Content-Disposition` contains:

- a safe ASCII `filename` fallback; and
- RFC 8187 UTF-8 `filename*` generated from the stored normalized file name.

CR/LF cannot enter the header because such file names are rejected on upload.

The current API does not support HTTP range requests.

## 15. AWS resource and secret boundary

## 15.1 Credentials

ECS tasks use IAM task roles.

Do not place long-lived AWS access keys in application configuration.

### 15.2 Database secret

Aurora database credentials are stored in AWS Secrets Manager for the AWS
deployment.

ECS injects the required database secret into the backend task through the
platform secret-injection mechanism.

Normal CI does not require that production secret.

### 15.3 Aurora

The AWS deployment uses:

- encryption at rest;
- private networking;
- no public database endpoint exposure to the Internet.

Backend-to-database connections use TLS in the AWS deployment.

### 15.4 S3

The attachment bucket:

- blocks all public access;
- does not use public ACLs;
- uses S3 server-side encryption;
- is accessed only through the backend task role for application behavior.

### 15.5 SES and SNS

The backend task role receives only the SES and SNS permissions required by
the current adapters.

The SES sender address is deployment configuration and must already satisfy
the SES account's verification requirements.

The SNS topic is deployment configuration or an IaC-created current resource.

### 15.6 Cognito

The current deployment defines or expects Cognito groups with the exact names:

- `Requester`;
- `Approver`;
- `Administrator`.

The SPA app client is a public client without a client secret.

Its allowed callback URI includes `/auth/callback`.

Its allowed sign-out URI includes `/signed-out`.

## 16. Configuration and bootstrap

Configuration is resolved once at startup as already required by the basic
design.

At minimum, the current implementation requires logical configuration for:

- HTTP listen settings;
- database connection;
- Cognito issuer;
- Cognito SPA client ID;
- Cognito authorization endpoint;
- Cognito token endpoint;
- Cognito UserInfo endpoint;
- Cognito logout endpoint;
- SPA callback URI;
- SPA post-logout URI;
- AWS region;
- S3 bucket;
- SES sender;
- SNS topic;
- attachment maximum bytes;
- outbox polling and retry settings;
- BFF capability routing.

Non-secret frontend runtime configuration may expose only the browser-safe
Cognito and application-origin values needed by the SPA.

Missing or invalid required configuration fails bootstrap.

Do not start in a partially configured mode that silently disables a current
required capability.

Environment-variable names and the configuration library are implementation
details and may be selected during implementation.

## 17. Health and readiness

### 17.1 Liveness

`GET /health/live`:

- returns `200`;
- indicates only that the process is alive;
- performs no remote dependency call.

Response body is:

```json
{"status":"ok"}
```

### 17.2 Readiness

`GET /health/ready` returns `200` only when:

- bootstrap completed successfully; and
- a lightweight Aurora connectivity check succeeds.

It does not call Cognito, S3, SES, or SNS on every readiness probe.

When not ready, return `503`.

The body is either:

```json
{"status":"ok"}
```

or:

```json
{"status":"not_ready"}
```

Do not expose host names, connection strings, provider errors, or credentials.

The ALB backend target group uses `/health/ready`.

## 18. External-failure mapping

Use these public mappings.

- Cognito token invalid or rejected -> `401 AUTHENTICATION_REQUIRED`
- required Cognito JWKS/UserInfo unavailable -> `503 IDENTITY_PROVIDER_UNAVAILABLE`
- S3 unavailable for attachment operation -> `503 OBJECT_STORAGE_UNAVAILABLE`
- database or unclassified required infrastructure failure during a synchronous
  business operation -> `500 INTERNAL_ERROR`
- SES or SNS failure -> no rollback of the committed business operation;
  outbox state changes according to section 13

The server log may contain provider diagnostic context after redaction.
The HTTP response does not expose raw provider errors.

## 19. Production same-origin behavior

The production browser origin is shared through the ALB.

The SPA calls relative `/api/...` paths.

The current production design does not require permissive CORS.

Authentication uses the Authorization header rather than an application
authentication cookie, so current state-changing business operations do not
depend on cookie-based CSRF protection.

Local development may use a development proxy that preserves the same browser
API path shape.

## 20. Error-code set

The current stable error-code set is:

- `VALIDATION_ERROR`
- `AUTHENTICATION_REQUIRED`
- `FORBIDDEN`
- `REQUEST_NOT_FOUND`
- `ATTACHMENT_NOT_FOUND`
- `ROUTE_NOT_FOUND`
- `METHOD_NOT_ALLOWED`
- `REQUEST_INVALID_STATE`
- `CONCURRENCY_CONFLICT`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `IDENTITY_PROVIDER_UNAVAILABLE`
- `OBJECT_STORAGE_UNAVAILABLE`
- `INTERNAL_ERROR`

Mapping:

- `VALIDATION_ERROR` -> 400
- `AUTHENTICATION_REQUIRED` -> 401
- `FORBIDDEN` -> 403
- resource not found codes -> 404
- `ROUTE_NOT_FOUND` -> 404
- `METHOD_NOT_ALLOWED` -> 405
- state / concurrency conflict -> 409
- `PAYLOAD_TOO_LARGE` -> 413
- `UNSUPPORTED_MEDIA_TYPE` -> 415
- provider unavailable codes -> 503
- `INTERNAL_ERROR` -> 500

## 21. Required automated coverage

The current implementation must keep automated coverage for at least the
following semantics in addition to the broader test requirements already
defined by the basic design and policy.

### 21.1 Error precedence

Cover:

- unauthenticated + malformed UUID -> 401;
- wrong coarse role + missing resource -> 403;
- malformed UUID after successful role check -> 400;
- missing resource -> 404;
- inaccessible existing resource -> 403;
- stale version + invalid state -> `CONCURRENCY_CONFLICT`;
- matching version + invalid state -> `REQUEST_INVALID_STATE`.

### 21.2 Authentication

Cover:

- valid token;
- expired token;
- wrong issuer;
- wrong client ID;
- wrong token_use;
- unknown kid after JWKS refresh;
- JWKS unavailable with no usable key;
- group-to-role mapping;
- multi-role union;
- no recognized application role.

### 21.3 Session behavior

Cover frontend behavior for:

- callback state validation;
- token kept out of persistent browser storage;
- 401 clears in-memory token state;
- explicit sign-out clears state before redirect;
- signed-out route does not immediately restore stale application state.

### 21.4 Concurrency

Cover:

- draft update increments version;
- submit increments version;
- approve/reject concurrency conflict;
- only one terminal approval row;
- attachment addition does not increment request version;
- attachment finalization fails and cleans up when submit wins the race.

### 21.5 Outbox recovery

Cover:

- PENDING claim;
- concurrent workers do not intentionally claim the same row;
- claim expiry recovery;
- stale worker cannot overwrite a newer claim;
- retry schedule;
- fifth failure becomes FAILED;
- success becomes DELIVERED;
- business state remains committed when delivery fails.

### 21.6 Attachment validation

Cover:

- supported content types;
- signature mismatch;
- extension mismatch;
- invalid file name;
- zero-byte file;
- size overflow;
- safe download headers;
- request/attachment path mismatch;
- upload forbidden after request is no longer DRAFT.

### 21.7 Pagination

Cover:

- default and maximum limit;
- deterministic tie-break;
- opaque cursor round trip;
- cursor used with the wrong endpoint;
- audit cursor used with a changed requestId filter;
- malformed cursor.

### 21.8 Session and browser-state reconstruction

Cover:

- `GET /api/session` returns server-derived roles in the order Requester,
  Approver, Administrator;
- a user with no recognized role receives `200` with an empty `roles` array;
- the frontend bootstrap builds its role state from `GET /api/session` and does
  not decode token claims;
- the role state is cleared after a `401` and after sign-out;
- a successful token refresh triggers a `GET /api/session` re-fetch;
- a supported screen can be reconstructed after reload from GET endpoints
  alone (see section 23).

### 21.9 Attachment list

Cover:

- attachment-list authorization for Requester, Approver, and Administrator;
- deterministic order by `createdAt` ascending, then `id` ascending;
- the cursor is bound to `requestId`;
- attachment IDs remain discoverable after reload;
- a request or review screen reconstructs attachment metadata without an
  upload response.

## 22. Session API and SPA bootstrap

### 22.1 Session API

`GET /api/session` returns the current application identity as the BFF
constructed it from the validated access token.

It is the authoritative view of the caller's application roles for SPA
presentation. The SPA does not parse `cognito:groups` or any other token claim
to decide application roles, and it does not duplicate the Cognito group
mapping.

The response contains:

- `subject`: the identity `subject`;
- `roles`: the unique application roles of the caller, in the fixed order
  `Requester`, `Approver`, `Administrator`; and
- `email`: optional.

A caller with no recognized Cognito group receives `200` with an empty `roles`
array.

`GET /api/session` performs no application-role check. A missing, invalid, or
expired token returns `401 AUTHENTICATION_REQUIRED`. If token validation cannot
proceed because the Cognito JWKS is unavailable and no usable cached key exists,
it returns `503 IDENTITY_PROVIDER_UNAVAILABLE`.

The BFF includes `email` only when a verified email is already part of the
identity for that request. It does not call UserInfo only to serve this
endpoint, and a UserInfo failure never fails `GET /api/session`. The SPA does
not use `email` for role gating or for any authorization decision.

### 22.2 SPA bootstrap

Before the SPA enters a protected application route, it:

1. checks for an in-memory access token;
2. navigates to `/signed-out` when there is none;
3. otherwise calls `GET /api/session`;
4. adopts the returned `roles` as the current UI role state; and
5. computes routes, navigation, and control visibility from that state.

A `401 AUTHENTICATION_REQUIRED` from `GET /api/session` follows section 7.2.

### 22.3 Authority

`roles` from `GET /api/session` is for presentation only. It is never sent back
to the BFF and is never trusted by it. On every business request the BFF derives
identity and roles again from the validated access token.

## 23. Browser state reconstruction

A reloadable SPA screen shall not require transient data from a previous
browser interaction in order to rediscover the current server-side state.

The current discovery paths are:

| State needed | Source |
| --- | --- |
| current roles | `GET /api/session` |
| request list | `GET /api/requests` |
| request detail | `GET /api/requests/{requestId}` |
| approval queue | `GET /api/approvals` |
| request attachments | `GET /api/requests/{requestId}/attachments` |
| attachment content | attachment list metadata and the download endpoint |
| audit history | `GET /api/admin/audit` |

Upload, create, submit, approve, and reject responses may be used to update the
current screen optimistically, but they are never the only discovery path.

The frontend shall not require:

- a previous upload response;
- a previous mutation response;
- decoded Cognito group claims; or
- hidden in-memory identifiers that cannot be recovered from a current GET
  endpoint

in order to reconstruct a supported screen after a reload.

After a successful attachment upload, the screen shows the new attachment either
by applying the upload response and then re-fetching the attachment list, or by
re-fetching the attachment list immediately. The upload response is not the sole
local source of truth.

## 24. Non-normative implementation details

The following details are intentionally not fixed as public or architectural
semantics by this detailed design:

- package-manager and workspace mechanics;
- ORM or query-library mechanics;
- concrete NestJS module and provider names;
- React component and hook decomposition;
- logging-library mechanics;
- OpenAPI generation and validation tooling;
- test-runner mechanics;
- IaC framework mechanics;
- container base images;
- environment-variable names;
- private helper functions;
- internal cursor encoding format, provided section 10 semantics are preserved;
- outbox batching configuration; and
- AWS SDK client construction.

The current v1.0 implementation makes concrete choices for these details in the
repository source, package manifests, configuration, and build definitions.
Those current choices are implementation facts, not permission for this
document to describe them as still undecided.

A later maintenance change may alter one of these details only when the change
preserves the requirements, architecture, public behavior, security, failure
semantics, transaction boundaries, and current/future scope, or when the
authoritative specifications are deliberately changed first.
