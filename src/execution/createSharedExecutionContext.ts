import type { GraphQLResolveInfoHelpers } from '../type/index.ts';

import { AsyncWorkTracker } from './AsyncWorkTracker.ts';

/** @internal */
export interface SharedExecutionContext {
  asyncWorkTracker: AsyncWorkTracker;
  /**
   * Number of deferred fragments that may still be delivered incrementally.
   * Decremented as delivery groups are created; once exhausted, further
   * `@defer` usages are executed as if they were not deferred.
   */
  remainingDeferredFragments: number;
  getAbortSignal: () => AbortSignal | undefined;
  getAsyncHelpers: () => GraphQLResolveInfoHelpers;
  promiseAll: <T>(
    values: ReadonlyArray<PromiseLike<T> | T>,
  ) => Promise<Array<T>>;
}

/** @internal */
export function createSharedExecutionContext(
  abortSignal: AbortSignal | undefined,
  maxDeferredFragments: number = Infinity,
): SharedExecutionContext {
  const asyncWorkTracker = new AsyncWorkTracker();
  let resolveInfoHelpers: GraphQLResolveInfoHelpers | undefined;

  const promiseAll = <T>(
    values: ReadonlyArray<PromiseLike<T> | T>,
  ): Promise<Array<T>> => asyncWorkTracker.promiseAllTrackOnReject(values);

  const getAsyncHelpers = (): GraphQLResolveInfoHelpers =>
    (resolveInfoHelpers ??= {
      promiseAll,
      track: (maybePromises) => asyncWorkTracker.addValues(maybePromises),
    });

  return {
    asyncWorkTracker,
    remainingDeferredFragments: maxDeferredFragments,
    getAbortSignal: () => abortSignal,
    getAsyncHelpers,
    promiseAll,
  };
}
