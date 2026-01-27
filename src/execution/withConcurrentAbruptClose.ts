import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

const asyncDispose: typeof Symbol.asyncDispose =
  Symbol.asyncDispose /* c8 ignore start */ ??
  Symbol.for('Symbol.asyncDispose'); /* c8 ignore stop */

/**
 * Given an AsyncGenerator and provided functions, return an AsyncGenerator
 * which calls the given functions when the generator is abruptly closed,
 * calling the functions immediately even if the generator is paused.
 *
 * This is useful for allowing return and throw to trigger logic even if the
 * generator is paused on a pending await within a `next()` call (including
 * if that logic can cause that hanging `next()` call to return early).
 *
 * Errors from the provided functions are ignored.
 *
 * The provided functions should be idempotent, as they may be called
 * multiple times.
 */
export function withConcurrentAbruptClose<T>(
  generator: AsyncGenerator<T, void, void>,
  beforeReturn: () => PromiseOrValue<void>,
  beforeThrow: (error?: unknown) => PromiseOrValue<void> = beforeReturn,
): AsyncGenerator<T, void, void> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      return generator.next();
    },
    async return() {
      await ignoreErrors(beforeReturn);
      return generator.return();
    },
    async throw(error?: unknown) {
      await ignoreErrors(() => beforeThrow(error));
      return generator.throw(error);
    },
    async [asyncDispose]() {
      await ignoreErrors(beforeReturn);
      if (typeof generator[asyncDispose] === 'function') {
        await generator[asyncDispose]();
      }
    },
  };
}

function ignoreErrors(
  fn: () => PromiseOrValue<unknown>,
): PromiseOrValue<unknown> {
  try {
    const result = fn();
    if (isPromise(result)) {
      return result.catch(() => {
        // ignore error
      });
    }
  } catch {
    // ignore error
  }
}
