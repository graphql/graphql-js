import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

/**
 * Given an AsyncGenerator and a cleanup function, return an AsyncGenerator
 * which calls the given function when the generator closes.
 *
 * This is useful for ensuring cleanup logic is called immediately when the
 * generator's `return()` method is called, even if the generator is currently
 * paused, e.g. if a `await` is pending within the generator's `next()` method.
 */
export function withCleanup<T>(
  generator: AsyncGenerator<T, void, void>,
  onDone: () => PromiseOrValue<void>,
): AsyncGenerator<T, void, void> {
  let finished = false;
  const finish = async () => {
    if (!finished) {
      finished = true;
      await onDone();
    }
  };

  const asyncDispose: typeof Symbol.asyncDispose =
    Symbol.asyncDispose /* c8 ignore start */ ??
    Symbol.for('Symbol.asyncDispose'); /* c8 ignore stop */

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      try {
        const result = await generator.next();
        if (result.done) {
          await finish();
          return result;
        }
        return { value: result.value, done: false };
      } catch (error) {
        await finish();
        throw error;
      }
    },
    async return(): Promise<IteratorResult<T>> {
      await finish();
      return generator.return();
    },
    async throw(error?: unknown) {
      await finish();
      return generator.throw(error);
    },
    async [asyncDispose]() {
      await finish();
      if (typeof generator[asyncDispose] === 'function') {
        await generator[asyncDispose]();
      }
    },
  };
}
