/** @category Errors */

import type { Maybe } from '../jsutils/Maybe.ts';
import type { PathDigest } from '../jsutils/Path.ts';
import { toError } from '../jsutils/toError.ts';

import type { ASTNode } from '../language/ast.ts';

import { GraphQLError } from './GraphQLError.ts';

type Optional<T> = { [K in keyof T]: T[K] | undefined };

/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 * @param rawOriginalError - The original error value to wrap.
 * @param nodes - The AST nodes associated with the error.
 * @param digest - The response path digest associated with the error.
 * @returns The GraphQL error.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { locatedError } from 'graphql/error';
 *
 * const document = parse('{ viewer { name } }');
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 * const error = locatedError(new Error('Resolver failed'), fieldNode, {
 *   path: ['viewer'],
 *   pathNonNull: [false],
 * });
 *
 * error.message; // => 'Resolver failed'
 * error.locations; // => [{ line: 1, column: 3 }]
 * error.path; // => ['viewer']
 * ```
 */
export function locatedError(
  rawOriginalError: unknown,
  nodes: ASTNode | ReadonlyArray<ASTNode> | undefined | null,
  digest: PathDigest,
): GraphQLError;
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
 * locatedError(new Error('Resolver failed'), undefined, ['viewer']);
 * ```
 * @deprecated Pass a digest rather than a path.
 */
export function locatedError(
  rawOriginalError: unknown,
  nodes: ASTNode | ReadonlyArray<ASTNode> | undefined | null,
  path?: Maybe<ReadonlyArray<string | number>>,
): GraphQLError;
/** @internal */
export function locatedError(
  rawOriginalError: unknown,
  nodes: ASTNode | ReadonlyArray<ASTNode> | undefined | null,
  digestOrPath?: Maybe<PathDigest | ReadonlyArray<string | number>>,
): GraphQLError {
  const originalError = toError(rawOriginalError);

  // Note: this uses a brand-check to support GraphQL errors originating from other contexts.
  if (isLocatedGraphQLError(originalError)) {
    return originalError;
  }

  const digest: Optional<PathDigest> =
    digestOrPath == null
      ? { path: undefined, pathNonNull: undefined }
      : 'length' in digestOrPath
        ? { path: digestOrPath, pathNonNull: undefined }
        : digestOrPath;
  return new GraphQLError(originalError.message, {
    nodes: (originalError as GraphQLError).nodes ?? nodes,
    source: (originalError as GraphQLError).source,
    positions: (originalError as GraphQLError).positions,
    path: digest.path,
    pathNonNull: digest.pathNonNull,
    originalError,
  });
}

function isLocatedGraphQLError(error: any): error is GraphQLError {
  return Array.isArray(error.path) && Array.isArray(error.pathNonNull);
}
