// backend/src/common/ports.ts: clock and identifier generator ports
//
// Description:
// Defines the Clock and IdGenerator ports with their system implementations,
// so that time and identifiers can be replaced in tests.
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
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { randomUUID } from 'node:crypto';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

export const systemClock: Clock = { now: () => new Date() };
export const randomIds: IdGenerator = { uuid: () => randomUUID() };
