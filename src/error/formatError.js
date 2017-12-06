/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import type { GraphQLError, GraphQLErrorLocation } from './GraphQLError';

/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification.
 */
export function formatError(error: GraphQLError): GraphQLFormattedError {
  invariant(error, 'Received null or undefined error.');
  return {
    ...error.extensions,
    message: error.message,
    locations: error.locations,
    path: error.path,
  };
}

export type GraphQLFormattedError = {
  +message: string,
  +locations: $ReadOnlyArray<GraphQLErrorLocation> | void,
  +path: $ReadOnlyArray<string | number> | void,
  // Extensions
  +[key: string]: mixed,
};
