import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import type { GraphQLResolveInfoHelpers } from '../type/index.js';

import { AsyncWorkTracker } from './AsyncWorkTracker.js';

/** @internal */
export interface SharedExecutionContext {
  asyncWorkTracker: AsyncWorkTracker;
  getAbortSignal: () => AbortSignal | undefined;
  getAsyncHelpers: () => GraphQLResolveInfoHelpers;
  promiseAll: <T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ) => Promise<Array<T>>;
  trackPromise: (promise: Promise<unknown>) => void;
}

export function createSharedExecutionContext(
  abortSignal: AbortSignal | undefined,
): SharedExecutionContext {
  const asyncWorkTracker = new AsyncWorkTracker();
  let resolveInfoHelpers: GraphQLResolveInfoHelpers | undefined;

  const promiseAll = <T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ): Promise<Array<T>> => asyncWorkTracker.promiseAllTrackOnReject(values);

  const trackPromise = (promise: Promise<unknown>): void => {
    asyncWorkTracker.add(promise);
  };

  const getAsyncHelpers = (): GraphQLResolveInfoHelpers =>
    (resolveInfoHelpers ??= {
      trackPromise,
    });

  return {
    asyncWorkTracker,
    getAbortSignal: () => abortSignal,
    getAsyncHelpers,
    promiseAll,
    trackPromise,
  };
}
