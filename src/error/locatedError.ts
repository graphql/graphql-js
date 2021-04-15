import { inspect } from '../jsutils/inspect';

import type { ASTNode } from '../language/ast';

import { GraphQLError } from './GraphQLError';

/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */
export function locatedError(
  rawOriginalError: mixed,
  nodes: ASTNode | $ReadOnlyArray<ASTNode> | void | null,
  path?: ?$ReadOnlyArray<string | number>,
): GraphQLError {
  // Sometimes a non-error is thrown, wrap it as an Error instance to ensure a consistent Error interface.
  const originalError: Error | GraphQLError =
    rawOriginalError instanceof Error
      ? rawOriginalError
      : new Error('Unexpected error value: ' + inspect(rawOriginalError));

  // Note: this uses a brand-check to support GraphQL errors originating from other contexts.
  if (Array.isArray(originalError.path)) {
    return (originalError: any);
  }

  return new GraphQLError(
    originalError.message,
    (originalError: any).nodes ?? nodes,
    (originalError: any).source,
    (originalError: any).positions,
    path,
    originalError,
  );
}
