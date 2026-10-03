// infra/lib/reference-stack.ts: AWS infrastructure stack of the reference application
//
// Description:
// Defines the AWS deployment of the current reference: the VPC, Cognito user
// pool with its groups and public SPA client, Aurora PostgreSQL with
// credentials in Secrets Manager, the private attachment bucket, the SNS
// topic, the Fargate services of the frontend and backend, a one-off migration
// task, and the application load balancer that routes /api/* to the backend
// and everything else to the SPA.
//
// Task roles follow least privilege, the backend always runs in aws mode, and
// normal startup never migrates. Nothing here deploys itself.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - AWS CDK v2
// - See infra/package.json for workspace dependencies
// - AWS CDK v2
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { Duration, RemovalPolicy, Stack, type StackProps, CfnOutput } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';

export interface ReferenceStackProps extends StackProps {
  /** Public host name of the application, for example app.example.com. */
  appDomain: string;
  /** ACM certificate for the HTTPS listener. Without it the listener is HTTP (non-production only). */
  certificateArn?: string | undefined;
  /** SES sender address; it must already be verified in the SES account. */
  sesSenderAddress: string;
  /** Prefix of the Cognito hosted UI domain. */
  cognitoDomainPrefix: string;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ASSET_EXCLUDES = [
  '**/node_modules',
  '**/dist',
  '**/cdk.out',
  '.git',
  '**/coverage',
  '.local',
];

/**
 * The AWS deployment of the current reference: ALB, ECS/Fargate (frontend and
 * backend), Aurora PostgreSQL, S3, Cognito, SNS, Secrets Manager, and IAM task roles.
 * Nothing here deploys itself; production deployment is outside the standard CI.
 */
export class ReferenceStack extends Stack {
  constructor(scope: Construct, id: string, props: ReferenceStackProps) {
    super(scope, id, props);
    const region = this.region;
    const scheme = props.certificateArn ? 'https' : 'http';
    const appOrigin = `${scheme}://${props.appDomain}`;

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'application', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // ---- Identity: Cognito user pool, groups, and the public SPA client ----
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    for (const groupName of ['Requester', 'Approver', 'Administrator']) {
      new cognito.CfnUserPoolGroup(this, `Group${groupName}`, {
        userPoolId: userPool.userPoolId,
        groupName,
      });
    }
    const userPoolDomain = userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: props.cognitoDomainPrefix },
    });
    const spaClient = userPool.addClient('SpaClient', {
      generateSecret: false,
      authFlows: {},
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: [`${appOrigin}/auth/callback`],
        logoutUrls: [`${appOrigin}/signed-out`],
      },
    });
    const cognitoBase = `https://${props.cognitoDomainPrefix}.auth.${region}.amazoncognito.com`;
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}`;

    // ---- Data and messaging ----
    const database = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_4,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('app'),
      defaultDatabaseName: 'spa_reference',
      writer: rds.ClusterInstance.serverlessV2('writer'),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      storageEncrypted: true,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });
    const databaseSecret = database.secret;
    if (databaseSecret === undefined) throw new Error('The database secret must be generated.');

    const bucket = new s3.Bucket(this, 'AttachmentBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const topic = new sns.Topic(this, 'EventTopic', { enforceSSL: true });

    // ---- Compute ----
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });
    const logGroup = (name: string) =>
      new logs.LogGroup(this, `${name}Logs`, {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      });

    const backendTask = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      cpu: 512,
      memoryLimitMiB: 1024,
    });
    // Least privilege: object access limited to the attachment prefix, one SES
    // identity, and one SNS topic. Cognito needs no AWS API permission.
    backendTask.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [bucket.arnForObjects('attachments/*')],
      }),
    );
    backendTask.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: [
          `arn:${this.partition}:ses:${region}:${this.account}:identity/${props.sesSenderAddress}`,
        ],
      }),
    );
    topic.grantPublish(backendTask.taskRole);

    const backendImage = ecs.ContainerImage.fromAsset(REPOSITORY_ROOT, {
      file: 'backend/Dockerfile',
      exclude: ASSET_EXCLUDES,
    });
    const backendEnvironment = {
      APP_MODE: 'aws',
      PORT: '3000',
      AWS_REGION: region,
      COGNITO_ISSUER: issuer,
      COGNITO_CLIENT_ID: spaClient.userPoolClientId,
      COGNITO_USERINFO_ENDPOINT: `${cognitoBase}/oauth2/userInfo`,
      S3_BUCKET: bucket.bucketName,
      SES_SENDER: props.sesSenderAddress,
      SNS_TOPIC_ARN: topic.topicArn,
      DB_HOST: database.clusterEndpoint.hostname,
      DB_PORT: String(database.clusterEndpoint.port),
      DB_NAME: 'spa_reference',
    };
    const databaseSecrets = {
      DB_USERNAME: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
    };
    backendTask.addContainer('backend', {
      image: backendImage,
      portMappings: [{ containerPort: 3000 }],
      environment: backendEnvironment,
      secrets: databaseSecrets,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'backend', logGroup: logGroup('Backend') }),
    });

    // Migrations are a separate one-off task: normal startup never migrates.
    const migrationTask = new ecs.FargateTaskDefinition(this, 'MigrationTask', {
      cpu: 512,
      memoryLimitMiB: 1024,
    });
    migrationTask.addContainer('migrate', {
      image: backendImage,
      command: ['npm', 'run', 'migrate:deploy', '-w', '@spa-ref/backend'],
      environment: backendEnvironment,
      secrets: databaseSecrets,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrate', logGroup: logGroup('Migration') }),
    });

    const frontendTask = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
    });
    frontendTask.addContainer('frontend', {
      image: ecs.ContainerImage.fromAsset(REPOSITORY_ROOT, {
        file: 'frontend/Dockerfile',
        exclude: ASSET_EXCLUDES,
      }),
      portMappings: [{ containerPort: 8080 }],
      // Browser-safe runtime configuration only; the SPA has no secret.
      environment: {
        COGNITO_CLIENT_ID: spaClient.userPoolClientId,
        COGNITO_AUTHORIZATION_ENDPOINT: `${cognitoBase}/oauth2/authorize`,
        COGNITO_TOKEN_ENDPOINT: `${cognitoBase}/oauth2/token`,
        COGNITO_LOGOUT_ENDPOINT: `${cognitoBase}/logout`,
        APP_REDIRECT_URI: `${appOrigin}/auth/callback`,
        APP_POST_LOGOUT_URI: `${appOrigin}/signed-out`,
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'frontend', logGroup: logGroup('Frontend') }),
    });

    const backendService = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition: backendTask,
      desiredCount: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
    });
    const frontendService = new ecs.FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition: frontendTask,
      desiredCount: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
    });
    database.connections.allowDefaultPortFrom(backendService, 'Backend to Aurora');
    database.connections.allowDefaultPortFrom(
      new ec2.Connections({ securityGroups: [migrationSecurityGroup(this, vpc)] }),
      'Migration task to Aurora',
    );

    // ---- Ingress: ALB routes /api/* to the backend and everything else to the SPA ----
    const alb = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
      dropInvalidHeaderFields: true,
    });
    const backendTargets = new elbv2.ApplicationTargetGroup(this, 'BackendTargets', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backendService],
      healthCheck: {
        path: '/health/ready',
        healthyHttpCodes: '200',
        interval: Duration.seconds(15),
      },
      deregistrationDelay: Duration.seconds(30),
    });
    const frontendTargets = new elbv2.ApplicationTargetGroup(this, 'FrontendTargets', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [frontendService],
      healthCheck: { path: '/healthz', healthyHttpCodes: '200', interval: Duration.seconds(15) },
      deregistrationDelay: Duration.seconds(30),
    });
    const listener = props.certificateArn
      ? alb.addListener('Https', {
          port: 443,
          certificates: [elbv2.ListenerCertificate.fromArn(props.certificateArn)],
          defaultTargetGroups: [frontendTargets],
        })
      : alb.addListener('Http', { port: 80, defaultTargetGroups: [frontendTargets] });
    listener.addTargetGroups('ApiRoute', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*'])],
      targetGroups: [backendTargets],
    });
    if (props.certificateArn) {
      alb.addListener('HttpRedirect', {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          permanent: true,
        }),
      });
    }

    new CfnOutput(this, 'LoadBalancerDnsName', { value: alb.loadBalancerDnsName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'SpaClientId', { value: spaClient.userPoolClientId });
    new CfnOutput(this, 'CognitoHostedUiDomain', { value: userPoolDomain.baseUrl() });
    new CfnOutput(this, 'MigrationTaskDefinitionArn', { value: migrationTask.taskDefinitionArn });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
  }
}

/** Security group for the one-off migration task. */
function migrationSecurityGroup(scope: Construct, vpc: ec2.IVpc): ec2.SecurityGroup {
  return new ec2.SecurityGroup(scope, 'MigrationSecurityGroup', {
    vpc,
    description: 'One-off database migration task',
    allowAllOutbound: true,
  });
}
