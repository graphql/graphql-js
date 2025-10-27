import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { withCleanup } from './withCleanup.js';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterable<T, U>(
  iterable: AsyncGenerator<T> | AsyncIterable<T>,
  callback: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void> {
  return withCleanup(mapAsyncIterableImpl(iterable, callback), async () => {
    const iterator = iterable[Symbol.asyncIterator]();
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return(); /* c8 ignore start */
      } catch (_error) {
        // FIXME: add test case
        /* ignore error */
      } /* c8 ignore stop */
    }
  });
}

async function* mapAsyncIterableImpl<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  mapFn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void> {
  for await (const value of iterable) {
    const result = mapFn(value);
    if (isPromise(result)) {
      yield await result;
      continue;
    }
    yield result;
  }
}
