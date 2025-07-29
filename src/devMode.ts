import { enableDevInstanceOf } from './jsutils/instanceOf.js';

let devMode = false;

export function enableDevMode(): void {
  devMode = true;
  enableDevInstanceOf();
}

export function isDevModeEnabled(): boolean {
  return devMode;
}
