import { SYMBOL_ASYNC_ITERATOR } from '../polyfills/symbols';

import isAsyncIterable from '../jsutils/isAsyncIterable';

/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */
export default function flattenAsyncIterator<T>(
  iterable: AsyncGenerator<AsyncGenerator<T, void, void> | T, void, void>,
): AsyncGenerator<T, void, void> {
  // $FlowFixMe[prop-missing]
  const iteratorMethod = iterable[SYMBOL_ASYNC_ITERATOR];
  const iterator: any = iteratorMethod.call(iterable);
  let iteratorStack: Array<AsyncGenerator<T, void, void>> = [iterator];

  function next(): Promise<IteratorResult<T, void>> {
    const currentIterator = iteratorStack[0];
    if (!currentIterator) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return currentIterator.next().then((result) => {
      if (result.done) {
        iteratorStack.shift();
        return next();
      } else if (isAsyncIterable(result.value)) {
        const childIteratorMethod = result.value[SYMBOL_ASYNC_ITERATOR];
        const childIterator: any = childIteratorMethod.call(result.value);
        iteratorStack.unshift(childIterator);
        return next();
      }
      return result;
    });
  }
  return ({
    next,
    return() {
      iteratorStack = [];
      return iterator.return();
    },
    throw(error?: mixed): Promise<IteratorResult<T, void>> {
      iteratorStack = [];
      return iterator.throw(error);
    },
    [SYMBOL_ASYNC_ITERATOR]() {
      return this;
    },
  }: $FlowFixMe);
}
