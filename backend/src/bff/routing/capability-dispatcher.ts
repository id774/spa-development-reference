// backend/src/bff/routing/capability-dispatcher.ts: capability dispatcher
//
// Description:
// Resolves the target of each capability from the routing fixed at startup.
// Every current target is local: an in-process call, never an HTTP request to
// the same process.
//
// The mapping is frozen for the lifetime of the process, which preserves the
// extraction boundary defined by the basic design without building a remote
// router.
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
