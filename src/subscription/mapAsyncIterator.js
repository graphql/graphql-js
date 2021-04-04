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

  async function abruptClose(error: mixed) {
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch (_e) {
        /* ignore error */
      }
    }
    throw error;
  }

  async function mapResult(result: IteratorResult<T, void>) {
    if (result.done) {
      return result;
    }

    try {
      return { value: await callback(result.value), done: false };
    } catch (callbackError) {
      return abruptClose(callbackError);
    }
  }

  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */
  return ({
    next(): Promise<IteratorResult<U, void>> {
      return iterator.next().then(mapResult, abruptClose);
    },
    return() {
      return typeof iterator.return === 'function'
        ? iterator.return().then(mapResult, abruptClose)
        : Promise.resolve({ value: undefined, done: true });
    },
    throw(error?: mixed): Promise<IteratorResult<U, void>> {
      if (typeof iterator.throw === 'function') {
        return iterator.throw(error).then(mapResult, abruptClose);
      }
      return Promise.reject(error).catch(abruptClose);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  }: $FlowFixMe);
}
