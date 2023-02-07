import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterable<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  valueCallback: (value: T) => PromiseOrValue<U>,
  finallyCallback: () => void,
): AsyncGenerator<U, R, void> {
  const iterator = iterable[Symbol.asyncIterator]();

  async function mapResult(
    result: IteratorResult<T, R>,
  ): Promise<IteratorResult<U, R>> {
    if (result.done) {
      finallyCallback();
      return result;
    }

    try {
      return { value: await valueCallback(result.value), done: false };
    } catch (error) {
      /* c8 ignore start */
      // FIXME: add test case
      if (typeof iterator.return === 'function') {
        try {
          await iterator.return();
        } catch (_e) {
          /* ignore error */
        }
      }
      throw error;
      /* c8 ignore stop */
    }
  }

  return {
    async next() {
      return mapResult(await iterator.next());
    },
    async return(): Promise<IteratorResult<U, R>> {
      // If iterator.return() does not exist, then type R must be undefined.
      const result =
        typeof iterator.return === 'function'
          ? await iterator.return()
          : { value: undefined as any, done: true };
      return mapResult(result);
    },
    async throw(error?: unknown) {
      if (typeof iterator.throw === 'function') {
        return mapResult(await iterator.throw(error));
      }
      finallyCallback();
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
