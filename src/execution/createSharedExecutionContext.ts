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
  abortSignal: AbortSignal | undefined,
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
    getAbortSignal: () => abortSignal,
    getAsyncHelpers,
    promiseAll,
  };
}
