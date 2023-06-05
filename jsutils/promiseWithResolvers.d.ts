import type { PromiseOrValue } from './PromiseOrValue.js';
/**
 * Based on Promise.withResolvers proposal
 * https://github.com/tc39/proposal-promise-with-resolvers
 */
export declare function promiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseOrValue<T>) => void;
  reject: (reason?: any) => void;
};
