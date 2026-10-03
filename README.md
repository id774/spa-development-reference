# spa-development-reference

A public reference implementation of a transactional business single-page application: a React and TypeScript SPA in front of a NestJS BFF/backend, running on AWS.

It demonstrates one supported way to compose these technologies and their cross-cutting concerns (authentication, authorization, API contract, transactions, auditing, notifications, files, configuration, CI, and deployment). It is a reference implementation, not a universal framework, and it makes no claim to fit every kind of web application. The sample domain is a generic request and approval application.

## Current capabilities

- **Requester**: create, edit, and submit requests; attach files to a draft.
- **Approver**: work an approval queue; approve or reject submitted requests.
- **Administrator**: read all requests and inspect the audit history.
- Attachment list, upload, and download.
- A fully local demo (`npm run demo`) with fixed demo identities, and Cognito authentication (OAuth 2.0 Authorization Code with PKCE) in the AWS deployment, with role-based authorization in both.
- Aurora PostgreSQL-compatible persistence with optimistic concurrency and local transactions.
- S3 attachment storage, SES email, and SNS event publication delivered through a transactional outbox.
- Business audit events and structured application logging, kept separate.
- CI, Docker images, and an AWS CDK deployment definition.

The current backend is a single deployable application, and AWS is the only supported cloud. Microservices, Java, other clouds, and similar directions are future concepts described in the requirements, not current features.

## Architecture

```text
Browser --- OAuth 2.0 + PKCE ---> Amazon Cognito
   |
 HTTPS
   v
Application Load Balancer
   |-- /api/*     --> backend (NestJS: BFF + local capabilities) --> Aurora, S3, SES, SNS
   '-- other paths --> frontend (static SPA)
```

The BFF is the browser-facing boundary. Requests, Approvals, Attachments, and Audit are capabilities called in process. See [`doc/BASIC_DESIGN.md`](doc/BASIC_DESIGN.md) and [`doc/DETAILED_DESIGN.md`](doc/DETAILED_DESIGN.md).

## Technology stack

Node.js 24 with npm workspaces; React, TypeScript, and Vite; NestJS; Prisma with PostgreSQL (Aurora PostgreSQL-compatible); AWS SDK for JavaScript v3; AWS CDK v2; OpenAPI 3.1; Vitest, React Testing Library, and Supertest. Versions are pinned by `package-lock.json`.

## Quick start

The first runnable path is a fully local demo. It needs no AWS account, Cognito, S3, SES, SNS, Aurora, ACM, DNS, external identity provider, API key, or `.env` file. Docker is required locally for PostgreSQL.

Prerequisites: Node.js 24 and Docker with Compose.

```bash
git clone https://github.com/id774/spa-development-reference.git
cd spa-development-reference
npm ci
npm run demo
```

Then open <http://localhost:5173/> and choose **Continue as Requester**, **Continue as Approver**, or **Continue as Administrator**. Sign out to switch roles. Create a request, attach a file, submit it, approve it as the Approver, and inspect the audit history as the Administrator.

Emails and events are recorded as local files under `.local/deliveries/`, and attachments under `.local/attachments/`. `npm run demo:down` stops PostgreSQL and keeps the data; `npm run demo:reset` removes the demo data.

The local demo uses fixed demo identities and no real authentication. It is for learning and evaluation only and must never be exposed beyond your machine. It reuses the same application logic, HTTP API, database model, transactional outbox, and authorization as the AWS deployment; only the external infrastructure adapters differ. The AWS deployment (`APP_MODE=aws`, the default) uses Cognito and never accepts the demo tokens.

Next steps, in [`doc/GETTING_STARTED.md`](doc/GETTING_STARTED.md): validate the repository without AWS (Milestone 2), and deploy the AWS stack (Milestone 3). To use the application, read [`doc/USER_GUIDE.md`](doc/USER_GUIDE.md).

## Validation

| Check | Command |
| --- | --- |
| Formatting | `npm run format:check` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| OpenAPI validation | `npm run openapi:lint` |
| Tests | `npm test` |
| Build | `npm run build` |
| API client freshness | `npm run api:check` |
| Prisma validation | `npm run prisma:validate` |
| CDK synthesis | `npm run synth` |

Details, including the database that the backend tests need, are in [`doc/GETTING_STARTED.md`](doc/GETTING_STARTED.md) and [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md).

## Repository structure

| Path | Contents |
| --- | --- |
| `frontend/` | React SPA, nginx configuration, and its Dockerfile |
| `backend/` | NestJS BFF and capabilities, Prisma schema and migrations, and its Dockerfile |
| `packages/ui/` | Reusable React components |
| `packages/api-client/` | API client generated from the OpenAPI contract |
| `openapi/` | The browser-facing HTTP contract |
| `infra/` | AWS CDK application |
| `compose.yaml`, `scripts/` | Local demo PostgreSQL and the demo commands |
| `doc/` | Specifications, guides, and license files |
| `.github/workflows/` | CI |

## Documentation

| Document | Responsibility |
| --- | --- |
| [`doc/REQUIREMENTS.md`](doc/REQUIREMENTS.md) | Purpose, scope, and what must exist |
| [`doc/BASIC_DESIGN.md`](doc/BASIC_DESIGN.md) | Architecture and responsibilities |
| [`doc/DETAILED_DESIGN.md`](doc/DETAILED_DESIGN.md) | Implementation-significant semantics |
| [`doc/POLICY.md`](doc/POLICY.md) | Implementation and maintenance rules |
| [`doc/INITIAL_SETUP.md`](doc/INITIAL_SETUP.md) | How to set up a new repository this way |
| [`openapi/openapi.yaml`](openapi/openapi.yaml) | The HTTP contract |
| [`doc/GETTING_STARTED.md`](doc/GETTING_STARTED.md) | First clone through verification and the full demo |
| [`doc/USER_GUIDE.md`](doc/USER_GUIDE.md) | How to use the application, by role |
| [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md) | Local development and validation |
| [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md) | Configuration reference |
| [`doc/DEPLOYMENT.md`](doc/DEPLOYMENT.md) | Building and deploying the AWS stack |
| [`doc/OPERATIONS.md`](doc/OPERATIONS.md) | Runtime behavior for operators |

## Primary branch

`master`

## License

GPL version 3, or LGPL version 3 (Dual License). See [`doc/LICENSE.md`](doc/LICENSE.md), [`doc/COPYING`](doc/COPYING), and [`doc/COPYING.LESSER`](doc/COPYING.LESSER).
