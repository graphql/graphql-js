/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import invariant from '../jsutils/invariant';

/**
 * Given a GraphQLError, format it according to the rules described by the
 * Response Format, Errors section of the GraphQL Specification.
 */
export function formatError(error) {
  !error ? invariant(0, 'Received null or undefined error.') : void 0;
  var message = error.message || 'An unknown error occurred.';
  var locations = error.locations;
  var path = error.path;
  var extensions = error.extensions;
  return extensions ? {
    message: message,
    locations: locations,
    path: path,
    extensions: extensions
  } : {
    message: message,
    locations: locations,
    path: path
  };
}