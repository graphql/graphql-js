import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator<T, U>(
  iterable: AsyncIterable<T> | AsyncGenerator<T, void, void>,
  callback: (T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void> {
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator: any = iteratorMethod.call(iterable);

  async function abruptClose(error: unknown) {
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch (_e) {
        /* ignore error */
      }
    }
    throw error;
  }

  async function mapResult(resultPromise: Promise<IteratorResult<T, void>>) {
    try {
      const result = await resultPromise;

      if (result.done) {
        return result;
      }

      return { value: await callback(result.value), done: false };
    } catch (callbackError) {
      return abruptClose(callbackError);
    }
  }

  return {
    next(): Promise<IteratorResult<U, void>> {
      return mapResult(iterator.next());
    },
    return() {
      return typeof iterator.return === 'function'
        ? mapResult(iterator.return())
        : Promise.resolve({ value: undefined, done: true });
    },
    throw(error?: unknown): Promise<IteratorResult<U, void>> {
      if (typeof iterator.throw === 'function') {
        return mapResult(iterator.throw(error));
      }
      return Promise.reject(error).catch(abruptClose);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as any; // FIXME: removed $FlowFixMe in TS conversion
}
