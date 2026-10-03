// infra/bin/infra.ts: AWS CDK application entry point
//
// Description:
// Bootstraps the CDK application and instantiates the ReferenceStack. All
// deployment inputs are CDK context values and none of them is a secret;
// placeholder defaults keep cdk synth runnable without an AWS account.
//
// The account and region come from the CDK environment variables, and the
// region defaults to ap-northeast-1. Deployment itself is outside the standard
// CI.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Build / Run:
//     npm run synth -w @spa-ref/infra
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - AWS CDK v2
// - See infra/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

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
