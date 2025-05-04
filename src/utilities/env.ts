export type Env = 'production' | 'development';

let env: Env = 'production';

export const setEnv = (newEnv: Env): void => {
  env = newEnv;
};

export const isProduction = (): boolean => env === 'production';
