import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { withConcurrentAbruptClose } from './withConcurrentAbruptClose.js';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterable<T, U>(
  iterable: AsyncGenerator<T> | AsyncIterable<T>,
  callback: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void> {
  const iterator = iterable[Symbol.asyncIterator]();
  const returnFn = iterator.return?.bind(iterator);
  const throwFn = iterator.throw?.bind(iterator);

  const onReturn = returnFn
    ? async () => {
        await callIgnoringErrors(returnFn);
      }
    : () => Promise.resolve();

  const onThrow = throwFn
    ? async (reason?: unknown) => {
        await callIgnoringErrors(() => throwFn(reason));
      }
    : onReturn;

  return withConcurrentAbruptClose(
    mapAsyncIterableImpl(iterable, callback),
    onReturn,
    onThrow,
  );
}

async function callIgnoringErrors(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    // ignore error
  }
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
