# Basic design: an SPA development reference application

## 1. Purpose

This document describes how `spa-development-reference` is composed: the
runtime topology, application layers, responsibilities, dependency direction,
data model, request flows, failure boundaries, and the extension points that
preserve the future directions stated in
[`REQUIREMENTS.md`](REQUIREMENTS.md).

What the repository is for, which capabilities are current, which are future,
and where the supported scope ends belong to
[`REQUIREMENTS.md`](REQUIREMENTS.md). The rules used when implementing or
changing the repository belong to [`POLICY.md`](POLICY.md). The concrete
browser-facing HTTP contract belongs to `openapi/openapi.yaml` once that file
is introduced.

Implementation-significant semantics that refine this basic design, such as the
request-processing order, identity and session behavior, concurrency and
recovery behavior, and attachment acceptance rules, belong to
[`DETAILED_DESIGN.md`](DETAILED_DESIGN.md). The detailed design refines this
document. It does not override `REQUIREMENTS.md` or the architectural
invariants of this document, and the concrete HTTP contract remains in
`openapi/openapi.yaml`.

This document does not turn future concepts into current implementation
requirements. Sections describing future microservices, orchestration,
aggregation, Java, Azure, or Google Cloud define compatibility boundaries and
extension shapes only.

The document stands on its own. No private standard, internal document, or
other repository is required to understand the design.

## 2. Design principles

The design is governed by the following principles.

- **Start as one deployable backend.** Distribution is not introduced before a
  concrete requirement needs it.
- **Preserve extraction boundaries.** A capability that is local today shall
  not be entangled with unrelated capabilities in a way that prevents it from
  becoming a service later.
- **The BFF is the browser-facing boundary.** The SPA talks to one public API
  surface and does not learn internal backend locations.
- **A network hop is not a layer.** When a capability is local, the BFF invokes
  it in process. The design does not make an HTTP request to the same process
  merely to imitate a future microservice.
- **Static routing is enough.** The mapping from a BFF capability to a local or
  remote implementation is fixed at application startup from deployment-time
  configuration. Runtime route mutation is not supported.
- **Public contracts are language-neutral.** OpenAPI, HTTP semantics, problem
  details, and persisted business meaning do not depend on NestJS or
  TypeScript-specific wire types.
- **Domain and application logic do not depend on AWS SDK types.** AWS-specific
  objects stop at infrastructure adapters.
- **One local business transaction owns one local consistency boundary.**
  Database state that must succeed or fail together is committed together.
  External systems are not pretended to participate in that transaction.
- **External side effects are asynchronous after commit where consistency
  requires it.** Notification intent is recorded transactionally and delivered
  after the business commit.
- **Logging and auditing are separate.** Operational diagnostics and business
  history have different storage, retention, and meaning.
- **Framework mechanisms remain visible.** The reference composes React,
  NestJS, HTTP, SQL, and AWS rather than hiding them behind a second proprietary
  framework.
- **Future architecture does not pre-install present complexity.** There is no
  service registry, dynamic router, distributed transaction coordinator, or
  separate aggregator in the current implementation.

## 3. Repository composition

The repository is a monorepo. Its top-level structure is:

```text
spa-development-reference/
├── frontend/                 React + TypeScript SPA
├── backend/                  NestJS + TypeScript BFF and business capabilities
├── packages/
│   ├── ui/                   reusable React UI components
│   └── api-client/           client generated from the OpenAPI contract
├── openapi/
│   └── openapi.yaml          normative browser-facing HTTP contract
├── infra/                    AWS deployment definitions
├── doc/
│   ├── REQUIREMENTS.md
│   ├── BASIC_DESIGN.md
│   ├── DETAILED_DESIGN.md
│   ├── POLICY.md
│   ├── LICENSE.md
│   ├── COPYING
│   └── COPYING.LESSER
└── .github/
    └── workflows/
        └── ci.yml            standard CI pipeline
```

Directories that do not yet exist are target structure, not permission to
create them as part of a documentation-only change.

The concrete Infrastructure as Code language is deliberately not selected by
this basic design. `infra/` is the ownership boundary for AWS deployment
definitions. The implementation task that introduces `infra/` shall select and
document one IaC tool before code is added there.

The package manager is likewise not selected by this document. The repository
shall use one workspace-capable Node.js package-management strategy when
implementation begins, but the choice does not change the architecture defined
here and must be fixed before package files are created.

## 4. Current runtime topology

The current supported deployment is one frontend service and one backend
service, both running as containers on Amazon ECS with AWS Fargate.

```text
                               Internet
                                  |
                               HTTPS
                                  |
                                  v
                      +-----------------------+
                      | Application Load      |
                      | Balancer              |
                      +-----------+-----------+
                                  |
                  +---------------+----------------+
                  |                                |
              non-/api/*                        /api/*
                  |                                |
                  v                                v
      +-----------------------+       +----------------------------+
      | Frontend ECS/Fargate  |       | Backend ECS/Fargate        |
      | static SPA container  |       | NestJS                     |
      +-----------+-----------+       | BFF + local capabilities   |
                  |                   +---+----+----+----+----------+
                  |                       |    |    |    |
                  |                       |    |    |    |
                  |                       v    v    v    v
                  |                    Aurora S3  SES  SNS
                  |
                  +------ browser authentication flow ------+
                                                           |
                                                           v
                                                     Amazon Cognito
```

The external browser origin is shared through the ALB.

The ALB routes `/api/*` to the backend target group and all other application
paths to the frontend target group.

The frontend container serves the built SPA. For a browser path that is not a
physical static asset, the frontend service returns `index.html` so client-side
routing can resolve the route.

The backend exposes the browser-facing BFF API under `/api`.

Amazon Cognito is the identity provider. Browser redirects required by the
authorization flow may go to Cognito; business API traffic goes through the
BFF.

The backend is the only application component that connects to Aurora, S3,
SES, or SNS.

