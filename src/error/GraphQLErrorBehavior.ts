/**
 * Specifies how errors should be handled:
 *
 * - `PROPAGATE`: traditional error propagation - an error in a non-nullable
 *   position will propagate to the closest nullable position
 * - `NULL`: no error propagation - an error in a non-nullable position will
 *   set that position to null (the client takes responsibility for ensuring
 *   the application cannot read a `null` in this position)
 * - `ABORT`: any error will propagate as far as it can (typically the
 *   operation root)
 * @experimental
 * @category Errors
 */
export type GraphQLErrorBehavior = 'NULL' | 'PROPAGATE' | 'ABORT';

/**
 * True if the given value is a GraphQL error behavior.
 * @internal
 * @experimental
 * @param onError - The value to check.
 * @returns True when the value is a supported error behavior.
 * @example
 * ```ts
 * isErrorBehavior('PROPAGATE'); // true
 * isErrorBehavior('THROW'); // false
 * ```
 */
export function isErrorBehavior(
  onError: unknown,
): onError is GraphQLErrorBehavior {
  return onError === 'NULL' || onError === 'PROPAGATE' || onError === 'ABORT';
}
