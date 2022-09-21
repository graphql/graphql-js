'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.assertEnumValueName = exports.assertName = void 0;
const GraphQLError_js_1 = require('../error/GraphQLError.js');
const characterClasses_js_1 = require('../language/characterClasses.js');
/**
 * Upholds the spec rules about naming.
 */
function assertName(name) {
  if (name.length === 0) {
    throw new GraphQLError_js_1.GraphQLError(
      'Expected name to be a non-empty string.',
    );
  }
  for (let i = 1; i < name.length; ++i) {
    if (!(0, characterClasses_js_1.isNameContinue)(name.charCodeAt(i))) {
      throw new GraphQLError_js_1.GraphQLError(
        `Names must only contain [_a-zA-Z0-9] but "${name}" does not.`,
      );
    }
  }
  if (!(0, characterClasses_js_1.isNameStart)(name.charCodeAt(0))) {
    throw new GraphQLError_js_1.GraphQLError(
      `Names must start with [_a-zA-Z] but "${name}" does not.`,
    );
  }
  return name;
}
exports.assertName = assertName;
/**
 * Upholds the spec rules about naming enum values.
 *
 * @internal
 */
function assertEnumValueName(name) {
  if (name === 'true' || name === 'false' || name === 'null') {
    throw new GraphQLError_js_1.GraphQLError(
      `Enum values cannot be named: ${name}`,
    );
  }
  return assertName(name);
}
exports.assertEnumValueName = assertEnumValueName;
