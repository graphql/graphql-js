import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

export class AbortedGraphQLExecutionError<TResult> extends Error {
  readonly abortedResult: PromiseOrValue<TResult>;

  constructor(reason: unknown, result: PromiseOrValue<TResult>) {
    super(getAbortReasonMessage(reason), { cause: reason });
    this.name = 'AbortedGraphQLExecutionError';
    this.abortedResult = result;
  }

  get [Symbol.toStringTag](): string {
    return 'AbortedGraphQLExecutionError';
  }
}

function getAbortReasonMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (
    typeof reason === 'object' &&
    reason !== null &&
    'message' in reason &&
    typeof reason.message === 'string'
  ) {
    return reason.message;
  }
  return String(reason);
}