### 4.1 Local demo topology

The local demonstration (REQUIREMENTS section 20.1) is a second, non-deployed
topology on one machine:

```text
Browser --> Vite dev server (SPA, proxies /api) --> backend (APP_MODE=local)
                                                       |-- PostgreSQL (container)
                                                       |-- local files: attachments
                                                       '-- local files: email and event records
```

It differs from the AWS topology only at the external adapters. The same
domain and application code, HTTP API, database model, transactional outbox,
and authorization run in both. The adapter set is selected once at bootstrap by
the explicit `APP_MODE` value (`aws` by default, or `local`); no business code
branches on it. In `local` mode the identity adapter maps three fixed demo
tokens to the three roles, object storage is a local directory, and the email
and event adapters append records to local files. No AWS client is created in
`local` mode, and the AWS deployment never accepts the demo tokens. The
local topology is not a supported deployment.

## 5. Frontend architecture

The frontend is a React and TypeScript SPA organized by application feature
rather than by one global directory per technical artifact.

Target structure:

```text
frontend/src/
├── app/
│   ├── bootstrap/
│   ├── routing/
│   └── providers/
├── features/
│   ├── requests/
│   ├── approvals/
│   ├── attachments/
│   └── administration/
├── shared/
│   ├── auth/
│   ├── api/
│   ├── errors/
│   └── state/
└── main.tsx
```

Reusable visual components that are intentionally independent of the sample
domain live in `packages/ui`, not inside one feature.

A feature owns the screens, feature-specific components, form models, view
state, and feature-level client calls that belong to that business capability.

The frontend does not reproduce business authorization rules as a security
boundary. It may hide or disable controls for usability, but the backend
decides whether an operation is permitted.

The UI role state of the SPA comes from `GET /api/session`. The frontend does
not parse `cognito:groups` or other token claims to decide application roles,
and it does not duplicate the Cognito group mapping.

A browser reload reconstructs the current screen state from public GET APIs.
No supported screen depends on a value retained only from a previous screen
transition, an upload response, or another mutation response.

The frontend consumes the generated client in `packages/api-client`. It does
not hand-maintain a second copy of public request and response types.

## 6. Frontend screens

The sample application has the following screen groups.

### 6.1 Requester screens

- My Requests
- Create Request
- Request Detail
- Edit Draft Request
- Attachment management within an authorized request

The Request Detail screen rediscovers the attachment metadata of the request
through the attachment list endpoint.

### 6.2 Approver screens

- Approval Queue
- Request Review
- Approve
- Reject

The Request Review screen rediscovers the attachment metadata of the request
through the attachment list endpoint.

### 6.3 Administrator screens

- Request inspection
- Audit history inspection

There is no generic workflow designer, route designer, identity-administration
console, or dynamic BFF-routing console.

## 7. Shared UI library

`packages/ui` contains reusable React components that have no dependency on the
request and approval domain.

Examples include:

- application shell and page layout;
- form field wrappers;
- validation-message presentation;
- buttons and action groups;
- tables and lists;
- dialogs;
- loading indicators;
- empty states;
- error presentation; and
- user-visible notification components.

A component belongs in `packages/ui` only when its public behavior can be
described without referring to Request, Approval, Attachment, or another sample
domain concept.

Domain-aware components stay under the owning frontend feature.

The library is a reusable package, not copied boilerplate. An adopting
application may replace it, but code in this repository imports it as a normal
dependency.

## 8. Browser-facing API contract

`openapi/openapi.yaml` is the normative browser-facing HTTP contract.

The BFF implementation and generated frontend client both conform to that
contract.

The initial path families are:

```text
/api/requests
/api/requests/{requestId}
/api/requests/{requestId}/submit
/api/requests/{requestId}/approve
/api/requests/{requestId}/reject
/api/requests/{requestId}/attachments
/api/requests/{requestId}/attachments/{attachmentId}
/api/approvals
/api/admin/audit
/api/session
```

The path `/api/requests/{requestId}/attachments` carries both `GET`, which lists
the attachment metadata of a request, and `POST`, which uploads an attachment.
`/api/session` returns the current application identity for SPA presentation.

The exact methods, schemas, parameters, and status codes are defined in OpenAPI,
not duplicated normatively in this document.

Operations that change state use explicit business-action endpoints such as
`submit`, `approve`, and `reject` rather than encoding every transition as an
arbitrary status field update.

List endpoints use cursor pagination with a deterministic order.

For each list operation, the owning capability applies, in this order:

1. the visibility and state filter that belongs to the caller and the
   operation;
2. any optional query filter; and
3. the stable sort defined for that list, ending in a unique tie-break key.

Pagination is applied only after those steps. The cursor identifies the
position in the stable sort, is opaque to the client, and is never parsed by the
client. A malformed or incompatible cursor is a validation failure mapped to
`VALIDATION_ERROR`. Cursors do not expire.

The concrete query parameters, limits, response envelope, and sort order of each
list endpoint are defined in OpenAPI.

## 9. API error model

Expected API failures use `application/problem+json` based on Problem Details.

The application extends the standard shape with stable application fields:

```json
{
  "type": "about:blank",
  "title": "Invalid state transition",
  "status": 409,
  "detail": "The request is not in a state that can be approved.",
  "instance": "/api/requests/...",
  "code": "REQUEST_INVALID_STATE",
  "traceId": "..."
}
```

`code` is the stable machine-readable application error identifier.

`traceId` correlates the client-visible error with structured server logs.

NestJS exception class names, Java class names, AWS SDK exception names, SQL
driver messages, stack traces, and credentials are never part of the public
error contract.

The BFF maps expected failures to the appropriate HTTP status and problem
details. Unexpected failures become an internal-server-error problem response
and retain diagnostic detail only in server-side logs.

## 10. Authentication flow

The current identity provider is Amazon Cognito.

The browser uses OAuth 2.0 Authorization Code flow with PKCE against Cognito.
The authorization request asks for the `openid email` scopes.

