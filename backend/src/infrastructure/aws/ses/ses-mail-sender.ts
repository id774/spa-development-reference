// License: The GPL version 3, or LGPL version 3 (Dual License).
import { SendEmailCommand, type SESv2Client } from '@aws-sdk/client-sesv2';
import type { MailMessage, MailSender } from '../../../outbox/ports.js';

/** SES adapter: UTF-8 plain-text email. */
export class SesMailSender implements MailSender {
  constructor(
    private readonly client: SESv2Client,
    private readonly sender: string,
  ) {}

  async send(message: MailMessage, options: { signal: AbortSignal }): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.sender,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: message.text, Charset: 'UTF-8' } },
          },
        },
      }),
      { abortSignal: options.signal },
    );
  }
}
