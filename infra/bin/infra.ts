// License: The GPL version 3, or LGPL version 3 (Dual License).
import { App } from 'aws-cdk-lib';
import { ReferenceStack } from '../lib/reference-stack.js';

const app = new App();

/** All deployment inputs are CDK context values; none of them is a secret. */
function context(name: string, fallback: string): string {
  const value: unknown = app.node.tryGetContext(name);
  return typeof value === 'string' && value !== '' ? value : fallback;
}

new ReferenceStack(app, 'SpaDevelopmentReference', {
  // Placeholder defaults keep `cdk synth` runnable without any AWS account.
  appDomain: context('appDomain', 'app.example.com'),
  certificateArn: app.node.tryGetContext('certificateArn') as string | undefined,
  sesSenderAddress: context('sesSenderAddress', 'noreply@example.com'),
  cognitoDomainPrefix: context('cognitoDomainPrefix', 'spa-reference-example'),
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] ?? 'ap-northeast-1',
  },
});
