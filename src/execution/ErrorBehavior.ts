/** @category Execution */

/**
 * The _error behavior_ to apply to a request, controlling how an _execution
 * error_ affects the response. See the `onError` request parameter proposed
 * in https://github.com/graphql/graphql-spec/pull/1236.
 *
 * - `NULL`: the erroring response position resolves to `null`, even if it is
 *   of a `Non-Null` type.
 * - `PROPAGATE`: the erroring response position resolves to `null` if
 *   nullable, otherwise the error propagates to the nearest nullable parent
 *   position (or the entire response). This is the behavior used when
 *   `onError` is not provided.
 * - `HALT`: execution of the current operation is stopped immediately and the
 *   response consists of only this one error, with `data` set to `null`.
 * @experimental
 */
export type GraphQLErrorBehavior = 'NULL' | 'PROPAGATE' | 'HALT';

/** @internal */
export function isErrorBehavior(
  onError: unknown,
): onError is GraphQLErrorBehavior {
  return onError === 'NULL' || onError === 'PROPAGATE' || onError === 'HALT';
}