```text
Browser SPA
    |
    | authorization request + PKCE
    v
Amazon Cognito
    |
    | authorization code
    v
Browser SPA
    |
    | token request + verifier
    v
Amazon Cognito
    |
    | access token
    v
Browser SPA
    |
    | Authorization: Bearer <access token>
    v
BFF
```

The SPA does not contain a client secret.

### 10.1 Access-token validation

The BFF validates the bearer access token before executing an authenticated
business operation. At minimum it verifies that:

- the signature is valid against the JWKS of the configured Cognito user pool;
- the signing key identified by the token `kid` exists in the configured
  issuer JWKS;
- the JWT `iss` equals the configured Cognito user-pool issuer;
- the JWT `client_id` equals the configured SPA app-client ID;
- the JWT `token_use` equals `access`; and
- the JWT `exp` is in the future.

An implementation that only decodes the token without verifying the signature is
not permitted.

A request whose token fails validation, or that has no token, receives
`401 AUTHENTICATION_REQUIRED`.

The BFF does not accept an ID token as the basis for authorization.

### 10.2 Application identity

After validation the BFF passes an application identity value, not an AWS SDK
object, to the rest of the application. The identity has:

- `subject`: the `sub` claim of the validated access token;
- `roles`: the application roles derived from the `cognito:groups` claim of the
  validated access token; and
- `email`: a verified email address obtained as described in section 10.3,
  where an operation needs it.

Roles are determined only from the validated access token. A role field supplied
by the browser is never trusted.

The mapping from Cognito group to application role uses exact group names:

| Cognito group | Application role |
| --- | --- |
| `Requester` | Requester |
| `Approver` | Approver |
| `Administrator` | Administrator |

A user who belongs to several of these groups holds the union of the
permissions of those roles.

The BFF derives the roles. The SPA reads the roles of the current session from
`GET /api/session`; role visibility in the frontend is presentation only, and
the backend remains the authorization authority.

An authenticated user who belongs to none of these groups holds no application
role. Every operation that requires a role fails for that user with
`403 FORBIDDEN`.

### 10.3 Verified email

The Cognito identity adapter obtains the email address by calling the Cognito
UserInfo endpoint with the validated access token. The address becomes the
identity `email` only when all of the following hold:

- the `sub` returned by UserInfo equals the `sub` of the validated token;
- `email` is present and non-empty; and
- `email_verified` is `true`.

Creating a request requires a verified email. If the condition is not met, the
operation fails with `403 FORBIDDEN`.

A failure to reach UserInfo is reported as
`503 IDENTITY_PROVIDER_UNAVAILABLE`; a UserInfo authentication failure is
reported as `401 AUTHENTICATION_REQUIRED`.

On request creation the verified email is stored on the request record as the
internal field `requester_email`. It is not exposed in the browser-facing
`Request` schema and is not written to ordinary logs or to audit `details`.

### 10.4 SPA token lifecycle

The SPA keeps the access token, and a refresh token when one is issued, in
browser memory only. It does not store either token in `localStorage`,
`sessionStorage`, IndexedDB, or an application-managed persistent cookie.

Before the access token expires, the SPA attempts to refresh it when a refresh
token is available.

The SPA discards its in-memory tokens and moves to the signed-out state, from
which the user starts a new Authorization Code with PKCE flow, when:

- no refresh token is available;
- a refresh attempt fails;
- the BFF returns `401 AUTHENTICATION_REQUIRED`; or
- the in-memory tokens are lost, for example by a page reload.

If a Cognito SSO session still exists, a new authorization started by the user
may complete without prompting for credentials.

Cognito-specific token parsing and validation belong to the identity
infrastructure adapter.

The authoritative refinement of the authentication flow, token validation,
verified email, SPA session, and sign-out behavior is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) sections 6 and 7,
and of the session API, SPA bootstrap, and browser state reconstruction in
sections 22 and 23.

## 11. Authorization model

Authorization is enforced in two stages.

### 11.1 BFF authorization

The BFF enforces coarse-grained access to browser-facing operations by
application role, as determined in section 10.2.

- Creating a request requires the Requester role.
- The approval queue, approve, and reject require the Approver role.
- The audit list requires the Administrator role.
- Listing requests requires the Requester or the Administrator role.

### 11.2 Capability authorization

The owning business capability enforces rules that depend on ownership and
business state. "Own" means that the request `requesterId` equals the identity
`subject`.

A missing resource is reported as `404`. A resource that exists but that the
caller is not permitted to use is reported as `403 FORBIDDEN`. A permitted
caller that requests an operation not valid for the current state receives
`409 REQUEST_INVALID_STATE`.

The Administrator role is not a superuser. It grants read access and audit
access only. A user who holds the Administrator role alone cannot create,
update, submit, approve, or reject a request. When a user holds further roles,
the permissions of those roles are added.

### 11.3 Permission matrix

| Operation | Requester | Approver | Administrator |
| --- | --- | --- | --- |
| `GET /api/requests` | own requests only | not permitted | all requests |
| `POST /api/requests` | permitted | not permitted | not permitted |
| `GET /api/requests/{requestId}` | own request, any state | `SUBMITTED` requests only | any request |
| `PUT /api/requests/{requestId}` | own request in `DRAFT` | not permitted | not permitted |
| `POST /api/requests/{requestId}/submit` | own request in `DRAFT` | not permitted | not permitted |
| `GET /api/approvals` | not permitted | `SUBMITTED` requests | not permitted |
| `POST /api/requests/{requestId}/approve` | not permitted | request in `SUBMITTED` | not permitted |
| `POST /api/requests/{requestId}/reject` | not permitted | request in `SUBMITTED` | not permitted |
| `POST /api/requests/{requestId}/attachments` | own request in `DRAFT` | not permitted | not permitted |
| `GET /api/requests/{requestId}/attachments/{attachmentId}` | attachment of own request, any state | attachment of a `SUBMITTED` request | any attachment |
| `GET /api/requests/{requestId}/attachments` | attachments of own request, any state | attachments of a `SUBMITTED` request | attachments of any request |
| `GET /api/admin/audit` | not permitted | not permitted | permitted |
| `GET /api/session` | permitted | permitted | permitted |

