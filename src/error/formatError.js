/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import type { GraphQLError } from './GraphQLError';


/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification.
 */
export function formatError(error: GraphQLError): GraphQLFormattedError {
  invariant(error, 'Received null or undefined error.');
  // Pick location associated with the first AST node
  const loc = error.nodes && error.nodes[0] && error.nodes[0].loc;
  return {
    message: error.message,
    locations: error.locations,
    path: error.path,
    origin: loc && loc.source.name,
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
