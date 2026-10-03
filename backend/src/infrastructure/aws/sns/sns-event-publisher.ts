// backend/src/infrastructure/aws/sns/sns-event-publisher.ts: Amazon SNS event publisher adapter
//
// Description:
// Implements the event-publisher port with Amazon SNS. The message body is the
// JSON payload and the event type is carried as a message attribute. The
// caller supplies an abort signal that bounds the provider call.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
// - @aws-sdk/client-sns
// - An SNS topic (aws mode only)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import type { EventMessage, EventPublisher } from '../../../outbox/ports.js';

/** SNS adapter: the message body is the JSON payload; `eventType` is a message attribute. */
export class SnsEventPublisher implements EventPublisher {
  constructor(
    private readonly client: SNSClient,
    private readonly topicArn: string,
  ) {}

  async publish(message: EventMessage, options: { signal: AbortSignal }): Promise<void> {
    await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: message.body,
        MessageAttributes: {
          eventType: { DataType: 'String', StringValue: message.eventType },
        },
      }),
      { abortSignal: options.signal },
    );
  }
}
