"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.nonExecutableDefinitionMessage = nonExecutableDefinitionMessage;
exports.ExecutableDefinitions = ExecutableDefinitions;

var _error = require("../../error");

var _kinds = require("../../language/kinds");

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
function nonExecutableDefinitionMessage(defName) {
  return "The ".concat(defName, " definition is not executable.");
}
/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 */


function ExecutableDefinitions(context) {
  return {
    Document: function Document(node) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = node.definitions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var definition = _step.value;

          if (definition.kind !== _kinds.Kind.OPERATION_DEFINITION && definition.kind !== _kinds.Kind.FRAGMENT_DEFINITION) {
            context.reportError(new _error.GraphQLError(nonExecutableDefinitionMessage(definition.kind === _kinds.Kind.SCHEMA_DEFINITION || definition.kind === _kinds.Kind.SCHEMA_EXTENSION ? 'schema' : definition.name.value), [definition]));
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return false;
    }
  };
}