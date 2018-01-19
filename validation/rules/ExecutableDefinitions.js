'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.nonExecutableDefinitionMessage = nonExecutableDefinitionMessage;
exports.ExecutableDefinitions = ExecutableDefinitions;

var _error = require('../../error');

var _kinds = require('../../language/kinds');

function nonExecutableDefinitionMessage(defName) {
  return 'The ' + defName + ' definition is not executable.';
}

/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 */
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

function ExecutableDefinitions(context) {
  return {
    Document: function Document(node) {
      node.definitions.forEach(function (definition) {
        if (definition.kind !== _kinds.Kind.OPERATION_DEFINITION && definition.kind !== _kinds.Kind.FRAGMENT_DEFINITION) {
          context.reportError(new _error.GraphQLError(nonExecutableDefinitionMessage(definition.kind === _kinds.Kind.SCHEMA_DEFINITION ? 'schema' : definition.name.value), [definition]));
        }
      });
      return false;
    }
  };
}