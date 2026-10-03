# Getting started

By the end of this guide, you can:

- verify the repository on a new machine;
- display the SPA in a browser;
- understand what is required for authenticated operation;
- prepare a complete deployed demo environment; and
- complete the representative end-to-end demo and know whether it passed.

Start here if you have just found the repository. Other documents go deeper: [`DEVELOPMENT.md`](DEVELOPMENT.md) (workflow reference), [`CONFIGURATION.md`](CONFIGURATION.md) (settings), [`DEPLOYMENT.md`](DEPLOYMENT.md) (AWS), [`OPERATIONS.md`](OPERATIONS.md) (runtime behavior), and [`USER_GUIDE.md`](USER_GUIDE.md) (using the application).

## 1. Three levels of verification

"It works" can mean three different things. This guide separates them.

| Level | Purpose | Needs |
| --- | --- | --- |
| **Level 1: Repository validation** | The code, tests, build, OpenAPI contract, migrations, and infrastructure definition are sound. | A machine with Node.js and a PostgreSQL database. No AWS. |
| **Level 2: UI smoke check** | The SPA itself renders in a browser. Not an authenticated test. | Node.js. No database, no AWS. |
| **Level 3: Full end-to-end demo** | Sign-in through Cognito and a representative workflow as Requester, Approver, and Administrator, on the real stack. | A deployed AWS environment. |

When you report a result, say which level you completed (section 10).

## 2. Clone and prerequisites

```sh
git clone https://github.com/id774/spa-development-reference.git
cd spa-development-reference
```

| Need | For |
| --- | --- |
| Git | Cloning. |
| Node.js 24 and npm | Every level. `.nvmrc` selects 24. |
| A PostgreSQL-compatible database | The automated tests in Level 1 (`npm test`) and the migration check. |
| Docker (optional) | A disposable PostgreSQL for Level 1 and the optional image builds. The repository does not require Docker. |
| An AWS account, with Cognito, Aurora, S3, SES, SNS, and ECS/Fargate through the CDK stack | Level 3 only. |

## 3. Install

From the repository root:

```sh
npm ci
npm run prisma:generate
```

Expected: both commands exit with code 0, the workspace dependencies are installed, and the Prisma client is generated into `backend/src/generated/`.

## 4. Level 1: Repository validation

### 4.1 Get a database

The backend tests read `TEST_DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/spa_test`), apply the migrations to it, and empty its tables between tests. Use a **disposable** database.

If you already have a PostgreSQL server, create an empty database such as `spa_test` and set `TEST_DATABASE_URL` to it.

*Optional convenience*, if Docker is available, a disposable PostgreSQL 17 that matches the default URL and CI:

```sh
docker run -d --name spa-ref-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=spa_test -p 5432:5432 postgres:17
docker exec spa-ref-postgres pg_isready -U postgres   # repeat until it reports "accepting connections"
```

Remove it when you are done: `docker rm -f spa-ref-postgres`.

### 4.2 Run the checks

Run these in order from the repository root. They are the same checks CI runs.

```sh
npm run api:check        # the generated API client is current
npm run format:check
npm run lint
npm run typecheck
npm run openapi:lint     # warnings are expected; errors are not
npm test                 # needs the database from 4.1
npm run build
npm run prisma:validate
npm run synth            # CDK synthesis; needs no AWS account
```

### 4.3 Migration validation

Apply the committed migrations to a **new, empty** database and confirm that the result matches the schema:

```sh
# with the optional Docker database from 4.1:
docker exec spa-ref-postgres psql -U postgres -c 'CREATE DATABASE spa_migrations'
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spa_migrations
npm run migrate:deploy
(cd backend && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code)
```

Expected: `All migrations have been successfully applied.` and then `No difference detected.` (exit code 0). With your own PostgreSQL, create `spa_migrations` yourself and adapt the URL.

### 4.4 Optional: container image builds

With Docker available, build both images from the repository root, as CI does:

```sh
docker build -f frontend/Dockerfile -t spa-ref-frontend:local .
docker build -f backend/Dockerfile -t spa-ref-backend:local .
```

### 4.5 Level 1 pass criteria

