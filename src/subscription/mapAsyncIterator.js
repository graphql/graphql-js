import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator<T, U>(
  iterable: AsyncIterable<T> | AsyncGenerator<T, void, void>,
  callback: (T) => PromiseOrValue<U>,
  rejectCallback: (any) => U = (error) => {
    throw error;
  },
): AsyncGenerator<U, void, void> {
  // $FlowFixMe[prop-missing]
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator: any = iteratorMethod.call(iterable);
  let $return: any;
  let abruptClose;
  if (typeof iterator.return === 'function') {
    $return = iterator.return;
    abruptClose = (error: mixed) => {
      const rethrow = () => Promise.reject(error);
      return $return.call(iterator).then(rethrow, rethrow);
    };
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

  function mapReject(error: mixed) {
    try {
      return { value: rejectCallback(error), done: false };
    } catch (callbackError) {
      return abruptClose(callbackError);
    }
  }

  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */
  return ({
    next(): Promise<IteratorResult<U, void>> {
      return iterator.next().then(mapResult, mapReject);
    },
    return() {
      return $return
        ? $return.call(iterator).then(mapResult, mapReject)
        : Promise.resolve({ value: undefined, done: true });
    },
    throw(error?: mixed): Promise<IteratorResult<U, void>> {
      if (typeof iterator.throw === 'function') {
        return iterator.throw(error).then(mapResult, mapReject);
      }
      return Promise.reject(error).catch(abruptClose);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  }: $FlowFixMe);
}
