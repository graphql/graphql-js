/** @category Development Mode */

import { enableDevInstanceOf } from './jsutils/instanceOf.ts';

let devMode = false;

/**
 * Enables GraphQL.js development mode checks for this module instance.
 *
 * Production entry points leave development mode disabled by default. Call this
 * before constructing schemas or executing requests when additional development
 * diagnostics should run.
 * @example
 * ```ts
 * import { enableDevMode, isDevModeEnabled } from 'graphql/devMode';
 *
 * isDevModeEnabled(); // => false
 * enableDevMode();
 * isDevModeEnabled(); // => true
 * ```
 */
export function enableDevMode(): void {
  devMode = true;
  enableDevInstanceOf();
}

/**
 * Returns whether GraphQL.js development mode has been enabled for this module
 * instance.
 * @returns True when development mode is enabled.
 * @example
 * ```ts
 * import { enableDevMode, isDevModeEnabled } from 'graphql/devMode';
 *
 * enableDevMode();
 *
 * isDevModeEnabled(); // => true
 * ```
 */
export function isDevModeEnabled(): boolean {
  return devMode;
}
