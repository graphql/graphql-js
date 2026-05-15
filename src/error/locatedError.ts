/** @category Errors */

import type { Maybe } from '../jsutils/Maybe.ts';
import { toError } from '../jsutils/toError.ts';

import type { ASTNode } from '../language/ast.ts';

import { GraphQLError } from './GraphQLError.ts';

/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 * @param rawOriginalError - The original error value to wrap.
 * @param nodes - The AST nodes associated with the error.
 * @param path - The response path associated with the error.
 * @returns The GraphQL error.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { locatedError } from 'graphql/error';
 *
 * const document = parse('{ viewer { name } }');
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 * const error = locatedError(new Error('Resolver failed'), fieldNode, [
 *   'viewer',
 * ]);
 *
 * error.message; // => 'Resolver failed'
 * error.locations; // => [{ line: 1, column: 3 }]
 * error.path; // => ['viewer']
 * ```
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
