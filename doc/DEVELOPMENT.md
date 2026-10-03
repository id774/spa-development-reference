# Development guide

The development workflow reference: how to run the application locally and how to validate a change. For first-time setup, the UI smoke check, and the end-to-end demo, start with [`GETTING_STARTED.md`](GETTING_STARTED.md); this document does not repeat that tutorial. For what the application is, see the [`README`](../README.md); for settings, see [`CONFIGURATION.md`](CONFIGURATION.md).

## 1. Prerequisites

- **Node.js 24** and npm (the root `package.json` requires `node >=24`; `.nvmrc` selects 24).
- **A PostgreSQL-compatible database** for the backend and for the backend tests. For the local demo, `compose.yaml` provides PostgreSQL 17 (`npm run demo`; Docker with Compose is required for that path). For development and tests, any PostgreSQL you can reach works; Docker is not otherwise required.
- **For the local demo**: Node.js 24 and an OS-level Docker installation
  providing Docker Engine, the `docker` CLI, and Docker Compose v2. Docker is
  not installed by `npm ci`; the same user that runs the demo must be able to
  run `docker --version`, `docker compose version`, and `docker info`
  successfully. Installation and first-time verification are documented in
  [`GETTING_STARTED.md`](GETTING_STARTED.md#21-verify-docker-before-installing-repository-dependencies).
  `npm run demo` (orchestrated by `scripts/demo.mjs`) re-checks the prerequisites
  and the ports `127.0.0.1:5173`, `3000`, and `55432`, starts PostgreSQL and
  waits until it is healthy, applies the migrations, runs the backend
  (`APP_MODE=local`) and the frontend, waits until both answer, and then prints
  the ready message. `npm run demo:setup` prepares only the database and
  migrations, `npm run demo:backend` runs only the backend,
  `npm run demo:down` stops PostgreSQL (data kept), `npm run demo:reset`
  removes the demo data, and `npm run demo:deliveries` prints the recorded
  emails and events. The data layout, pass criteria, and first-run
  troubleshooting are in [`GETTING_STARTED.md`](GETTING_STARTED.md), section 4.
- **For a sign-in against real AWS services**: a Cognito user pool, plus AWS access (S3, SES, SNS) when you exercise attachments or notifications. The automated tests need none of these; they use test doubles and a local PostgreSQL.

## 2. Install

```sh
npm ci
npm run prisma:generate
```

`npm ci` installs every workspace from `package-lock.json`. The Prisma client is generated into `backend/src/generated/` (ignored by Git), so run `npm run prisma:generate` once after installing and after any change to `backend/prisma/schema.prisma`. The backend `build`, `typecheck`, and `test` scripts run it for you; `dev` does not.

## 3. Workspace structure

| Workspace | Package | Purpose |
| --- | --- | --- |
| `frontend/` | `@spa-ref/frontend` | React SPA (Vite) |
| `backend/` | `@spa-ref/backend` | NestJS BFF, capabilities, outbox worker, Prisma |
| `packages/ui/` | `@spa-ref/ui` | Reusable React components, domain independent |
| `packages/api-client/` | `@spa-ref/api-client` | `fetch` client typed from the OpenAPI contract |
| `infra/` | `@spa-ref/infra` | AWS CDK application |

Run a workspace script with `npm run <script> -w <package>`.

## 4. Local database

1. Create an empty database, for example with `createdb spa_reference`.
2. Copy `.env.example` to `.env`, set `DATABASE_URL`, and export it into your shell (neither the backend nor the Prisma CLI loads `.env` on its own):

   ```sh
   cp .env.example .env
   set -a; . ./.env; set +a
   ```

3. Apply the migrations:

   ```sh
   npm run migrate:deploy
   ```

Two migration commands exist and they differ:

| Command | Use |
| --- | --- |
| `npm run migrate:deploy` | Applies the committed migrations in `backend/prisma/migrations/`. Use it for local setup, CI, and deployment. |
| `npm run migrate:dev -w @spa-ref/backend` | Development only: creates a new migration from schema changes and applies it. Needs permission to create a shadow database. |

Starting the backend never runs migrations. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the deployed equivalent. `npm run prisma:validate` checks `schema.prisma`.

## 5. Backend development

Set the required variables ([`CONFIGURATION.md`](CONFIGURATION.md), section 1) and export them as above, then:

```sh
npm run dev -w @spa-ref/backend
```

This runs `tsx watch src/main.ts` and listens on `PORT` (default `3000`). Invalid or missing required configuration stops the start-up with a message listing every problem. The outbox worker runs inside the same process. Useful endpoints:

- `GET /health/live`: the process is up.
- `GET /health/ready`: `200` when the database answers, otherwise `503`.

To run the compiled backend instead: `npm run build -w @spa-ref/backend`, then `npm run start -w @spa-ref/backend`.

## 6. Frontend development

```sh
npm run dev -w @spa-ref/frontend
```

Vite serves the SPA (by default at `http://localhost:5173`) and proxies `/api` to the backend on port 3000, so the browser sees the same path shape as in production. The browser reads its runtime configuration from `/config.json`; in development that is `frontend/public/config.json`, which selects the local demo (`authMode: "local"`). To sign in with Cognito instead, point it at a real Cognito app client (callback URL `http://localhost:5173/auth/callback`, sign-out URL `http://localhost:5173/signed-out`) and run the backend with the matching `COGNITO_*` values. See [`CONFIGURATION.md`](CONFIGURATION.md), section 2.

What the screens do for each role is described in [`USER_GUIDE.md`](USER_GUIDE.md).

That file is served to browsers, so it must never contain a secret: the SPA is a public client, and tokens are kept in browser memory only. Do not commit local edits of it.

## 7. API client generation

`openapi/openapi.yaml` is the source of truth for the HTTP contract. The client in `packages/api-client/src/generated/` is generated from it:

```sh
npm run api:generate   # regenerate
npm run api:check      # regenerate, then fail if the generated files differ from the index
```

Do not edit generated files by hand. Change the contract first, regenerate, and commit the result.

## 8. Validation commands

Run these from the repository root. They are the same checks CI runs.

| Check | Command |
| --- | --- |
| Format check (write with `npm run format`) | `npm run format:check` |
| Lint | `npm run lint` |
| Type check (all workspaces) | `npm run typecheck` |
| OpenAPI validation | `npm run openapi:lint` |
| Tests (all workspaces) | `npm test` |
| Build (all workspaces) | `npm run build` |
| Prisma schema validation | `npm run prisma:validate` |
| API client freshness | `npm run api:check` |
| CDK synthesis | `npm run synth` |

The backend tests include database tests. They read `TEST_DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/spa_test`), apply the migrations to that database before running, and truncate its tables between tests, so point it at a disposable database. Everything else uses test doubles and needs no AWS access.

## 9. CI

`.github/workflows/ci.yml` runs on pull requests and on pushes to `master`, with read-only repository permissions and no AWS credentials. It has two jobs:

- **verify**: Node 24 and a disposable PostgreSQL service. It installs from the lockfile, generates the Prisma client, then runs the API client freshness check, format check, lint, type check, OpenAPI validation, the tests, the frontend and backend builds, and Prisma schema validation. It validates the migrations against a fresh database (apply, then confirm the schema and the migrations agree), and finally runs `cdk synth`.
- **containers**: builds the frontend and backend Docker images.

Nothing in CI deploys.
