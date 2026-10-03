# Configuration reference

Every setting the implementation reads, with its default and validation. The code is the source: [`backend/src/common/config.ts`](../backend/src/common/config.ts) for the backend, [`frontend/src/app/config.ts`](../frontend/src/app/config.ts) for the browser, and [`infra/bin/infra.ts`](../infra/bin/infra.ts) for the AWS stack. A local sample is in [`.env.example`](../.env.example).

## 1. Backend

The backend resolves its configuration once at start-up from environment variables. Nothing below `main.ts` reads the environment. Invalid or missing required values fail the start-up and the message lists every problem found; nothing is silently corrected.

| Variable | Required | Default | Purpose | Secret |
| --- | --- | --- | --- | --- |
| `HOST` | no | `0.0.0.0` | Interface to listen on. | no |
| `PORT` | no | `3000` | Port to listen on. Integer `1`-`65535`. | no |
| `LOG_LEVEL` | no | `info` | Log level passed to the logger (`trace`, `debug`, `info`, `warn`, `error`, or `fatal`). | no |
| `DATABASE_URL` | one of the two database forms | none | Full PostgreSQL connection URL. Wins over `DB_*` when set. Passed to the driver unchanged. | yes (contains credentials) |
| `DB_HOST` | with `DB_*` | none | Database host. | no |
| `DB_PORT` | no | `5432` | Database port, used with `DB_*`. | no |
| `DB_NAME` | with `DB_*` | none | Database name. | no |
| `DB_USERNAME` | with `DB_*` | none | Database user. URL-encoded when the URL is built. | yes |
| `DB_PASSWORD` | with `DB_*` | none | Database password. URL-encoded when the URL is built. | yes |
| `COGNITO_ISSUER` | yes | none | Issuer URL of the Cognito user pool (`https://cognito-idp.<region>.amazonaws.com/<userPoolId>`). Trailing slashes are removed; the JWKS URL is `<issuer>/.well-known/jwks.json`. | no |
| `COGNITO_CLIENT_ID` | yes | none | App client ID that access tokens must carry as `client_id`. | no |
| `COGNITO_USERINFO_ENDPOINT` | yes | none | Cognito UserInfo endpoint URL, used to obtain the verified email. | no |
| `AWS_REGION` | yes | none | Region for the S3, SES, and SNS clients. | no |
| `S3_BUCKET` | yes | none | Bucket for attachment objects. | no |
| `SES_SENDER` | yes | none | From address of notification email. It must be a verified SES identity. | no |
| `SNS_TOPIC_ARN` | yes | none | Topic that receives the published events. | no |
| `ATTACHMENT_MAX_BYTES` | no | `10485760` (10 MiB) | Maximum attachment size. Integer `1`-`104857600` (100 MiB). | no |
| `OUTBOX_POLL_INTERVAL_MS` | no | `5000` | Delay between outbox polling cycles. Integer `>= 1`. | no |
| `OUTBOX_MAX_ATTEMPTS` | no | `5` | Automatic delivery attempts before a delivery becomes `FAILED`. Integer `1`-`20`. | no |
| `OUTBOX_RETRY_DELAYS_SECONDS` | no | `30,120,600,1800` | Comma-separated delay after each failed attempt. Positive integers, exactly `OUTBOX_MAX_ATTEMPTS - 1` values. | no |
| `OUTBOX_CLAIM_LEASE_SECONDS` | no | `60` | Lease of a claimed delivery. Integer `>= 1`, and longer than `OUTBOX_PROVIDER_TIMEOUT_MS`. | no |
| `OUTBOX_PROVIDER_TIMEOUT_MS` | no | `15000` | Timeout of one SES or SNS call. Integer `1`-`15000`. | no |
| `OUTBOX_BATCH_SIZE` | no | `10` | Deliveries claimed per cycle. Integer `1`-`100`. | no |
| `CAPABILITY_REQUESTS_MODE` | no | `local` | Routing of the Requests capability. | no |
| `CAPABILITY_APPROVALS_MODE` | no | `local` | Routing of the Approvals capability. | no |
| `CAPABILITY_ATTACHMENTS_MODE` | no | `local` | Routing of the Attachments capability. | no |
| `CAPABILITY_AUDIT_MODE` | no | `local` | Routing of the Audit capability. | no |

Notes:

