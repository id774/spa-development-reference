// License: The GPL version 3, or LGPL version 3 (Dual License).
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
