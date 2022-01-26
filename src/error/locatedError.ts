import type { Maybe } from '../jsutils/Maybe';
import { toError } from '../jsutils/toError';

import type { ASTNode } from '../language/ast';

import { GraphQLError } from './GraphQLError';

/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */
export function locatedError(
  rawOriginalError: unknown,
  nodes: ASTNode | ReadonlyArray<ASTNode> | undefined | null,
  path?: Maybe<ReadonlyArray<string | number>>,
): GraphQLError {
  const originalError = toError(rawOriginalError);

  // Note: this uses a brand-check to support GraphQL errors originating from other contexts.
  if (isLocatedGraphQLError(originalError)) {
    return originalError;
  }

  return new GraphQLError(originalError.message, {
    nodes: (originalError as GraphQLError).nodes ?? nodes,
    source: (originalError as GraphQLError).source,
    positions: (originalError as GraphQLError).positions,
    path,
    originalError,
  });
}

function isLocatedGraphQLError(error: any): error is GraphQLError {
  return Array.isArray(error.path);
}
