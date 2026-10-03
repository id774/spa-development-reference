// scripts/demo-deliveries.mjs: local demo delivery record reader
//
// Description:
// Prints, using Node.js built-ins only, the email and event records that the
// local demo backend wrote as NDJSON under .local/deliveries, in a
// human-readable form. Having no record yet is a normal state, not an error; a
// line that is not valid JSON is reported with the file and line number.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Usage:
//     npm run demo:deliveries
//
// Requirements:
// - Node.js 24 or later
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, '.local', 'deliveries');

async function readRecords(file) {
  const path = resolve(dir, file);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const records = [];
  text.split('\n').forEach((line, index) => {
    if (line.trim() === '') return;
    try {
      records.push(JSON.parse(line));
    } catch {
      throw new Error(
        `Cannot parse ${relative(root, path)} line ${index + 1}: not valid JSON.\n` +
          `  ${line.slice(0, 200)}\n` +
          'To discard the local records: npm run demo:reset',
      );
    }
  });
  return records;
}

function indent(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function printEmails(records) {
  console.log(`Email deliveries (.local/deliveries/email.ndjson): ${records.length}`);
  if (records.length === 0) {
    console.log('No local email deliveries recorded yet.');
    return;
  }
  for (const record of records) {
    console.log(`\n[${record.timestamp}]`);
    console.log(`  To:      ${record.to}`);
    console.log(`  Subject: ${record.subject}`);
    console.log('  Body:');
    console.log(indent(record.text));
  }
}

function printEvents(records) {
  console.log(`Event deliveries (.local/deliveries/events.ndjson): ${records.length}`);
  if (records.length === 0) {
    console.log('No local event deliveries recorded yet.');
    return;
  }
  for (const record of records) {
    const body = record.body !== null && typeof record.body === 'object' ? record.body : {};
    console.log(`\n[${record.timestamp}]`);
    console.log(`  eventType: ${record.eventType}`);
    console.log(`  requestId: ${body.requestId ?? '(none)'}`);
    if (body.fromStatus !== undefined || body.toStatus !== undefined) {
      console.log(`  state:     ${body.fromStatus ?? '-'} -> ${body.toStatus ?? '-'}`);
    }
  }
}

try {
  printEmails(await readRecords('email.ndjson'));
  console.log('');
  printEvents(await readRecords('events.ndjson'));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
