# spa-development-reference

A public reference implementation of a transactional business single-page application: a React and TypeScript SPA in front of a NestJS BFF/backend, running on AWS.

It demonstrates one supported way to compose these technologies and their cross-cutting concerns (authentication, authorization, API contract, transactions, auditing, notifications, files, configuration, CI, and deployment). It is a reference implementation, not a universal framework, and it makes no claim to fit every kind of web application. The sample domain is a generic request and approval application.

## Current capabilities

- **Requester**: create, edit, and submit requests; attach files to a draft.
- **Approver**: work an approval queue; approve or reject submitted requests.
- **Administrator**: read all requests and inspect the audit history.
- Attachment list, upload, and download.
- Cognito authentication (OAuth 2.0 Authorization Code with PKCE) and role-based authorization.
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

```sh
npm ci
npm run prisma:generate
cp .env.example .env     # then edit the placeholder values
set -a; . ./.env; set +a
npm run migrate:deploy   # applies the migrations to the database in DATABASE_URL
npm run dev -w @spa-ref/backend    # terminal 1
npm run dev -w @spa-ref/frontend   # terminal 2
```

Signing in locally needs a real Cognito user pool. See [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md) for the full procedure and [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md) for every setting.

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

Details, including the database that the backend tests need, are in [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md).

## Repository structure

| Path | Contents |
| --- | --- |
| `frontend/` | React SPA, nginx configuration, and its Dockerfile |
| `backend/` | NestJS BFF and capabilities, Prisma schema and migrations, and its Dockerfile |
| `packages/ui/` | Reusable React components |
| `packages/api-client/` | API client generated from the OpenAPI contract |
| `openapi/` | The browser-facing HTTP contract |
| `infra/` | AWS CDK application |
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
| [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md) | Local development and validation |
| [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md) | Configuration reference |
| [`doc/DEPLOYMENT.md`](doc/DEPLOYMENT.md) | Building and deploying the AWS stack |
| [`doc/OPERATIONS.md`](doc/OPERATIONS.md) | Runtime behavior for operators |

## Primary branch

`master`

## License

GPL version 3, or LGPL version 3 (Dual License). See [`doc/LICENSE.md`](doc/LICENSE.md), [`doc/COPYING`](doc/COPYING), and [`doc/COPYING.LESSER`](doc/COPYING.LESSER).
