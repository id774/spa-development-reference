# spa-reference

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

The first runnable path is a fully local demo. After the dependencies and the PostgreSQL Docker image are downloaded, it needs no external account, cloud credential, or third-party service: no AWS, Cognito, S3, SES, SNS, API key, or `.env` file. (Cloning, `npm ci`, and the first image pull need network access.)

Prerequisites: Node.js 24 with npm, plus an operating-system-level Docker
installation that provides Docker Engine, the `docker` CLI, and Docker Compose
v2. Docker is not installed by `npm ci`. Before continuing, `docker --version`,
`docker compose version`, and `docker info` must all succeed. If Docker is not
installed or one of these checks fails, follow
[`doc/GETTING_STARTED.md`](doc/GETTING_STARTED.md#2-clone-and-prerequisites)
before running the demo.

```bash
git clone https://github.com/id774/spa-reference.git
cd spa-reference
npm ci
npm run demo
```

`npm run demo` checks the prerequisites, starts PostgreSQL, applies the migrations, starts the backend and the frontend, and prints `Local demo is ready.` only when all of them answer. Then open <http://127.0.0.1:5173/>.

You should see a sign-in screen with **Continue as Requester**, **Continue as Approver**, and **Continue as Administrator**. Create a request, attach a file, submit it, approve it as the Approver, and inspect the audit history as the Administrator. The acceptance walkthrough and the **Local demo PASS** checklist are in [`doc/GETTING_STARTED.md`](doc/GETTING_STARTED.md#4-milestone-1-local-demo); the screens are described in [`doc/USER_GUIDE.md`](doc/USER_GUIDE.md#7-demo-tutorial).

| Command | Effect |
| --- | --- |
| `Ctrl+C` | Stops the frontend and backend. The database and all data are kept; `npm run demo` resumes. |
| `npm run demo:down` | Stops the local database. The data is kept. |
| `npm run demo:reset` | Removes all local demo data, for a blank start. |
| `npm run demo:deliveries` | Shows the recorded emails and events. |

The local demo listens on `127.0.0.1` only, uses fixed demo identities and no real authentication, and is for learning and evaluation. It reuses the application logic, HTTP API, database model, transactional outbox, and authorization of the AWS deployment; only the external infrastructure adapters differ. The AWS deployment (`APP_MODE=aws`, the default) uses Cognito and never accepts the demo tokens.

### Local demo complete. What next?

| If you want to... | Go to |
| --- | --- |
| Validate the whole repository | [Milestone 2](doc/GETTING_STARTED.md#5-milestone-2-repository-validation), and the [Validation](#validation) table below |
| Start developing | [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md) |
| Understand configuration (local and AWS mode) | [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md) |
| Inspect or change the API contract | [`openapi/openapi.yaml`](openapi/openapi.yaml), then `npm run api:generate` and `npm run api:check` |
| Study the architecture | [`doc/BASIC_DESIGN.md`](doc/BASIC_DESIGN.md) and [`doc/DETAILED_DESIGN.md`](doc/DETAILED_DESIGN.md) |
| Deploy to AWS (the first step that needs an AWS account and credentials) | [`doc/DEPLOYMENT.md`](doc/DEPLOYMENT.md) |
| Operate or troubleshoot a running deployment | [`doc/OPERATIONS.md`](doc/OPERATIONS.md) |
| Learn the user workflow in detail | [`doc/USER_GUIDE.md`](doc/USER_GUIDE.md) |

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
| [`doc/VERSIONS`](doc/VERSIONS) | Repository version history |
| [`doc/INITIAL_SETUP.md`](doc/INITIAL_SETUP.md) | How to set up a new repository this way |
| [`openapi/openapi.yaml`](openapi/openapi.yaml) | The HTTP contract |
| [`doc/GETTING_STARTED.md`](doc/GETTING_STARTED.md) | First clone through verification and the full demo |
| [`doc/USER_GUIDE.md`](doc/USER_GUIDE.md) | How to use the application, by role |
| [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md) | Local development and validation |
| [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md) | Configuration reference |
| [`doc/DEPLOYMENT.md`](doc/DEPLOYMENT.md) | Building and deploying the AWS stack |
| [`doc/OPERATIONS.md`](doc/OPERATIONS.md) | Runtime behavior for operators |

## Primary Branch

This repository uses `master` as its primary branch name.

The name is used solely as a technical identifier, following the long-standing convention historically used by Git. It does not express or imply any association with racism, slavery, discrimination, or any political or social ideology.

## License

This repository is dual licensed under the [GPL version 3](https://www.gnu.org/licenses/gpl-3.0.html) or the [LGPL version 3](https://www.gnu.org/licenses/lgpl-3.0.html), at your option.
For full details, please refer to [doc/LICENSE.md](doc/LICENSE.md). See also [doc/COPYING](doc/COPYING) and [doc/COPYING.LESSER](doc/COPYING.LESSER) for the complete license texts.
