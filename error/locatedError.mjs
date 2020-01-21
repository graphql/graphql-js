import { GraphQLError } from "./GraphQLError.mjs";
/**
 * Given an arbitrary Error, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */

export function locatedError(originalError, nodes, path) {
  // Note: this uses a brand-check to support GraphQL errors originating from
  // other contexts.
  if (Array.isArray(originalError.path)) {
    return originalError;
  }

  return new GraphQLError(originalError.message, originalError.nodes || nodes, originalError.source, originalError.positions, path, originalError);
}