- [ ] dependency installation succeeds
- [ ] the API client is current (`api:check`)
- [ ] format, lint, and type checks pass
- [ ] OpenAPI validation passes
- [ ] automated tests pass
- [ ] frontend, backend, and workspace builds succeed
- [ ] the Prisma schema is valid
- [ ] the committed migrations apply to a clean database
- [ ] CDK synthesis succeeds
- [ ] both Docker image builds succeed, *if* you performed the Docker validation

## 5. Level 2: UI smoke check

This needs only the frontend:

```sh
npm run dev -w @spa-ref/frontend
```

Open `http://localhost:5173/`. Expected:

- the SPA loads and moves you to the signed-out screen (`/signed-out`);
- the heading **You are signed out**, the text "Sign in to continue.", and a **Sign in** button are visible.

`frontend/public/config.json` contains placeholder Cognito values (`https://auth.example.com/...`). Pressing **Sign in** sends the browser to that placeholder address, so **signing in cannot complete** in this setup. Level 2 confirms that the UI renders; it is not an authenticated end-to-end test.

## 6. Authenticated local development

To sign in on your own machine you must supply real services yourself. Nothing here is automatic, and the CDK stack does not provide a localhost configuration: its app client is registered for the deployed application's domain.

You need:

- a reachable PostgreSQL database with the migrations applied;
- a real Cognito user pool and a public app client (no secret) using the authorization code flow with the `openid` and `email` scopes, with these URLs registered:
  - callback: `http://localhost:5173/auth/callback`
  - sign-out: `http://localhost:5173/signed-out`
- the backend Cognito settings matching that pool (`COGNITO_ISSUER`, `COGNITO_CLIENT_ID`, `COGNITO_USERINFO_ENDPOINT`);
- the same client ID and the pool's endpoints in your **local, uncommitted** copy of `frontend/public/config.json` ([`CONFIGURATION.md`](CONFIGURATION.md), section 2);
- Cognito users in the `Requester`, `Approver`, and `Administrator` groups (section 7.4 shows the commands), with verified email addresses;
- AWS credentials with access to S3, SES, and SNS (and the matching `S3_BUCKET`, `SES_SENDER`, `SNS_TOPIC_ARN`), if you exercise attachments or notifications.

Then:

```sh
cp .env.example .env            # replace every placeholder value
set -a; . ./.env; set +a        # the backend and Prisma do not load .env themselves
npm run migrate:deploy
npm run dev -w @spa-ref/backend     # terminal 1: http://localhost:3000
npm run dev -w @spa-ref/frontend    # terminal 2: http://localhost:5173
```

Open `http://localhost:5173/`. Vite forwards `/api` to the backend. Confirm the backend with `curl http://localhost:3000/health/ready` (`{"status":"ok"}`). The walkthrough in section 8 then applies, with your own users.

For the complete experience with every AWS integration, the deployed environment of Level 3 is the recommended path.

## 7. Level 3: Full end-to-end demo

The recommended environment is a deployed one, because this reference demonstrates Cognito, Aurora, S3, SES, SNS, and ECS/Fargate working together, and those only exist on AWS. [`DEPLOYMENT.md`](DEPLOYMENT.md) has the details of each step; this is the order.

### 7.1 Preparation

1. `npm ci` (section 3).
2. Prepare the AWS account, region, and authenticated AWS CLI environment.
3. Verify an SES sender identity for the address you will use as `sesSenderAddress`. The stack does not do this. In the SES sandbox, recipients must also be verified: the Requester's email address receives the notification messages.
4. Decide `appDomain`. For HTTPS, have an ACM certificate for it in the same region and note its ARN. Without a certificate the stack serves plain HTTP, for non-production use only.
5. Have Docker running: deploying builds the container images.

### 7.2 Deploy

6. `npx cdk bootstrap` (once per account and region), then `npx cdk deploy` with the four context values, both from `infra/`. See [`DEPLOYMENT.md`](DEPLOYMENT.md), section 4.
7. Note the stack outputs (`LoadBalancerDnsName`, `UserPoolId`, `ClusterName`, `MigrationTaskDefinitionArn`).

### 7.3 Make it usable

