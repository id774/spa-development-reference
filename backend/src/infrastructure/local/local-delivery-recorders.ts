// License: The GPL version 3, or LGPL version 3 (Dual License).
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
