"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.missingFieldArgMessage = missingFieldArgMessage;
exports.missingDirectiveArgMessage = missingDirectiveArgMessage;
exports.ProvidedRequiredArguments = ProvidedRequiredArguments;

var _error = require("../../error");

var _inspect = _interopRequireDefault(require("../../jsutils/inspect"));

var _keyMap = _interopRequireDefault(require("../../jsutils/keyMap"));

var _definition = require("../../type/definition");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
function missingFieldArgMessage(fieldName, argName, type) {
  return "Field \"".concat(fieldName, "\" argument \"").concat(argName, "\" of type ") + "\"".concat((0, _inspect.default)(type), "\" is required but not provided.");
}

function missingDirectiveArgMessage(directiveName, argName, type) {
  return "Directive \"@".concat(directiveName, "\" argument \"").concat(argName, "\" of type ") + "\"".concat((0, _inspect.default)(type), "\" is required but not provided.");
}
/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */


function ProvidedRequiredArguments(context) {
  return {
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave: function leave(node) {
        var fieldDef = context.getFieldDef();

        if (!fieldDef) {
          return false;
        }

        var argNodes = node.arguments || [];
        var argNodeMap = (0, _keyMap.default)(argNodes, function (arg) {
          return arg.name.value;
        });
        fieldDef.args.forEach(function (argDef) {
          var argNode = argNodeMap[argDef.name];

          if (!argNode && (0, _definition.isNonNullType)(argDef.type) && argDef.defaultValue === undefined) {
            context.reportError(new _error.GraphQLError(missingFieldArgMessage(node.name.value, argDef.name, argDef.type), [node]));
          }
        });
      }
    },
    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave: function leave(node) {
        var directiveDef = context.getDirective();

        if (!directiveDef) {
          return false;
        }

        var argNodes = node.arguments || [];
        var argNodeMap = (0, _keyMap.default)(argNodes, function (arg) {
          return arg.name.value;
        });
        directiveDef.args.forEach(function (argDef) {
          var argNode = argNodeMap[argDef.name];

          if (!argNode && (0, _definition.isNonNullType)(argDef.type) && argDef.defaultValue === undefined) {
            context.reportError(new _error.GraphQLError(missingDirectiveArgMessage(node.name.value, argDef.name, argDef.type), [node]));
          }
        });
      }
    }
  };
}