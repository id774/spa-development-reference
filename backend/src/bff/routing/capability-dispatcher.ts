// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { CapabilityName } from '../../common/config.js';
import type { AppServices, LocalCapabilities } from '../app-services.js';

/**
 * Resolves the target of each capability from the routing resolved at startup.
 * Every current target is `local`: an in-process call, never an HTTP request to
 * the same process. The mapping is immutable for the lifetime of the process.
 */
export class CapabilityDispatcher {
  private readonly routing: Readonly<Record<CapabilityName, 'local'>>;

  constructor(private readonly services: Pick<AppServices, 'routing' | 'capabilities'>) {
    this.routing = Object.freeze({ ...services.routing });
  }

  resolve<K extends CapabilityName>(name: K): LocalCapabilities[K] {
    if (this.routing[name] !== 'local') {
      throw new Error(`capability ${name} has no supported routing mode`);
    }
    return this.services.capabilities[name];
  }
}

export const DISPATCHER = Symbol('DISPATCHER');