- **Database**: with `DATABASE_URL` unset, the URL is built from `DB_HOST`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD` (all four must be set; `DB_PORT` defaults to `5432`). A URL built this way has no query parameters.
- **Capability mode**: `local` is the only supported value. Any other value, including `remote`, fails the start-up. Routing is fixed for the lifetime of the process.
- **AWS credentials** are not application settings. The AWS SDK finds them in its standard chain: the ECS task role when deployed, the environment or a profile locally.
- **Prisma CLI**: `backend/prisma.config.ts` reads `DATABASE_URL` or the same `DB_*` variables for `prisma migrate` and friends. When none is set it falls back to a placeholder URL so that `prisma generate` and `prisma validate` work without a database.
- **Tests**: `TEST_DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/spa_test`) is read by the backend test suite only. See [`DEVELOPMENT.md`](DEVELOPMENT.md).

## 2. Frontend runtime configuration

The SPA loads `/config.json` before it starts. If any value is missing or is not a URL where a URL is expected, the SPA shows a configuration error instead of starting. All values are browser-safe and public: **no secret belongs in this file**, and the SPA has no client secret.

| `config.json` key | Container environment variable | Purpose |
| --- | --- | --- |
| `cognito.clientId` | `COGNITO_CLIENT_ID` | Public app client ID. |
| `cognito.authorizationEndpoint` | `COGNITO_AUTHORIZATION_ENDPOINT` | Cognito authorization endpoint (`.../oauth2/authorize`). |
| `cognito.tokenEndpoint` | `COGNITO_TOKEN_ENDPOINT` | Cognito token endpoint (`.../oauth2/token`). |
| `cognito.logoutEndpoint` | `COGNITO_LOGOUT_ENDPOINT` | Cognito logout endpoint (`.../logout`). |
| `redirectUri` | `APP_REDIRECT_URI` | OAuth redirect URI, `<origin>/auth/callback`. |
| `postLogoutUri` | `APP_POST_LOGOUT_URI` | Return URI after sign-out, `<origin>/signed-out`. |

- **Development**: `frontend/public/config.json` is the file served by `npm run dev -w @spa-ref/frontend`. It contains placeholder values for `http://localhost:5173`. Edit it locally to use a real app client; do not commit real values.
- **Container**: the frontend image does not contain a `config.json`. At start-up `frontend/nginx/40-runtime-config.sh` renders it from `frontend/nginx/config.json.template` using the six environment variables above, and the container refuses to start if any is missing. The CDK stack supplies them (see [`DEPLOYMENT.md`](DEPLOYMENT.md)).
- Redirect and sign-out URIs must be registered on the Cognito app client; the CDK stack registers `<origin>/auth/callback` and `<origin>/signed-out`.

## 3. CDK context

The AWS stack takes four context values, set with `-c name=value` on the `cdk` command line or in `infra/cdk.json`. None of them is a secret. They are read in [`infra/bin/infra.ts`](../infra/bin/infra.ts).

| Context key | Default | Meaning |
| --- | --- | --- |
| `appDomain` | `app.example.com` | Public host name of the application. Used to build the Cognito callback and sign-out URLs. |
| `certificateArn` | none | ACM certificate for the HTTPS listener. With it the stack serves HTTPS on port 443, redirects port 80 to HTTPS, and builds `https` URLs. Without it the stack serves plain HTTP on port 80 and builds `http` URLs, which is meant for non-production use. |
| `sesSenderAddress` | `noreply@example.com` | SES sender address. Becomes the backend's `SES_SENDER` and the SES identity that the task role may send from. |
| `cognitoDomainPrefix` | `spa-reference-example` | Prefix of the Cognito hosted UI domain (`<prefix>.auth.<region>.amazoncognito.com`). It must be unique in the region. |

The placeholder defaults let `npm run synth` work without an AWS account. The stack's region is `CDK_DEFAULT_REGION` when set, otherwise `ap-northeast-1`; the account is `CDK_DEFAULT_ACCOUNT` when set.

## 4. Secrets

| Secret | Where it lives | How the application receives it |
| --- | --- | --- |
| AWS credentials | None in configuration. | The ECS task role (deployed) or the AWS SDK's standard chain (local). |
| Aurora username and password | AWS Secrets Manager (the secret generated for the Aurora cluster). | ECS injects them into the backend and migration containers as `DB_USERNAME` and `DB_PASSWORD`. |
| Browser configuration | Nowhere: it contains no secret. | `config.json` as described above. |

Real credentials must never be committed: not in source, in `.env.example`, in `frontend/public/config.json`, or in an image. `.env` files are ignored by Git. The backend's logger redacts token and secret fields, and logs contain no credentials.
