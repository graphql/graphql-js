import { setInstanceOfCheckForEnv } from './jsutils/instanceOf.js';

export type Env = 'production' | 'development';

let env: Env | undefined;

export function setEnv(newEnv: Env): void {
  env = newEnv;
  setInstanceOfCheckForEnv(newEnv);
}

export function getEnv(): Env | undefined {
  return env;
}
