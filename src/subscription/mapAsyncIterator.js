import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator<T, U>(
  iterable: AsyncIterable<T> | AsyncGenerator<T, void, void>,
  callback: (T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void> {
  // $FlowFixMe[prop-missing]
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator: any = iteratorMethod.call(iterable);

  async function abruptClose() {
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch (_e) {
        /* ignore error */
      }
    }
  }

  async function mapResult(
    resultPromise: Promise<IteratorResult<T, void>>,
  ): Promise<IteratorResult<U, void>> {
    try {
      const result = await resultPromise;

      if (result.done) {
        return result;
      }

      return { value: await callback(result.value), done: false };
    } catch (callbackError) {
      abruptClose();
      throw callbackError;
    }
  }

  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */
  return ({
    next() {
      return mapResult(iterator.next());
    },
    async return() {
      return typeof iterator.return === 'function'
        ? mapResult(iterator.return())
        : { value: undefined, done: true };
    },
    async throw(error?: mixed): Promise<IteratorResult<U, void>> {
      if (typeof iterator.throw === 'function') {
        return mapResult(iterator.throw(error));
      }

      abruptClose();
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  }: $FlowFixMe);
}
