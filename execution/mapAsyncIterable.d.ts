import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export declare function mapAsyncIterable<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  callback: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, R, void>;
