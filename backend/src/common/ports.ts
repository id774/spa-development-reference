// License: The GPL version 3, or LGPL version 3 (Dual License).
import { randomUUID } from 'node:crypto';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

export const systemClock: Clock = { now: () => new Date() };
export const randomIds: IdGenerator = { uuid: () => randomUUID() };
