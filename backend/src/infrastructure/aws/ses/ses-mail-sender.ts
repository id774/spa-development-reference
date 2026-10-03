// backend/src/infrastructure/aws/ses/ses-mail-sender.ts: Amazon SES mail adapter
//
// Description:
// Implements the mail port with Amazon SES v2, sending UTF-8 plain-text email
// from the configured sender. The caller supplies an abort signal that bounds
// the provider call.
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
// - @aws-sdk/client-sesv2
// - A verified SES sender (aws mode only)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

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
