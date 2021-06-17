import type { GraphQLError } from './GraphQLError';

/**
 * A GraphQLAggregateError contains a collection of GraphQLError objects.
 * See documentation for the GraphQLError class for further details.
 *
 * @internal
 *
 * TODO: Consider exposing this class for returning multiple errors from
 * resolvers.
 */
export class GraphQLAggregateError extends Error {
  /**
   * An array of GraphQLError objects.
   *
   */
  readonly errors: ReadonlyArray<GraphQLError>;

  constructor(errors: ReadonlyArray<GraphQLError>) {
    super();
    this.errors = errors;
  }
}
