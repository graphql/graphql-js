/** @category Execution */

import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

/**
 * Error thrown when GraphQL execution is aborted.
 * @typeParam TResult - Result value type.
 */
export class AbortedGraphQLExecutionError<TResult> extends Error {
  /** Partial execution result available when execution was aborted. */
  readonly abortedResult: PromiseOrValue<TResult>;

  /**
   * Creates an error for an aborted GraphQL execution.
   * @param reason - Abort reason used as the error cause.
   * @param result - Partial execution result available when execution stopped.
   * @example
   * ```ts
   * import { AbortedGraphQLExecutionError } from 'graphql/execution';
   *
   * const cause = new Error('Request cancelled.');
   * const partialResult = { data: { viewer: null } };
   * const error = new AbortedGraphQLExecutionError(cause, partialResult);
   *
   * error.message; // => 'Request cancelled.'
   * error.cause; // => cause
   * error.abortedResult; // => partialResult
   * ```
   */
  constructor(reason: unknown, result: PromiseOrValue<TResult>) {
    super(getAbortReasonMessage(reason), { cause: reason });
    this.name = 'AbortedGraphQLExecutionError';
    this.abortedResult = result;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
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
