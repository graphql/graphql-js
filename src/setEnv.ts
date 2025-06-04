import { setInstanceOfCheckForEnv } from './jsutils/instanceOf.js';

export type Env = 'production' | 'development';

export function setEnv(newEnv: Env): void {
  setInstanceOfCheckForEnv(newEnv);
}
