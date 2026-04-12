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
}

export function createSharedExecutionContext(
  abortSignal: AbortSignal | undefined,
): SharedExecutionContext {
  const asyncWorkTracker = new AsyncWorkTracker();
  let resolveInfoHelpers: GraphQLResolveInfoHelpers | undefined;

  const promiseAll = <T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ): Promise<Array<T>> => asyncWorkTracker.promiseAllTrackOnReject(values);

  const getAsyncHelpers = (): GraphQLResolveInfoHelpers =>
    (resolveInfoHelpers ??= {
      track: (maybePromises) => asyncWorkTracker.addValues(maybePromises),
    });

  return {
    asyncWorkTracker,
    getAbortSignal: () => abortSignal,
    getAsyncHelpers,
    promiseAll,
  };
}
