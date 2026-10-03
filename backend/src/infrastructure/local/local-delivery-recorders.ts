// backend/src/infrastructure/local/local-delivery-recorders.ts: local demo mail and event recorders
//
// Description:
// Records each email and each published event as one NDJSON line under
// <dataDir>/deliveries (local demo mode only), instead of calling SES or SNS.
//
// The records are read back by scripts/demo-deliveries.mjs. The outbox still
// runs in local mode; only the external providers are replaced.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { EventMessage, EventPublisher, MailMessage, MailSender } from '../../outbox/ports.js';

async function append(path: string, record: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

/** Records each sent email as a line in `<dataDir>/deliveries/email.ndjson` (local demo mode only). */
export class LocalMailSender implements MailSender {
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = resolve(dataDir, 'deliveries', 'email.ndjson');
  }

  async send(message: MailMessage): Promise<void> {
    await append(this.file, {
      timestamp: new Date().toISOString(),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

/** Records each published event as a line in `<dataDir>/deliveries/events.ndjson` (local demo mode only). */
export class LocalEventPublisher implements EventPublisher {
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = resolve(dataDir, 'deliveries', 'events.ndjson');
  }

  async publish(message: EventMessage): Promise<void> {
    let body: unknown = message.body;
    try {
      body = JSON.parse(message.body);
    } catch {
      // keep the raw body
    }
    await append(this.file, {
      timestamp: new Date().toISOString(),
      eventType: message.eventType,
      body,
    });
  }
}
