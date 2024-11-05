import { isPromise } from './isPromise.js';
import type { PromiseOrValue } from './PromiseOrValue.js';

export interface FnCache<
  T extends (...args: Array<any>) => Exclude<any, Error | undefined>,
> {
  set: (
    result: ReturnType<T> | Error,
    ...args: Parameters<T>
  ) => PromiseOrValue<void>;
  get: (
    ...args: Parameters<T>
  ) => PromiseOrValue<ReturnType<T> | Error | undefined>;
}

export function withCache<
  T extends (...args: Array<any>) => Exclude<any, Error | undefined>,
>(
  fn: T,
  cache: FnCache<T>,
): (...args: Parameters<T>) => ReturnType<T> | Promise<Awaited<ReturnType<T>>> {
  return (...args: Parameters<T>) => {
    const maybeResult = cache.get(...args);
    if (isPromise(maybeResult)) {
      return maybeResult.then((resolved) =>
        handleCacheResult(resolved, fn, cache, args),
      );
    }

    return handleCacheResult(maybeResult, fn, cache, args);
  };
}

function handleCacheResult<
  T extends (...args: Array<any>) => Exclude<any, Error | undefined>,
>(
  cachedResult: Awaited<ReturnType<T>> | Error | undefined,
  fn: T,
  cache: FnCache<T>,
  args: Parameters<T>,
): Awaited<ReturnType<T>> {
  if (cachedResult !== undefined) {
    if (cachedResult instanceof Error) {
      throw cachedResult;
    }
    return cachedResult;
  }

  let result;
  try {
    result = fn(...args);
  } catch (error) {
    updateResult(error, cache, args);
    throw error;
  }

  updateResult(result, cache, args);
  return result;
}

function updateResult<
  T extends (...args: Array<any>) => Exclude<any, Error | undefined>,
>(
  result: Awaited<ReturnType<T>> | Error,
  cache: FnCache<T>,
  args: Parameters<T>,
): void {
  const setResult = cache.set(result, ...args);
  if (isPromise(setResult)) {
    setResult.catch(() => {
      /* c8 ignore next */
    });
  }
}
