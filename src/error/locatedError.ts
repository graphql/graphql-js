import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';

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
  // Sometimes a non-error is thrown, wrap it as an Error instance to ensure a consistent Error interface.
  const originalError: Error | GraphQLError =
    rawOriginalError instanceof Error
      ? rawOriginalError
      : new Error('Unexpected error value: ' + inspect(rawOriginalError));

  // Note: this uses a brand-check to support GraphQL errors originating from other contexts.
  if (Array.isArray((originalError as any).path)) {
    return originalError as any;
  }

  return new GraphQLError(
    originalError.message,
    (originalError as any).nodes ?? nodes,
    (originalError as any).source,
    (originalError as any).positions,
    path,
    originalError,
  );
}
