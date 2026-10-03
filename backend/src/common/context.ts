// License: The GPL version 3, or LGPL version 3 (Dual License).
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  traceId: string;
  userId?: string;
  operation?: string;
  capability?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
