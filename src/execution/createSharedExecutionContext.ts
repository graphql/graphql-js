/** @internal */
export interface SharedExecutionContext {
  getAbortSignal: () => AbortSignal | undefined;
}

export function createSharedExecutionContext(
  abortSignal: AbortSignal | undefined,
): SharedExecutionContext {
  return {
    getAbortSignal: () => abortSignal,
  };
}
