# Deployment guide

How the current AWS deployment is defined and deployed. The definition is the CDK application in [`infra/`](../infra/); this guide describes what it does today and nothing more. There is no automated deployment pipeline: CI only validates (it runs `cdk synth`), and a deployment is something you run yourself. Settings are listed in [`CONFIGURATION.md`](CONFIGURATION.md), runtime behavior in [`OPERATIONS.md`](OPERATIONS.md).

## 1. Prerequisites

- Node.js 24 and `npm ci` at the repository root.
- To synthesize only (`npm run synth`): nothing else. No AWS account is needed.
- To deploy:
  - an AWS account and an authenticated AWS CLI environment (credentials and region);
  - **Docker**, running locally: `cdk deploy` builds the two container images from `backend/Dockerfile` and `frontend/Dockerfile`;
  - CDK bootstrapping of the target account and region (`npx cdk bootstrap`), which the image assets require;
  - the public host name for the application (`appDomain`);
  - optionally an ACM certificate in the same region for HTTPS (`certificateArn`);
  - a verified SES sender identity for `sesSenderAddress`. The stack does not create or verify it, and the state of the SES account (for example sandbox restrictions on recipients) is outside the stack.

## 2. What the stack creates

The stack `SpaDevelopmentReference` ([`infra/lib/reference-stack.ts`](../infra/lib/reference-stack.ts)) creates:

| Area | Resources |
| --- | --- |
| Network | A VPC over two availability zones with public, private (with egress through one NAT gateway), and isolated subnets. |
| Ingress | An internet-facing Application Load Balancer. `/api/*` goes to the backend target group (health check `/health/ready`); every other path goes to the frontend target group (health check `/healthz`). |
| Frontend | An ECS Fargate service (two tasks) running the nginx image on port 8080. |
| Backend | An ECS Fargate service (two tasks) running the NestJS image on port 3000. |
| Database | An Aurora PostgreSQL-compatible cluster (Serverless v2, 0.5 to 4 ACU) in the isolated subnets, encrypted, with deletion protection. Its generated credentials are stored in a Secrets Manager secret. |
| Files | An S3 bucket for attachments with all public access blocked, S3-managed encryption, and TLS-only access. |
| Identity | A Cognito user pool (self sign-up disabled), the groups `Requester`, `Approver`, and `Administrator`, a hosted UI domain, and a public app client (no secret) using the authorization code flow with the `openid` and `email` scopes. |
| Messaging | An SNS topic that accepts TLS-only publishes. |
| IAM | The backend task role may read, write, and delete objects under `attachments/` in the bucket, send email from the configured SES identity, and publish to the topic. Database credentials are injected by ECS from Secrets Manager. |
| Logs | A CloudWatch log group per task definition (backend, frontend, migration), kept for one month. |
| Migration | A separate one-off task definition for database migrations (section 6). |

Task sizes: backend and migration 0.5 vCPU / 1 GiB, frontend 0.25 vCPU / 0.5 GiB. Services use a deployment circuit breaker with rollback.

## 3. Synthesize

```sh
npm run synth
```

This runs `cdk synth --quiet` in `infra/` using placeholder context values, so it works offline from AWS. CI runs it on every change. The application entry point is configured in `infra/cdk.json`.

## 4. Deploy

Run the CDK commands from `infra/`, passing the context values from [`CONFIGURATION.md`](CONFIGURATION.md), section 3:

```sh
cd infra
npx cdk bootstrap          # once per account and region
npx cdk deploy \
  -c appDomain=app.example.org \
  -c certificateArn=arn:aws:acm:<region>:<account-id>:certificate/<id> \
  -c sesSenderAddress=noreply@example.org \
  -c cognitoDomainPrefix=<unique-prefix>
```

Replace every value with your own; omit `certificateArn` for a non-production HTTP deployment. This guide does not deploy anything itself.

After the first deployment, in this order:

1. **Migrate the database** (section 6). Until this is done the backend answers `/health/ready` but the application cannot work.
2. **Create users and assign groups**: the user pool starts empty. Create users and add them to the `Requester`, `Approver`, or `Administrator` group (for example with `aws cognito-idp admin-create-user` and `admin-add-user-to-group` against the `UserPoolId` output; exact commands are in [`GETTING_STARTED.md`](GETTING_STARTED.md), section 7.4). A user needs a verified email address to create requests.
3. **DNS**: point `appDomain` at the `LoadBalancerDnsName` output. The stack does not manage DNS. The certificate, if any, must cover `appDomain`.
4. **Open the deployed application** at `https://<appDomain>/` (`http://` without a certificate).
5. **Continue with the demo**: [`GETTING_STARTED.md`](GETTING_STARTED.md), section 7 (Level 3) and the screen-by-screen [`USER_GUIDE.md`](USER_GUIDE.md).

A successful `cdk deploy` is not a completed demo. The stack creates no demo users, no DNS records, no SES identity verification, and no SNS subscription; the demo is complete only when the Level 3 criteria in [`GETTING_STARTED.md`](GETTING_STARTED.md), section 9, pass.

## 5. HTTPS

- With `certificateArn`: an HTTPS listener on port 443 with that certificate, and a listener on port 80 that redirects permanently to HTTPS.
- Without it: a single HTTP listener on port 80, intended for non-production use only.

## 6. Database migration

Starting the backend never applies migrations. The stack therefore defines a separate migration task definition that runs the committed migrations (`npm run migrate:deploy -w @spa-ref/backend`) with the same image, database settings, and Secrets Manager credentials as the backend, and then exits. Run it as a one-off Fargate task after the first deployment and after any deployment that adds migrations:

```sh
aws ecs run-task \
  --cluster <ClusterName output> \
  --launch-type FARGATE \
  --task-definition <MigrationTaskDefinitionArn output> \
  --network-configuration "awsvpcConfiguration={subnets=[<application subnet ids>],securityGroups=[<migration security group id>],assignPublicIp=DISABLED}"
```

The stack outputs the cluster and the task definition but not the network values. Use the private subnets that have egress (the subnet group named `application`) and the security group whose description is `One-off database migration task`; that group is the one the database allows. The task logs to the migration log group (stream prefix `migrate`). Nothing in the repository runs this task automatically.

## 7. Stack outputs

| Output | Value |
| --- | --- |
| `LoadBalancerDnsName` | DNS name of the load balancer. |
| `UserPoolId` | Cognito user pool ID. |
| `SpaClientId` | ID of the public SPA app client. |
| `CognitoHostedUiDomain` | Base URL of the Cognito hosted UI domain. |
| `MigrationTaskDefinitionArn` | The one-off migration task definition. |
| `ClusterName` | Name of the ECS cluster. |
