"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unknownArgMessage = unknownArgMessage;
exports.unknownDirectiveArgMessage = unknownDirectiveArgMessage;
exports.KnownArgumentNames = KnownArgumentNames;

var _error = require("../../error");

var _suggestionList = _interopRequireDefault(require("../../jsutils/suggestionList"));

var _quotedOrList = _interopRequireDefault(require("../../jsutils/quotedOrList"));

var _kinds = require("../../language/kinds");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
function unknownArgMessage(argName, fieldName, typeName, suggestedArgs) {
  var message = "Unknown argument \"".concat(argName, "\" on field \"").concat(fieldName, "\" of ") + "type \"".concat(typeName, "\".");

  if (suggestedArgs.length) {
    message += " Did you mean ".concat((0, _quotedOrList.default)(suggestedArgs), "?");
  }

  return message;
}

function unknownDirectiveArgMessage(argName, directiveName, suggestedArgs) {
  var message = "Unknown argument \"".concat(argName, "\" on directive \"@").concat(directiveName, "\".");

  if (suggestedArgs.length) {
    message += " Did you mean ".concat((0, _quotedOrList.default)(suggestedArgs), "?");
  }

  return message;
}
/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 */


function KnownArgumentNames(context) {
  return {
    Argument: function Argument(node, key, parent, path, ancestors) {
      var argDef = context.getArgument();

      if (!argDef) {
        var argumentOf = ancestors[ancestors.length - 1];

        if (argumentOf.kind === _kinds.Kind.FIELD) {
          var fieldDef = context.getFieldDef();
          var parentType = context.getParentType();

          if (fieldDef && parentType) {
            context.reportError(new _error.GraphQLError(unknownArgMessage(node.name.value, fieldDef.name, parentType.name, (0, _suggestionList.default)(node.name.value, fieldDef.args.map(function (arg) {
              return arg.name;
            }))), [node]));
          }
        } else if (argumentOf.kind === _kinds.Kind.DIRECTIVE) {
          var directive = context.getDirective();

          if (directive) {
            context.reportError(new _error.GraphQLError(unknownDirectiveArgMessage(node.name.value, directive.name, (0, _suggestionList.default)(node.name.value, directive.args.map(function (arg) {
              return arg.name;
            }))), [node]));
          }
        }
      }
    }
  };
}