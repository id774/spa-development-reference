// License: The GPL version 3, or LGPL version 3 (Dual License).
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ReferenceStack } from '../lib/reference-stack.js';

function synth(certificateArn?: string) {
  const app = new App();
  const stack = new ReferenceStack(app, 'Test', {
    appDomain: 'app.example.com',
    certificateArn,
    sesSenderAddress: 'noreply@example.com',
    cognitoDomainPrefix: 'spa-example',
    env: { account: '111111111111', region: 'ap-northeast-1' },
  });
  return Template.fromStack(stack);
}

describe('infrastructure', () => {
  const template = synth();

  it('creates the Cognito groups and a public SPA client with the authorization code flow', () => {
    for (const groupName of ['Requester', 'Approver', 'Administrator']) {
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: groupName });
    }
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email'],
      CallbackURLs: ['http://app.example.com/auth/callback'],
      LogoutURLs: ['http://app.example.com/signed-out'],
    });
  });

  it('routes /api/* to the backend and checks readiness', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: [{ Field: 'path-pattern', PathPatternConfig: { Values: ['/api/*'] } }],
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/health/ready',
      Port: 3000,
    });
  });

  it('runs frontend and backend on Fargate with an Aurora PostgreSQL cluster', () => {
    template.resourceCountIs('AWS::ECS::Service', 2);
    template.hasResourceProperties('AWS::ECS::Service', { LaunchType: 'FARGATE' });
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      StorageEncrypted: true,
      DeletionProtection: true,
    });
  });

  it('keeps the bucket private and the database credentials in Secrets Manager', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties('AWS::SecretsManager::Secret', Match.anyValue());
    const definitions = JSON.stringify(template.findResources('AWS::ECS::TaskDefinition'));
    expect(definitions).toContain('"Secrets"');
    expect(definitions).toContain('DB_PASSWORD');
  });

  it('defines a separate one-off migration task', () => {
    const tasks = Object.values(template.findResources('AWS::ECS::TaskDefinition'));
    const migrate = tasks.filter((task) => JSON.stringify(task).includes('migrate:deploy'));
    expect(migrate).toHaveLength(1);
  });

  it('grants least-privilege access', () => {
    const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('attachments/*');
    expect(policies).toContain('ses:SendEmail');
    expect(policies).toContain('sns:Publish');
    expect(policies).not.toContain('"s3:*"');
    expect(policies).not.toContain('"Action":"*"');
  });

  it('uses an HTTPS listener with a redirect when a certificate is supplied', () => {
    const secured = synth('arn:aws:acm:ap-northeast-1:111111111111:certificate/example');
    secured.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
    });
    secured.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: ['https://app.example.com/auth/callback'],
    });
  });
});
