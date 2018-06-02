/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import { GraphQLError } from '../../error';
import inspect from '../../jsutils/inspect';
import keyMap from '../../jsutils/keyMap';
import { isNonNullType } from '../../type/definition';
export function missingFieldArgMessage(fieldName, argName, type) {
  return "Field \"".concat(fieldName, "\" argument \"").concat(argName, "\" of type ") + "\"".concat(inspect(type), "\" is required but not provided.");
}
export function missingDirectiveArgMessage(directiveName, argName, type) {
  return "Directive \"@".concat(directiveName, "\" argument \"").concat(argName, "\" of type ") + "\"".concat(inspect(type), "\" is required but not provided.");
}
/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */

export function ProvidedRequiredArguments(context) {
  return {
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave: function leave(node) {
        var fieldDef = context.getFieldDef();

        if (!fieldDef) {
          return false;
        }

        var argNodes = node.arguments || [];
        var argNodeMap = keyMap(argNodes, function (arg) {
          return arg.name.value;
        });
        fieldDef.args.forEach(function (argDef) {
          var argNode = argNodeMap[argDef.name];

          if (!argNode && isNonNullType(argDef.type) && argDef.defaultValue === undefined) {
            context.reportError(new GraphQLError(missingFieldArgMessage(node.name.value, argDef.name, argDef.type), [node]));
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
        var argNodeMap = keyMap(argNodes, function (arg) {
          return arg.name.value;
        });
        directiveDef.args.forEach(function (argDef) {
          var argNode = argNodeMap[argDef.name];

          if (!argNode && isNonNullType(argDef.type) && argDef.defaultValue === undefined) {
            context.reportError(new GraphQLError(missingDirectiveArgMessage(node.name.value, argDef.name, argDef.type), [node]));
          }
        });
      }
    }
  };
}