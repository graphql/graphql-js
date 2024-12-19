import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

/**
 * Given an AsyncIterable possibly containing additional AsyncIterables,
 * flatten all items into a single AsyncIterable.
 */
export function flattenAsyncIterable<TItem, TSingle, TInitial, TSubsequent>(
  iterable: AsyncIterable<TItem>,
  onValue: (maybeValueWithIterable: TItem) => {
    value: TSingle | TInitial;
    nestedIterable?: AsyncIterable<TSubsequent> | undefined;
  },
): AsyncGenerator<TSingle | TInitial | TSubsequent, void, void> {
  // You might think this whole function could be replaced with
  //
  //    async function* flattenAsyncIterable(iterable) {
  //      for await (const item of iterable) {
  //        yield item.value;
  //        yield* item.iterable;
  //      }
  //    }
  //
  // but calling `.return()` on the iterable it returns won't interrupt the `for await`.

  const topIterator = iterable[Symbol.asyncIterator]();
  let currentNestedIterator: AsyncIterator<TSubsequent> | undefined;
  let waitForCurrentNestedIterator: Promise<void> | undefined;
  let done = false;

  async function next(): Promise<
    IteratorResult<TSingle | TInitial | TSubsequent, void>
  > {
    if (done) {
      return { value: undefined, done: true };
    }

    try {
      if (!currentNestedIterator) {
        // Somebody else is getting it already.
        if (waitForCurrentNestedIterator) {
          await waitForCurrentNestedIterator;
          return await next();
        }
        // Nobody else is getting it. We should!
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
        const { resolve, promise } = promiseWithResolvers<void>();
        waitForCurrentNestedIterator = promise;
        const topIteratorResult = await topIterator.next();
        if (topIteratorResult.done) {
          // Given that done only ever transitions from false to true,
          // require-atomic-updates is being unnecessarily cautious.
          // eslint-disable-next-line require-atomic-updates
          done = true;
          return await next();
        }
        const { value, nestedIterable } = onValue(topIteratorResult.value);
        if (nestedIterable) {
          // eslint is making a reasonable point here, but we've explicitly protected
          // ourself from the race condition by ensuring that only the single call
          // that assigns to waitForCurrentNestedIterator is allowed to assign to
          // currentNestedIterator or waitForCurrentNestedIterator.
          // eslint-disable-next-line require-atomic-updates
          currentNestedIterator = nestedIterable[Symbol.asyncIterator]();
        }
        // eslint-disable-next-line require-atomic-updates
        waitForCurrentNestedIterator = undefined;
        resolve();
        return { value, done: false };
      }

      const rememberCurrentNestedIterator = currentNestedIterator;
      const nestedIteratorResult = await currentNestedIterator.next();
      if (!nestedIteratorResult.done) {
        return nestedIteratorResult;
      }

      // The nested iterator is done. If it's still the current one, make it not
      // current. (If it's not the current one, somebody else has made us move on.)
      if (currentNestedIterator === rememberCurrentNestedIterator) {
        currentNestedIterator = undefined;
      }
      return await next();
    } catch (err) {
      done = true;
      throw err;
    }
  }
  return {
    next,
    async return(): Promise<IteratorResult<TSingle | TInitial | TSubsequent>> {
      done = true;
      await Promise.all([
        currentNestedIterator?.return?.(),
        topIterator.return?.(),
      ]);
      return { value: undefined, done: true };
    },
    async throw(
      error?: unknown,
    ): Promise<IteratorResult<TSingle | TInitial | TSubsequent>> {
      done = true;
      await Promise.all([
        currentNestedIterator?.throw?.(error),
        topIterator.throw?.(error),
      ]);
      /* c8 ignore next */
      throw error;
    },
    [Symbol.asyncIterator]() {
      /* c8 ignore next */
      return this;
    },
  };
}
