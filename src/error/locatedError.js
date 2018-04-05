/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { GraphQLError } from './GraphQLError';
import type { ASTNode } from '../language/ast';

/**
 * Given an arbitrary Error, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */
export function locatedError(
  originalError: Error | GraphQLError,
  nodes: $ReadOnlyArray<ASTNode>,
  path: $ReadOnlyArray<string | number>,
): GraphQLError {
  // Note: this uses a brand-check to support GraphQL errors originating from
  // other contexts.
  if (originalError && Array.isArray(originalError.path)) {
    return (originalError: any);
  }

  return new GraphQLError(
    originalError && originalError.message,
    (originalError && (originalError: any).nodes) || nodes,
    originalError && (originalError: any).source,
    originalError && (originalError: any).positions,
    path,
    originalError,
  );
}
