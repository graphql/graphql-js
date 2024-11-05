import { isPromise } from './isPromise.js';
import type { PromiseOrValue } from './PromiseOrValue.js';

export interface FnCache<
  T extends (...args: Array<any>) => Exclude<any, undefined>,
> {
  set: (result: ReturnType<T>, ...args: Parameters<T>) => PromiseOrValue<void>;
  get: (...args: Parameters<T>) => PromiseOrValue<ReturnType<T> | undefined>;
}

export function withCache<
  T extends (...args: Array<any>) => Exclude<any, undefined>,
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
  T extends (...args: Array<any>) => Exclude<any, undefined>,
>(
  cachedResult: Awaited<ReturnType<T>> | undefined,
  fn: T,
  cache: FnCache<T>,
  args: Parameters<T>,
): Awaited<ReturnType<T>> {
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  const result = fn(...args);
  const setResult = cache.set(result, ...args);
  if (isPromise(setResult)) {
    setResult.catch(() => {
      /* c8 ignore next */
    });
  }
  return result;
}
