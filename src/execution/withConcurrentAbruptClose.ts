import { isPromise } from '../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

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
 */
export function withConcurrentAbruptClose<T>(
  generator: AsyncGenerator<T, void, void>,
  beforeReturn: () => PromiseOrValue<void>,
  beforeThrow: (error?: unknown) => PromiseOrValue<void> = beforeReturn,
): AsyncGenerator<T, void, void> {
  let completed = false;
  let abruptCloseRequested = false;

  const runAbruptCloseFn = (fn: () => PromiseOrValue<void>) => {
    if (completed || abruptCloseRequested) {
      return;
    }
    abruptCloseRequested = true;
    return ignoreErrors(fn);
  };

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      const result = generator.next();
      result
        .then((iteration) => {
          if (iteration.done) {
            completed = true;
          }
        })
        .catch(() => undefined);
      return result;
    },
    async return() {
      await runAbruptCloseFn(beforeReturn);
      return generator.return();
    },
    async throw(error?: unknown) {
      await runAbruptCloseFn(() => beforeThrow(error));
      return generator.throw(error);
    },
    async [asyncDispose]() {
      await runAbruptCloseFn(beforeReturn);
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
