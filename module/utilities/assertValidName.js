/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import { GraphQLError } from '../error/GraphQLError';

import invariant from '../jsutils/invariant';

var NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;

/**
 * Upholds the spec rules about naming.
 */
export function assertValidName(name) {
  var error = isValidNameError(name);
  if (error) {
    throw error;
  }
  return name;
}

/**
 * Returns an Error if a name is invalid.
 */
export function isValidNameError(name, node) {
  !(typeof name === 'string') ? invariant(0, 'Expected string') : void 0;
  if (name.length > 1 && name[0] === '_' && name[1] === '_' &&
  // Note: this special case is not part of the spec and exists only to
  // support legacy server configurations. Do not rely on this special case
  // as it may be removed at any time.
  name !== '__configs__') {
    return new GraphQLError('Name "' + name + '" must not begin with "__", which is reserved by ' + 'GraphQL introspection.', node);
  }
  if (!NAME_RX.test(name)) {
    return new GraphQLError('Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "' + name + '" does not.', node);
  }
}