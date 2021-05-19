import type { Maybe } from '../jsutils/Maybe';

import type { ASTNode } from '../language/ast';

import type { GraphQLError } from './GraphQLError';

/**
 * Given an arbitrary value, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */
export function locatedError(
  rawOriginalError: unknown,
  nodes: ASTNode | ReadonlyArray<ASTNode> | undefined,
  path?: Maybe<ReadonlyArray<string | number>>,
): GraphQLError;
