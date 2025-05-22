import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterable<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  callback: (value: T) => PromiseOrValue<U>,
  onDone?: () => void,
): AsyncGenerator<U, R, void> {
  const iterator = iterable[Symbol.asyncIterator]();

  async function mapResult(
    promise: Promise<IteratorResult<T, R>>,
  ): Promise<IteratorResult<U, R>> {
    let value: T;
    try {
      const result = await promise;
      if (result.done) {
        onDone?.();
        return result;
      }
      value = result.value;
    } catch (error) {
      onDone?.();
      throw error;
    }

    try {
      return { value: await callback(value), done: false };
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
      return mapResult(iterator.next());
    },
    async return(): Promise<IteratorResult<U, R>> {
      // If iterator.return() does not exist, then type R must be undefined.
      return typeof iterator.return === 'function'
        ? mapResult(iterator.return())
        : { value: undefined as any, done: true };
    },
    async throw(error?: unknown) {
      if (typeof iterator.throw === 'function') {
        return mapResult(iterator.throw(error));
      }
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
