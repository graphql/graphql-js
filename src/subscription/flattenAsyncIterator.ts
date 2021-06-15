import { isAsyncIterable } from '../jsutils/isAsyncIterable';

type AsyncIterableOrGenerator<T> =
  | AsyncGenerator<T, void, void>
  | AsyncIterable<T>;

/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */
export function flattenAsyncIterator<T, AT>(
  iterable: AsyncIterableOrGenerator<T | AsyncIterableOrGenerator<AT>>,
): AsyncGenerator<T | AT, void, void> {
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator: any = iteratorMethod.call(iterable);
  let iteratorStack: Array<AsyncIterator<T>> = [iterator];

  async function next(): Promise<IteratorResult<T | AT, void>> {
    const currentIterator = iteratorStack[0];
    if (!currentIterator) {
      return { value: undefined, done: true };
    }
    const result = await currentIterator.next();
    if (result.done) {
      iteratorStack.shift();
      return next();
    } else if (isAsyncIterable(result.value)) {
      const childIterator = result.value[
        Symbol.asyncIterator
      ]() as AsyncIterator<T>;
      iteratorStack.unshift(childIterator);
      return next();
    }
    return result;
  }
  return {
    next,
    return() {
      iteratorStack = [];
      return iterator.return();
    },
    throw(error?: unknown): Promise<IteratorResult<T | AT>> {
      iteratorStack = [];
      return iterator.throw(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