"Not permitted" means `403 FORBIDDEN`. For an operation that is permitted only
in a given state, a request in another state yields `409 REQUEST_INVALID_STATE`
once ownership or role permits the caller to act on the request. An ownership
failure yields `403 FORBIDDEN`.

An attachment that does not actually belong to the `requestId` in the path is
reported as `404 ATTACHMENT_NOT_FOUND`.

A BFF authorization success does not bypass capability-level invariants.

`GET /api/session` is permitted to every authenticated caller, including a
caller with no application role, and returns an empty role list for such a
caller.

Frontend visibility is not an authorization decision.

The authoritative refinement of the authorization model is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md)
section 8.

## 12. Backend composition

The current backend is one NestJS application and one deployable container.

Its logical structure is:

```text
backend/src/
├── main.ts
├── bff/
│   ├── auth/
│   ├── context/
│   ├── routing/
│   ├── errors/
│   └── controllers/
├── capabilities/
│   ├── requests/
│   ├── approvals/
│   ├── attachments/
│   └── audit/
├── common/
│   ├── config/
│   ├── logging/
│   ├── errors/
│   └── persistence/
└── infrastructure/
    ├── aws/
    │   ├── cognito/
    │   ├── s3/
    │   ├── ses/
    │   └── sns/
    └── persistence/
```

The separation is logical. All current capability targets are local and run in
the same process.

The BFF controller layer does not inline unrelated domain rules. Business logic
may reside in the BFF deployment, as permitted by the requirements, but it is
implemented inside a capability boundary rather than directly in generic
routing or authentication code.

## 13. Capability internal structure

A business capability is organized into three conceptual layers:

```text
interface/BFF adapter
        |
        v
application
        |
        v
domain
        ^
        |
infrastructure adapters
```

For a current local capability, the BFF invokes its application service
directly.

The layers have these responsibilities.

### 13.1 Domain

The domain owns business state, state-transition rules, and invariants.

It does not:

- call AWS;
- read environment variables;
- know HTTP request or response objects;
- know NestJS controllers;
- open network connections; or
- emit user-facing HTTP errors directly.

### 13.2 Application

The application layer coordinates a use case.

It:

- loads domain state through repository ports;
- checks use-case authorization that belongs to the capability;
- invokes domain behavior;
- controls the local transaction boundary;
- writes audit records where the use case requires them;
- records notification or event intent in the outbox; and
- returns application results.

### 13.3 Infrastructure

Infrastructure adapters implement external boundaries:

- relational persistence;
- Cognito integration;
- S3 object storage;
- SES email delivery;
- SNS event publication; and
- future remote-service HTTP calls.

Provider-specific client types stop here.

## 14. Dependency direction

Dependency points toward application meaning and away from provider detail.

```text
BFF controllers
      |
      v
capability application services
      |
      v
domain
      ^
      |
application ports
      ^
      |
infrastructure adapters
```

The domain does not import application, BFF, persistence, or AWS modules.

Application code may depend on domain code and on application-defined ports.

Infrastructure code depends on those ports in order to implement them.

BFF code depends on application-facing capability interfaces. It does not
depend on concrete AWS adapters.

Configuration is resolved during application bootstrap and injected. Business
modules do not read process environment variables independently.

## 15. BFF capability routing

The BFF has a routing registry keyed by logical capability, not by concrete host
name.

A routing entry has one of two modes:

```text
local
remote
```

Conceptually:

```yaml
capabilities:
  requests:
    mode: local
  approvals:
    mode: local
  attachments:
    mode: local
  audit:
    mode: local
```

The current deployment uses `local` for every capability.

A future extraction changes only the deployment-time target definition:

```yaml
capabilities:
  requests:
    mode: remote
    baseUrl: ${REQUESTS_SERVICE_BASE_URL}
```

The exact configuration serialization may be environment-backed or file-backed,
but one resolved routing model is built during startup and is immutable for the
lifetime of the process.

There is no runtime CRUD API for routing.

There is no routing database.

There is no service discovery mechanism in the current design.

There is no hot reload of routing configuration.

Changing `local` to `remote`, changing a remote endpoint, or changing a
capability mapping requires a deployment or equivalent controlled
configuration rollout.

## 16. Local and remote capability dispatch

The BFF sees one capability-facing interface regardless of placement.

```text
                      +-------------------------+
BFF route ----------> | Capability Dispatcher   |
                      +------------+------------+
                                   |
                     +-------------+-------------+
                     |                           |
                  local                        remote
                     |                           |
                     v                           v
          Application Service            HTTP Client Adapter
             same process                 separate service
```

For `local`, dispatch is an in-process function or service call. The design
forbids making an HTTP request back into the same backend process only to mimic
a future remote boundary.

For `remote`, the adapter uses the internal service contract defined for that
future extraction.

The browser-facing OpenAPI contract remains at the BFF boundary. The SPA does
not switch URLs when a capability is extracted.

## 17. Current business modules

### 17.1 Requests

Owns:

- Request aggregate state;
- draft creation and update;
- submission;
- requester ownership rules; and
- request-level validation.

### 17.2 Approvals

Owns:

- approval queue queries;
- approve and reject use cases;
- Approver authorization;
- approval decision records; and
- approval state-transition coordination with the Request aggregate.

In the current single database, Requests and Approvals may participate in one
local transaction when a use case requires both to change atomically.

This does not imply that a future split service may share that transaction.

### 17.3 Attachments

Owns:

- attachment metadata;
- association between an attachment and a request;
- attachment metadata listing for a request, in a stable order, so that
  attachments remain discoverable after a reload;
