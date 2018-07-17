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
  return "Field \"".concat(fieldName, "\" argument \"").concat(argName, "\" of type ") + "\"".concat(type, "\" is required but not provided.");
}
export function missingDirectiveArgMessage(directiveName, argName, type) {
  return "Directive \"@".concat(directiveName, "\" argument \"").concat(argName, "\" of type ") + "\"".concat(type, "\" is required but not provided.");
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
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = fieldDef.args[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var argDef = _step.value;
            var argNode = argNodeMap[argDef.name];

            if (!argNode && isNonNullType(argDef.type) && argDef.defaultValue === undefined) {
              context.reportError(new GraphQLError(missingFieldArgMessage(node.name.value, argDef.name, inspect(argDef.type)), [node]));
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
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = directiveDef.args[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var argDef = _step2.value;
            var argNode = argNodeMap[argDef.name];

            if (!argNode && isNonNullType(argDef.type) && argDef.defaultValue === undefined) {
              context.reportError(new GraphQLError(missingDirectiveArgMessage(node.name.value, argDef.name, inspect(argDef.type)), [node]));
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }
    }
  };
}