8. Run the one-off database migration task and check it finishes successfully ([`DEPLOYMENT.md`](DEPLOYMENT.md), section 6).
9. Point DNS for `appDomain` at the load balancer. The stack does not manage DNS.

### 7.4 Create the demo users

The user pool starts empty. The stack does not create demo users. Create three, with email addresses you control, and put each in one group. The user name is the email address.

```sh
aws cognito-idp admin-create-user --user-pool-id <UserPoolId> --username <email> \
  --user-attributes Name=email,Value=<email> Name=email_verified,Value=true \
  --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id <UserPoolId> --username <email> \
  --password '<a password of your choice>' --permanent
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> --username <email> \
  --group-name <Requester|Approver|Administrator>
```

| Demo user | Group | Note |
| --- | --- | --- |
| Requester | `Requester` | Creating a request needs a **verified** email address, hence `email_verified=true`. |
| Approver | `Approver` | |
| Administrator | `Administrator` | |

Choose the passwords yourself (the pool requires at least 12 characters including lower case, upper case, and a digit; if Cognito rejects a password, follow its message). Do not reuse real credentials, and do not write them into the repository.

### 7.5 Open the application

10. Browse to `https://<appDomain>/` (or `http://`). You should see the signed-out screen. Check `curl <origin>/api/session` returns `401` JSON and the load balancer's backend target is healthy.
11. Continue with the walkthrough below.

A successful `cdk deploy` is not a completed demo: the demo is complete only when section 9 passes.

## 8. Demo walkthrough