- attachment authorization, including list authorization; and
- object-storage access through the object-storage port.

### 17.4 Audit

Owns:

- persisted business audit events;
- administrative audit queries; and
- immutable audit-history semantics.

It does not own application logs.

## 18. Request state model

The Request aggregate has these states:

```text
DRAFT
  |
  | submit
  v
SUBMITTED
  |      \
  |       \
approve   reject
  |         \
  v          v
APPROVED   REJECTED
```

Allowed transitions are:

| Current | Operation | Next | Actor |
| --- | --- | --- | --- |
| new | create | `DRAFT` | Requester |
| `DRAFT` | edit | `DRAFT` | authorized Requester |
| `DRAFT` | submit | `SUBMITTED` | authorized Requester |
| `SUBMITTED` | approve | `APPROVED` | authorized Approver |
| `SUBMITTED` | reject | `REJECTED` | authorized Approver |

`APPROVED` and `REJECTED` are terminal in the current sample.

An unsupported transition fails with a domain or application error that the BFF
maps to `REQUEST_INVALID_STATE`.

A status value is not accepted from the client as an unrestricted field update.

## 19. Relational data model

The current relational store is Amazon Aurora using the PostgreSQL-compatible
engine.

The logical tables are:

```text
requests
approvals
attachments
audit_events
outbox_deliveries
```

### 19.1 `requests`

Key fields:

- `id`
- `requester_id`
- `requester_email`
- `title`
- `description`
- `status`
- `version`
- `created_at`
- `updated_at`

`version` supports optimistic concurrency for state-changing operations.

`requester_id` holds the identity `subject` of the creating Requester.
`requester_email` holds the verified email address of that Requester at
creation time and is the recipient of notification email. It is an internal
field: it is not part of the browser-facing `Request` schema and is not written
to ordinary logs or audit `details`.

### 19.2 `approvals`

Key fields:

- `id`
- `request_id`
- `approver_id`
- `decision`
- `comment`
- `decided_at`

One terminal approval decision belongs to the corresponding submitted request
in the current sample.

### 19.3 `attachments`

Key fields:

- `id`
- `request_id`
- `object_key`
- `file_name`
- `media_type`
- `size_bytes`
- `uploaded_by`
- `created_at`

The binary object is not stored in Aurora.

### 19.4 `audit_events`

Key fields:

- `id`
- `request_id`
- `event_type`
- `actor_id`
- `from_state`
- `to_state`
- `details`
- `occurred_at`

`details` contains only audit-safe structured data and does not become a copy of
the whole request payload.

### 19.5 `outbox_deliveries`

Key fields:

- `id`
- `aggregate_id`
- `event_type`
- `channel`
- `payload`
- `status`
- `attempt_count`
- `next_attempt_at`
- `created_at`
- `delivered_at`
- `last_error`

`channel` distinguishes at least `EMAIL` and `EVENT`.

Separate delivery records prevent a successful SNS publication from being
treated as failed merely because the corresponding email delivery failed, and
vice versa.

The outbox provides at-least-once delivery intent. Exactly-once external
delivery is not claimed.

## 20. Local transaction boundaries

State transitions that require multiple relational writes use one Aurora
transaction.

### 20.1 Submit transaction

One local transaction performs:

```text
validate DRAFT and ownership
update request -> SUBMITTED
insert audit event
insert required outbox delivery records
commit
```

If any required relational write fails, none of them is committed.

### 20.2 Approve transaction

One local transaction performs:

```text
validate SUBMITTED and Approver authorization
update request -> APPROVED
insert approval decision
insert audit event
insert required outbox delivery records
commit
```

### 20.3 Reject transaction

The reject flow has the same boundary, producing `REJECTED` and a rejection
decision.

SES and SNS calls are never made inside these database transactions.

## 21. Concurrency control

A state-changing command on a request carries the version observed by the
caller, as defined in OpenAPI, and the capability performs an optimistic
concurrency check against it.

A transition succeeds only if the persisted version still matches the expected
version.

Concurrent approval or rejection attempts therefore do not both commit.

A concurrency conflict is exposed as a stable application error and mapped to a
conflict response rather than silently retrying a business decision.

The authoritative refinement of the processing order and of concurrency
behavior is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) sections 4 and 9.

## 22. Notification and event delivery

Notification intent is written to `outbox_deliveries` in the same local
transaction as the business state change that caused it.

### 22.1 Notified events

The business transitions that record outbox deliveries are:

- `REQUEST_SUBMITTED`;
- `REQUEST_APPROVED`; and
- `REQUEST_REJECTED`.

Each of these transitions records two delivery records in the same transaction:
one with channel `EMAIL` and one with channel `EVENT`.

Creating a request, updating a draft, and adding an attachment record no outbox
delivery in the current sample.

### 22.2 Processing

A background outbox processor runs within the current backend deployable.

```text
business transaction
      |
      | commit
      v
outbox_deliveries
      |
      v
background processor
      |
      +------ EMAIL ------> SES
      |
      +------ EVENT ------> SNS
```

The processor polls pending delivery records, claims work so the same record is
not processed concurrently by two workers, invokes the corresponding adapter,
and records the result.

A failed delivery does not roll back an already committed request transition.

A failed delivery remains retryable and records enough error information for
diagnosis without storing credentials or provider response bodies containing
private data.

Retry timing is configuration-driven and bounded. The defaults are defined in
[`POLICY.md`](POLICY.md).

Because the result of a network call can be uncertain, duplicate external
delivery is possible. Consumers of SNS events should use the stable outbox
delivery identifier as an idempotency key where they require de-duplication.

### 22.3 Email delivery

The recipient of an `EMAIL` delivery is the persisted `requests.requester_email`
of the request.

The email payload has at least:

- `to`;
- `eventType`;
- `requestId`;
- `title`; and
- `status`.

The subject is fixed per event type:

