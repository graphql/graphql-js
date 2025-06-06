import { setInstanceOfCheckForEnv } from './jsutils/instanceOf.js';

import { setDefinitionNameCheckForEnv } from './type/definition.js';
import { setDirectiveNameCheckForEnv } from './type/directives.js';

export type Env = 'production' | 'development';

let env: Env | undefined;

export function setEnv(newEnv: Env): void {
  env = newEnv;
  setInstanceOfCheckForEnv(newEnv);
  setDefinitionNameCheckForEnv(newEnv);
  setDirectiveNameCheckForEnv(newEnv);
}

export function getEnv(): Env | undefined {
  return env;
}