The acceptance flow, in one line per step. Each screen and its result are described in [`USER_GUIDE.md`, section 7](USER_GUIDE.md#7-demo-tutorial).

**Requester**

1. Sign in as the Requester.
2. Confirm **My Requests**.
3. Create a request.
4. Confirm the state `DRAFT`.
5. Edit the draft.
6. Upload an accepted attachment (a small PDF, PNG, JPEG, or text file).
7. Confirm the attachment appears in the attachment list.
8. Download the attachment and confirm it opens.
9. Submit the request.
10. Confirm the state `SUBMITTED`.

**Approver**

1. Sign out, then sign in as the Approver.
2. Open **Approval Queue**.
3. Confirm the submitted request is listed.
4. Open it; this is **Request Review**.
5. Confirm the attachment is listed and can be downloaded.
6. Approve the request.
7. Confirm the state becomes `APPROVED`.

The rejection path can be checked with a second request: **Reject** instead of **Approve**, ending in `REJECTED`. The basic demo uses the approve path.

**Requester, again**

1. Sign out and sign in as the Requester.
2. Open the request.
3. Confirm the final state `APPROVED`.

**Administrator**

1. Sign out and sign in as the Administrator.
2. Open **All Requests** and the request (request inspection).
3. Open **Audit**.
4. Confirm these events for the request: `REQUEST_CREATED`, `REQUEST_UPDATED` (you edited the draft), `ATTACHMENT_ADDED`, `REQUEST_SUBMITTED`, and `REQUEST_APPROVED`.

## 9. Level 3 pass criteria

- [ ] application login succeeds
- [ ] the Requester can create and edit a draft
- [ ] attachment upload, list, and download work
- [ ] submission produces `SUBMITTED`
- [ ] the Approver sees the item in **Approval Queue**
- [ ] the Approver can approve it
- [ ] the Requester sees `APPROVED`
- [ ] the Administrator can inspect the request
- [ ] the Administrator can inspect the expected audit events
- [ ] backend readiness is healthy (the load balancer's backend target is healthy; `/health/ready` returns `{"status":"ok"}` when queried directly)

**Extended integration confirmation** (separate from the criteria above; the first two depend on conditions outside the application):

- *SES email.* Submit, approve, and reject each send one email to the address stored on the request (subject "Request submitted", "Request approved", or "Request rejected"). You can confirm receipt when the SES account and recipient conditions permit it (for example, a verified recipient in the sandbox).
- *SNS events.* Each of those transitions publishes one event to the SNS topic. The CDK stack creates **no** subscription, so nothing consumes the events by default, and the UI shows nothing about them. You can observe them only after you attach a subscription or consumer to the topic yourself.
- *Outbox state.* The `outbox_deliveries` table shows the delivery state (`DELIVERED` when sent; see [`OPERATIONS.md`](OPERATIONS.md), section 3).

## 10. What "done" means

- **Level 1 PASS**: the repository implementation validation is complete.
- **Level 2 PASS**: the SPA rendering smoke check is complete.
- **Level 3 PASS**: the representative application demo is complete.

If you say "everything works", say which level you mean.

## 11. Troubleshooting

For each symptom: the likely cause, the first thing to check, and where to read more. Longer procedures are in [`OPERATIONS.md`](OPERATIONS.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md).

| Symptom | Likely cause | Check first | Read |
| --- | --- | --- | --- |
| `npm test` cannot connect to PostgreSQL | No database at `TEST_DATABASE_URL`. | Is the server running and the URL right? `psql "$TEST_DATABASE_URL" -c 'select 1'` (the default is `postgresql://postgres:postgres@localhost:5432/spa_test`). | [`DEVELOPMENT.md`](DEVELOPMENT.md), section 8 |
| Backend exits with `Invalid configuration` | A required variable is missing or invalid. | The message lists every problem. Did you export `.env` into the shell? | [`CONFIGURATION.md`](CONFIGURATION.md), section 1 |
| `/health/ready` returns `503` | The database is unreachable. | `DATABASE_URL` or `DB_*`, network access, and credentials. A URL built from `DB_*` carries no connection parameters such as TLS options. | [`OPERATIONS.md`](OPERATIONS.md), sections 1 and 7 |
| The frontend shows a configuration error | `config.json` is missing a value or holds a non-URL. | `/config.json` in the browser. In a container, the six `COGNITO_*` / `APP_*` variables. | [`CONFIGURATION.md`](CONFIGURATION.md), section 2 |
| Sign-in goes to the wrong place or Cognito reports a callback mismatch | The app client's callback or sign-out URL does not match the application's origin; or placeholder `config.json` values. | The app client's registered URLs against `redirectUri` and `postLogoutUri`. | [`CONFIGURATION.md`](CONFIGURATION.md), sections 2 and 3 |
| Sign-in succeeds at Cognito but the application returns `401` | The backend validates the access token and rejects it: wrong `COGNITO_ISSUER` or `COGNITO_CLIENT_ID`. | The backend settings against the pool and app client. | [`CONFIGURATION.md`](CONFIGURATION.md), section 1 |
| The user has no business navigation, or gets `403` | The user is in none of the three groups (the application then shows a notice and no navigation), or the wrong one. | The user's Cognito groups; group names are exact and case-sensitive. | [`USER_GUIDE.md`](USER_GUIDE.md), section 1 |
| The Requester cannot create a request | No verified email address (`403`). | `email_verified` on the Cognito user. | [`DEPLOYMENT.md`](DEPLOYMENT.md), section 4 |
| An attachment operation returns `503` | Object storage is unavailable or not permitted. | `S3_BUCKET`, AWS credentials or task role, and the `object storage ... failed` log lines. | [`OPERATIONS.md`](OPERATIONS.md), sections 5 and 7 |
| Notification rows become `FAILED` | SES or SNS calls failed repeatedly. | `last_error` in `outbox_deliveries` and the `outbox delivery failed` log lines. | [`OPERATIONS.md`](OPERATIONS.md), section 3 |
| Email does not arrive | SES sandbox or an unverified sender or recipient. | Verification of `SES_SENDER` and of the recipient in SES. | [`DEPLOYMENT.md`](DEPLOYMENT.md), section 1 |
| `cdk deploy` cannot build image assets | Docker is not available or not running. | `docker info`. (`npm run synth` does not need Docker.) | [`DEPLOYMENT.md`](DEPLOYMENT.md), section 1 |
| `cdk deploy` fails on the Cognito domain | `cognitoDomainPrefix` is already taken in the region. | Choose another prefix. | [`CONFIGURATION.md`](CONFIGURATION.md), section 3 |
| The deployed host name does not resolve | DNS for `appDomain` is not set; the stack does not manage it. | A record or alias to the `LoadBalancerDnsName` output. | [`DEPLOYMENT.md`](DEPLOYMENT.md), section 4 |