| `eventType` | Subject |
| --- | --- |
| `REQUEST_SUBMITTED` | `Request submitted` |
| `REQUEST_APPROVED` | `Request approved` |
| `REQUEST_REJECTED` | `Request rejected` |

The body contains at least the request ID, the request title, and the current
status. The body never contains the request description, an attachment name,
audit `details`, a credential, or a token.

### 22.4 SNS event delivery

The payload of an `EVENT` delivery is a JSON object with at least:

- `eventId`: the outbox delivery ID;
- `eventType`: `REQUEST_SUBMITTED`, `REQUEST_APPROVED`, or `REQUEST_REJECTED`;
- `occurredAt`: an RFC 3339 date-time;
- `requestId`: the request UUID;
- `actorId`: the identity `subject` of the acting user;
- `fromStatus`: the request status before the transition;
- `toStatus`: the request status after the transition; and
- `version`: the request version after the transition.

The SNS message body is this JSON payload. The SNS message attribute
`eventType` is set to the same event type.

`eventId` is a stable identifier that a downstream consumer can use as a
de-duplication key.

The authoritative refinement of notification payloads and of the outbox
lifecycle and recovery is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) sections 12 and 13.

## 23. Attachment flow

Attachments are transferred through the BFF so the browser does not directly
call S3 as an application data path.

Upload flow:

```text
Browser
   |
   | multipart upload
   v
BFF
   |
   | authorize request access
   v
Attachment capability
   |
   | stream object
   v
S3 adapter -> Amazon S3
   |
   | success
   v
insert attachment metadata + ATTACHMENT_ADDED audit event
in one Aurora transaction
```

The object key is generated by the backend and does not contain an untrusted
path supplied directly by the client.

If the S3 write fails, attachment metadata is not committed.

If S3 succeeds but the metadata insert fails, the application attempts a
best-effort deletion of the just-written object. Failure of that cleanup is
logged as an orphan-object condition and does not convert the failed attachment
operation into success.

Listing flow:

The attachment metadata of a request is listed through
`GET /api/requests/{requestId}/attachments`, with the same visibility as
download, in the stable order `createdAt` ascending then `id` ascending. The
list is the authoritative way to rediscover attachment identifiers after a
reload; an upload response is never the only source of an attachment identifier.

Download flow:

```text
Browser
   |
   v
BFF
   |
   | authorize request + attachment
   v
Attachment capability
   |
   v
S3 adapter
   |
   v
BFF streams object to Browser
```

The browser never receives reusable AWS credentials.

The authoritative refinement of attachment acceptance, storage, upload
finalization, and download headers is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) section 14,
and of attachment list authorization and ordering in sections 8.12 and 10.7.

## 24. AWS infrastructure adapters

Application-facing ports are defined by application needs, not by AWS SDK
shape.

Current ports include conceptual interfaces equivalent to:

```text
IdentityProvider
ObjectStorage
MailSender
EventPublisher
RequestRepository
ApprovalRepository
AttachmentRepository
AuditRepository
OutboxRepository
```

Current implementations are:

```text
IdentityProvider  -> Cognito adapter
ObjectStorage     -> S3 adapter
MailSender        -> SES adapter
EventPublisher    -> SNS adapter
repositories      -> Aurora persistence adapters
```

An AWS adapter converts provider-specific exceptions into application
infrastructure errors before they cross the boundary.

Business modules do not import Cognito, S3, SES, or SNS SDK client types.

No Azure or Google Cloud adapter exists in the current design.

## 25. Configuration

Configuration is resolved once during backend bootstrap.

Configuration groups include:

- HTTP and application settings;
- Cognito identity settings;
- Aurora connection settings;
- S3 bucket and object settings;
- SES sender settings;
- SNS topic settings;
- BFF capability routing; and
- outbox retry settings.

Environment variables or deployment-provided configuration may supply values,
but modules below bootstrap receive typed configuration objects rather than
reading the process environment themselves.

Secrets are injected by deployment and are never committed.

