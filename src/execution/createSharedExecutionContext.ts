import type { GraphQLResolveInfoHelpers } from '../type/index.ts';

import { AsyncWorkTracker } from './AsyncWorkTracker.ts';

/** @internal */
export interface SharedExecutionContext {
  asyncWorkTracker: AsyncWorkTracker;
  getAbortSignal: () => AbortSignal | undefined;
  getAsyncHelpers: () => GraphQLResolveInfoHelpers;
  promiseAll: <T>(
    values: ReadonlyArray<PromiseLike<T> | T>,
  ) => Promise<Array<T>>;
}

/** @internal */
export function createSharedExecutionContext(
  abortSignal: AbortSignal | undefined | (() => AbortSignal | undefined),
): SharedExecutionContext {
  let asyncWorkTracker: AsyncWorkTracker | undefined;
  let resolveInfoHelpers: GraphQLResolveInfoHelpers | undefined;

  const getAsyncWorkTracker = (): AsyncWorkTracker =>
    (asyncWorkTracker ??= new AsyncWorkTracker());
  const getAbortSignal =
    typeof abortSignal === 'function' ? abortSignal : () => abortSignal;

  const promiseAll = <T>(
    values: ReadonlyArray<PromiseLike<T> | T>,
  ): Promise<Array<T>> => getAsyncWorkTracker().promiseAllTrackOnReject(values);

  const getAsyncHelpers = (): GraphQLResolveInfoHelpers =>
    (resolveInfoHelpers ??= {
      promiseAll,
      track: (maybePromises) => getAsyncWorkTracker().addValues(maybePromises),
    });

  return {
    get asyncWorkTracker() {
      return getAsyncWorkTracker();
    },
    getAbortSignal,
    getAsyncHelpers,
    promiseAll,
  };
}
