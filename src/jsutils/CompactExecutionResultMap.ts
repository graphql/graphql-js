/**
 * A shared constructor allows engines to store small execution result maps
 * compactly. Callers remove the prototype before adding any result fields.
 *
 * @internal
 */
export const CompactExecutionResultMap = function CompactExecutionResultMap() {
  // Execution adds fields after removing the prototype.
} as unknown as new () => object;
