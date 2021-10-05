'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.assertValidName = assertValidName;
exports.isValidNameError = isValidNameError;

var _devAssert = require('../jsutils/devAssert.js');

var _GraphQLError = require('../error/GraphQLError.js');

var _characterClasses = require('../language/characterClasses.js');

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
    (0, _devAssert.devAssert)(false, 'Expected name to be a string.');

  if (name.startsWith('__')) {
    return new _GraphQLError.GraphQLError(
      `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`,
    );
  }

  if (name.length === 0) {
    return new _GraphQLError.GraphQLError(
      'Expected name to be a non-empty string.',
    );
  }

  for (let i = 1; i < name.length; ++i) {
    if (!(0, _characterClasses.isNameContinue)(name.charCodeAt(i))) {
      return new _GraphQLError.GraphQLError(
        `Names must only contain [_a-zA-Z0-9] but "${name}" does not.`,
      );
    }
  }

  if (!(0, _characterClasses.isNameStart)(name.charCodeAt(0))) {
    return new _GraphQLError.GraphQLError(
      `Names must start with [_a-zA-Z] but "${name}" does not.`,
    );
  }
}
