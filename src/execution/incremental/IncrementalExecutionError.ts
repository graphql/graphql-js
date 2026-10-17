import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import type { GraphQLError } from '../../error/GraphQLError.ts';

/** @internal */
export class IncrementalExecutionError extends Error {
  readonly errors: ReadonlyArray<GraphQLError>;

  constructor(errors: ReadonlyArray<GraphQLError>) {
    super('Incremental execution failed.');
    this.errors = errors;
  }
}

/** @internal */
export function getIncrementalErrors(
  error: unknown,
): ReadonlyArray<GraphQLError> {
  return error instanceof IncrementalExecutionError
    ? error.errors
    : [ensureGraphQLError(error)];
}
