/**
 * Specifies how execution errors should be handled:
 *
 * - `PROPAGATE`: errors in non-null positions propagate to the closest nullable position.
 * - `NULL`: errors resolve to null without propagation.
 * - `ABORT`: errors propagate as far as possible, typically to the operation root.
 * @experimental
 * @category Errors
 */
export type GraphQLErrorBehavior = 'NULL' | 'PROPAGATE' | 'ABORT';

/**
 * True if the given value is a GraphQL error behavior.
 * @param onError - The value to check.
 * @returns True when the value is a supported error behavior.
 * @experimental
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
