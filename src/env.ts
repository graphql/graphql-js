import { useDevelopmentInstanceOfCheck } from './jsutils/instanceOf.js';

export type Env = 'production' | 'development';

let env: Env | undefined;

export function setEnv(newEnv: Env): void {
  if (env !== undefined && env !== newEnv) {
    throw new Error(
      `Environment already set to "${env}", cannot be changed to "${newEnv}".`,
    );
  }
  env = newEnv;
  if (env === 'development') {
    useDevelopmentInstanceOfCheck();
  }
}

export function getEnv(): Env | undefined {
  return env;
}
