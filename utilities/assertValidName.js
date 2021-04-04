'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.assertValidName = assertValidName;
exports.isValidNameError = isValidNameError;

var _devAssert = require('../jsutils/devAssert.js');

var _GraphQLError = require('../error/GraphQLError.js');

const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
/**
 * Upholds the spec rules about naming.
 */

function assertValidName(name) {
  const error = isValidNameError(name);

  if (error) {
    throw error;
  }

  return name;
}
/**
 * Returns an Error if a name is invalid.
 */

function isValidNameError(name) {
  typeof name === 'string' ||
    (0, _devAssert.devAssert)(0, 'Expected name to be a string.');

  if (name.length > 1 && name[0] === '_' && name[1] === '_') {
    return new _GraphQLError.GraphQLError(
      `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`,
    );
  }

  if (!NAME_RX.test(name)) {
    return new _GraphQLError.GraphQLError(
      `Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "${name}" does not.`,
    );
  }
}
