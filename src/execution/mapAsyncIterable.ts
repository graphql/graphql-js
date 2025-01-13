import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

/**
 * Given an AsyncIterable and a onValue function, return an AsyncIterator
 * which produces values mapped via calling the onValue function.
 */
export function mapAsyncIterable<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  onValue: (value: T) => PromiseOrValue<U>,
  onError: (error: any) => PromiseOrValue<U> = (error: any) => {
    throw error;
  },
  onDone?: (() => void) | undefined,
): AsyncGenerator<U, R, void> {
  const iterator = iterable[Symbol.asyncIterator]();

  let errored = false;

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
      errored = true;
      onDone?.();
      return { value: await onError(error), done: false };
    }

    try {
      return { value: await onValue(value), done: false };
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
      return errored
        ? Promise.resolve({ value: undefined as any, done: true })
        : mapResult(iterator.next());
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
