/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import type { GraphQLError } from './GraphQLError';


/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification.
 */
export function formatError(error: GraphQLError): GraphQLFormattedError {
  invariant(error, 'Received null or undefined error.');
  return {
    message: error.message,
    locations: error.locations,
    path: error.path
  };
}

export type GraphQLFormattedError = {
  message: string,
  locations: ?Array<GraphQLErrorLocation>,
  path: ?Array<string | number>
};

export type GraphQLErrorLocation = {
  line: number,
  column: number
};
