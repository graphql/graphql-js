import find from '../polyfills/find';
import { GraphQLError } from '../error/GraphQLError';
import inspect from '../jsutils/inspect';
import keyMap from '../jsutils/keyMap';
import { coerceValue } from '../utilities/coerceValue';
import { typeFromAST } from '../utilities/typeFromAST';
import { valueFromAST } from '../utilities/valueFromAST';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';
import { isInputType, isNonNullType } from '../type/definition';

/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getVariableValues(schema, varDefNodes, inputs) {
  var errors = [];
  var coercedValues = {};
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = varDefNodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var varDefNode = _step.value;
      var varName = varDefNode.variable.name.value;
      var varType = typeFromAST(schema, varDefNode.type);

      if (!isInputType(varType)) {
        // Must use input types for variables. This should be caught during
        // validation, however is checked again here for safety.
        var varTypeStr = print(varDefNode.type);
        errors.push(new GraphQLError("Variable \"$".concat(varName, "\" expected value of type \"").concat(varTypeStr, "\" which cannot be used as an input type."), varDefNode.type));
        continue;
      }

      if (!hasOwnProperty(inputs, varName)) {
        if (varDefNode.defaultValue) {
          coercedValues[varName] = valueFromAST(varDefNode.defaultValue, varType);
        }

        if (isNonNullType(varType)) {
          var _varTypeStr = inspect(varType);

          errors.push(new GraphQLError("Variable \"$".concat(varName, "\" of required type \"").concat(_varTypeStr, "\" was not provided."), varDefNode));
        }

        continue;
      }

      var value = inputs[varName];

      if (value === null && isNonNullType(varType)) {
        var _varTypeStr2 = inspect(varType);

        errors.push(new GraphQLError("Variable \"$".concat(varName, "\" of non-null type \"").concat(_varTypeStr2, "\" must not be null."), varDefNode));
        continue;
      }

      var coerced = coerceValue(value, varType, varDefNode);

      if (coerced.errors) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = coerced.errors[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var error = _step2.value;
            error.message = "Variable \"$".concat(varName, "\" got invalid value ").concat(inspect(value), "; ") + error.message;
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

        errors.push.apply(errors, coerced.errors);
        continue;
      }

      coercedValues[varName] = coerced.value;
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

  return errors.length === 0 ? {
    errors: undefined,
    coerced: coercedValues
  } : {
    errors: errors,
    coerced: undefined
  };
}
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */

export function getArgumentValues(def, node, variableValues) {
  var coercedValues = {};
  var argNodeMap = keyMap(node.arguments || [], function (arg) {
    return arg.name.value;
  });
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = def.args[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var argDef = _step3.value;
      var name = argDef.name;
      var argType = argDef.type;
      var argumentNode = argNodeMap[name];

      if (!argumentNode) {
        if (argDef.defaultValue !== undefined) {
          coercedValues[name] = argDef.defaultValue;
        } else if (isNonNullType(argType)) {
          throw new GraphQLError("Argument \"".concat(name, "\" of required type \"").concat(inspect(argType), "\" ") + 'was not provided.', node);
        }

        continue;
      }

      var valueNode = argumentNode.value;
      var isNull = valueNode.kind === Kind.NULL;

      if (valueNode.kind === Kind.VARIABLE) {
        var variableName = valueNode.name.value;

        if (variableValues == null || !hasOwnProperty(variableValues, variableName)) {
          if (argDef.defaultValue !== undefined) {
            coercedValues[name] = argDef.defaultValue;
          } else if (isNonNullType(argType)) {
            throw new GraphQLError("Argument \"".concat(name, "\" of required type \"").concat(inspect(argType), "\" ") + "was provided the variable \"$".concat(variableName, "\" which was not provided a runtime value."), valueNode);
          }

          continue;
        }

        isNull = variableValues[variableName] == null;
      }

      if (isNull && isNonNullType(argType)) {
        throw new GraphQLError("Argument \"".concat(name, "\" of non-null type \"").concat(inspect(argType), "\" ") + 'must not be null.', valueNode);
      }

      var coercedValue = valueFromAST(valueNode, argType, variableValues);

      if (coercedValue === undefined) {
        // Note: ValuesOfCorrectType validation should catch this before
        // execution. This is a runtime check to ensure execution does not
        // continue with an invalid argument value.
        throw new GraphQLError("Argument \"".concat(name, "\" has invalid value ").concat(print(valueNode), "."), valueNode);
      }

      coercedValues[name] = coercedValue;
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  return coercedValues;
}
/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */

export function getDirectiveValues(directiveDef, node, variableValues) {
  var directiveNode = node.directives && find(node.directives, function (directive) {
    return directive.name.value === directiveDef.name;
  });

  if (directiveNode) {
    return getArgumentValues(directiveDef, directiveNode, variableValues);
  }
}

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
