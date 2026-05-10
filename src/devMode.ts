import { enableDevInstanceOf } from './jsutils/instanceOf.ts';

let devMode = false;

export function enableDevMode(): void {
  devMode = true;
  enableDevInstanceOf();
}

export function isDevModeEnabled(): boolean {
  return devMode;
}
