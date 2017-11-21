/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { GraphQLError } from './GraphQLError';


/**
 * Given an arbitrary Error, presumably thrown while attempting to execute a
 * GraphQL operation, produce a new GraphQLError aware of the location in the
 * document responsible for the original Error.
 */
export function locatedError(
  originalError: ?Error,
  nodes: Array<*>,
  path: Array<string | number>
): GraphQLError {
  // Note: this uses a brand-check to support GraphQL errors originating from
  // other contexts.
  if (originalError && originalError.path) {
    return (originalError: any);
  }

  const message = originalError ?
    originalError.message || String(originalError) :
    'An unknown error occurred.';
  return new GraphQLError(
    message,
    originalError && (originalError: any).nodes || nodes,
    originalError && (originalError: any).source,
    originalError && (originalError: any).positions,
    path,
    originalError
  );
}