The secret-storage product and the AWS resource boundary are defined in
[`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) section 15.

BFF routing configuration is immutable after bootstrap.

The authoritative refinement of the required configuration and of bootstrap
failure behavior is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) section 16.

## 26. Logging

Application logs are structured records written to standard output or standard
error for container collection.

Every request receives or propagates a `traceId`.

Log records use, where applicable:

```text
timestamp
level
traceId
userId
operation
capability
message
```

Logs do not contain:

- bearer tokens;
- refresh tokens;
- client secrets;
- passwords;
- private keys;
- full file content; or
- full business payloads merely for convenience.

An infrastructure failure is logged at the boundary that can add useful
provider context, after secrets have been removed.

The BFF returns the `traceId` in problem responses so an operator can correlate
a user-visible error with server logs.

## 27. Audit

Audit events are written as business data in Aurora.

An audit event is inserted within the same local transaction as the state change
it records.

The audit event records what happened, who acted, when it happened, and the
relevant state transition.

### 27.1 Audit event types

The set of audit event types is closed:

- `REQUEST_CREATED`;
- `REQUEST_UPDATED`;
- `REQUEST_SUBMITTED`;
- `REQUEST_APPROVED`;
- `REQUEST_REJECTED`; and
- `ATTACHMENT_ADDED`.

### 27.2 Audited operations

An audit event is created by exactly these operations:

| Operation | `event_type` | `from_state` | `to_state` |
| --- | --- | --- | --- |
| create request | `REQUEST_CREATED` | null | `DRAFT` |
| update draft | `REQUEST_UPDATED` | `DRAFT` | `DRAFT` |
| submit request | `REQUEST_SUBMITTED` | `DRAFT` | `SUBMITTED` |
| approve request | `REQUEST_APPROVED` | `SUBMITTED` | `APPROVED` |
| reject request | `REQUEST_REJECTED` | `SUBMITTED` | `REJECTED` |
| add attachment | `ATTACHMENT_ADDED` | current request state | same current request state |

`actor_id` is the identity `subject` of the acting user.

Read-only operations create no audit event in the current sample. This covers
listing, retrieving, downloading an attachment, and reading the audit list.

The `details` of `ATTACHMENT_ADDED` contain at least `attachmentId`. No audit
`details` contain the full request payload, an email address, or binary content.

Adding an attachment writes the attachment metadata and its audit event in one
local transaction. It does not modify the request record, so the request
`version` and `updated_at` are unchanged by it.

### 27.3 Retention

Audit events are append-only through normal application behavior.

Operational log rotation or retention does not delete business audit history.

The administrative audit screen reads `audit_events`; it does not parse
application logs.

## 28. Health and readiness

The backend exposes two operational endpoints outside the business API contract:

```text
/health/live
/health/ready
```

`/health/live` reports that the process is running and shall not make remote
calls merely to prove liveness.

`/health/ready` reports whether the backend can serve business requests and may
check required local initialization and required infrastructure connectivity.

The ALB target-group health check uses readiness, not a business endpoint.

Health responses do not disclose credentials, connection strings, internal host
names, or stack traces.

The authoritative refinement of liveness and readiness behavior is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md)
section 17.

## 29. Frontend deployment behavior

The frontend build produces static assets.

The frontend container serves those assets and applies SPA fallback behavior:
unknown non-asset application paths return `index.html`.

Static assets with content hashes may be cached aggressively.

`index.html` is served in a way that permits a new deployment to become visible
without requiring users to clear long-lived asset caches.

The frontend receives only non-secret runtime configuration that is safe for a
browser.

A browser bundle never contains an AWS secret or backend database credential.

## 30. Backend deployment behavior

The backend container is stateless with respect to local filesystem state needed
for correctness.

Persistent business state lives in Aurora and S3.

The same container image may run more than one ECS/Fargate task behind the ALB.

Correctness therefore does not depend on in-memory state being shared between
requests or tasks.

The outbox processor uses database claiming or locking semantics so multiple
backend tasks do not intentionally process the same pending delivery at the
same time.

In-memory caches, if later introduced, must remain optional optimizations unless
a requirement explicitly changes this rule.

## 31. Standard CI pipeline

The standard CI pipeline is implemented with GitHub Actions.

The target workflow is `.github/workflows/ci.yml`.

The ordinary pull-request path requires no production AWS credentials.

Conceptual job order:

```text
checkout
   |
   v
install workspace dependencies
   |
   +--> format check
   +--> lint
   +--> type check
   +--> OpenAPI validation
   +--> unit tests
   +--> integration tests
   +--> frontend build
   +--> backend build
   +--> container build validation
```

Independent checks may run in parallel after dependency installation where the
chosen workflow structure supports it.

A required check fails when its own validation fails.

No CI step deploys to production as part of the standard validation pipeline.

Integration tests use local or ephemeral test dependencies and invented data.
They do not require live Cognito, S3, SES, SNS, or production Aurora.

## 32. Test boundaries

Tests follow the architectural boundaries.

### 32.1 Domain tests

Exercise state transitions and invariants with values only.

No network, database, filesystem, NestJS HTTP server, or AWS client is required.

### 32.2 Application tests

Exercise use-case coordination with repository and infrastructure ports
replaced by test doubles.

They verify transaction intent, audit creation, and outbox creation.

### 32.3 Backend integration tests

Exercise NestJS modules, persistence adapters, API mapping, and database
behavior against non-production test infrastructure.

They do not call live AWS application services in the ordinary CI path.

### 32.4 Contract tests

Validate that the BFF implementation and generated client remain compatible
with `openapi/openapi.yaml`.

### 32.5 Frontend tests

Exercise feature behavior and reusable UI behavior without treating hidden
controls as proof of authorization.

The semantics that the initial implementation must cover with automated tests
are in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) section 21.

## 33. Current request flow

A normal authenticated API call follows this path:

```text
Browser
   |
   | Bearer token + HTTP request
   v
ALB
   |
   v
BFF controller
   |
   +--> request context / traceId
   +--> Cognito-backed token validation
   +--> coarse authorization
   |
   v
Capability Dispatcher
   |
   | current mode = local
   v
Application Service
   |
   +--> domain behavior
   +--> repository ports
   +--> audit
   +--> outbox
   |
   v
Aurora transaction
   |
   v
application result
   |
   v
BFF response
   |
   v
Browser
```

External notification delivery occurs after the transaction through the outbox
processor.

## 34. Submit flow

```text
Requester SPA
   |
   | POST /api/requests/{id}/submit
   v
BFF
   |
   | authenticate + authorize
   v
Request application service
   |
   | load Request
   | verify ownership and DRAFT
   | transition to SUBMITTED
   |
   | BEGIN
   | update request + version
   | insert audit event
   | insert EMAIL outbox delivery
   | insert EVENT outbox delivery
   | COMMIT
   v
202/200-class success response according to OpenAPI
```

The concrete success status code is defined in OpenAPI.

The notification worker later sends the requested deliveries.

## 35. Approval flow

```text
Approver SPA
   |
   | POST /api/requests/{id}/approve
   v
BFF
   |
   | authenticate + authorize Approver
   v
Approval application service
   |
   | load Request
   | verify SUBMITTED
   |
   | BEGIN
   | update Request -> APPROVED
   | insert Approval
   | insert audit event
   | insert outbox deliveries
   | COMMIT
   v
success response
```

Rejection follows the same structure with `REJECTED`.

A concurrent state change results in a conflict rather than a second terminal
decision.

## 36. Failure handling

Failures are classified at the boundary that owns them.

### 36.1 Validation or business failure

Examples:

- malformed request;
- forbidden operation;
- missing request;
- invalid transition;
- optimistic concurrency conflict.

These are mapped to stable application errors and expected HTTP problem
responses.

### 36.2 Database failure

A required relational transaction is rolled back.

No audit or outbox row from that transaction is committed independently.

The client receives an infrastructure-class problem response without SQL
details.

### 36.3 S3 failure

The attachment operation fails.

The request or approval business state is not altered merely because an
attachment transfer failed.

### 36.4 SES or SNS failure

The business state remains committed.

The corresponding outbox delivery remains pending or failed according to the
retry state.

The failure is logged and is operationally visible.

### 36.5 Unexpected implementation failure

The BFF returns an internal error problem response with a `traceId`.

The server log retains the diagnostic detail needed by an operator.

The client never receives a raw stack trace.

The authoritative refinement of error precedence, external-failure mapping, and
the stable error-code set is in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) sections 4, 18, and 20.

## 37. Current deployment and future extraction boundary

The current design has one backend process:

```text
SPA -> BFF -> local Requests
           -> local Approvals
           -> local Attachments
           -> local Audit
```

A future deployment may extract one capability:

```text
SPA -> BFF -> remote Requests Service
           -> local Approvals
           -> local Attachments
           -> local Audit
```

The external browser path does not change.

The BFF routing configuration changes at deployment.

The extracted service owns its own runtime and may later own its own persistence
boundary.

A capability is not considered extracted merely because its source code is in a
different directory.

## 38. Future microservice target shape

The conceptual future shape is:

```text
                         +------------------+
SPA ------------------> | BFF              |
                         +--+----+----+------+
                            |    |    |
                            |    |    +------------+
                            |    |                 |
                            v    v                 v
                        Service A              Aggregator
                            |                     |
                            |                     +--> Service B
                            |                     +--> Service C
                            |
                            +--------+
                                     |
                                     v
                               Orchestrator
                                     |
                               +-----+-----+
                               |           |
                               v           v
                            Service B   Service C
```

This is a compatibility model, not the current deployable topology.

There is no `orchestrator` module, `aggregator` service, service registry, or
distributed transaction engine in the current implementation.

## 39. Future orchestrator boundary

The future orchestrator is responsible for a business process that cannot be
completed by one local transaction after capabilities have independent
transactional stores.

It may:

- issue commands to participating services;
- record process state;
- observe completed and failed steps;
- request compensating actions; and
- resume an interrupted process according to an explicitly designed state
  machine.

It does not convert independent stores into one distributed ACID transaction.

The concrete messaging system, compensation semantics, persistence model,
timeouts, retries, and recovery rules are deliberately undefined until a real
cross-service requirement exists.

No current code shall introduce speculative orchestrator abstractions solely to
prepare for this section.

## 40. Future aggregator boundary

The future aggregator exists when one browser-facing response requires data
owned by more than one independently deployed capability.

It may be:

- a module inside the BFF; or
- a separately deployed backend capability.

The choice is made when a concrete aggregation requirement exists.

The aggregator owns composition of service results for the client. The SPA does
not call several internal services and merge the results itself.

No separate aggregator is implemented in the current architecture.

## 41. Future Java backend compatibility

A future Java implementation is compatible when it can implement the same
language-neutral contracts.

The design therefore keeps these boundaries free from TypeScript-only meaning:

- browser-facing OpenAPI schemas;
- HTTP status and error semantics;
- persisted business status values;
- audit-event meaning; and
- future service contracts when they are introduced.

NestJS decorators, TypeScript class metadata, and Java annotations are
implementation details behind those contracts.

The current repository contains no Java runtime or Java build solely for future
compatibility.

## 42. Future cloud portability

AWS remains the only current deployment.

The application-facing ports make cloud-specific boundaries explicit so a
future provider can supply another adapter without rewriting domain behavior.

A future Azure or Google Cloud implementation would replace infrastructure
adapters and deployment definitions at those boundaries.

The design does not attempt to define a lowest-common-denominator cloud API.

Provider-neutrality applies where the application has a provider-independent
need; it does not require hiding every platform capability behind an arbitrary
wrapper.

No second-cloud code is included until that cloud is adopted as a current
requirement.

## 43. Template and framework ownership

The reference contains two kinds of reusable material.

### 43.1 Framework or library-owned material

Examples:

- `packages/ui`;
- generated API client machinery;
- common logging and error handling;
- infrastructure ports and adapters; and
- shared transaction and audit mechanisms where they are genuinely reusable.

Applications consume these through explicit interfaces or packages.

### 43.2 Template-owned material

Examples:

- the generic request and approval feature implementation;
- example pages;
- example route composition;
- example deployment configuration; and
- sample project wiring.

These demonstrate a starting structure and may be modified by an adopting
application.

The architecture does not require copied application-specific code to remain
synchronized with this reference after adoption.

## 44. Public repository boundary

Every design example uses generic terminology and invented data.

No module, document, environment-variable example, host name, role name, sample
record, diagram, or commit message depends on private organizational knowledge.

The architecture is explained by the requirements and this document alone.

Where an example needs a URL, account identifier, email address, object name, or
other environment value, it uses an obvious placeholder or a reserved example
domain rather than a real private value.

## 45. Architectural invariants

The following properties define the current architecture and may not be changed
as an incidental implementation detail:

1. The client is a React and TypeScript SPA.
2. The current backend is NestJS and TypeScript.
3. The browser-facing boundary is the BFF.
4. The current backend is one deployable application.
5. Current BFF capability routing is static for a deployment.
6. Runtime route administration is not supported.
7. The SPA does not know internal backend service locations.
8. Current business consistency is based on local Aurora transactions.
9. External notification delivery is outside the business database
   transaction.
10. Application logging and business audit history remain separate.
11. AWS SDK types do not become domain contracts.
12. OpenAPI is the normative browser-facing HTTP contract once introduced.
13. Current deployment is AWS only.
14. Java, microservices, orchestration, aggregation, Azure, and Google Cloud
   remain future directions until their requirements are explicitly adopted.
15. The repository remains understandable without private or internal
   information.

A change that deliberately alters one of these invariants must first update the
corresponding requirement and this design. It is not treated as a local
refactor.
