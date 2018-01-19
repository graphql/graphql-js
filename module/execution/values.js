/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import { GraphQLError } from '../error';
import find from '../jsutils/find';
import isInvalid from '../jsutils/isInvalid';
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
  for (var i = 0; i < varDefNodes.length; i++) {
    var varDefNode = varDefNodes[i];
    var varName = varDefNode.variable.name.value;
    var varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
      errors.push(new GraphQLError('Variable "$' + varName + '" expected value of type ' + ('"' + print(varDefNode.type) + '" which cannot be used as an input type.'), [varDefNode.type]));
    } else {
      var value = inputs[varName];
      if (isInvalid(value)) {
        if (isNonNullType(varType)) {
          errors.push(new GraphQLError('Variable "$' + varName + '" of required type ' + ('"' + String(varType) + '" was not provided.'), [varDefNode]));
        } else if (varDefNode.defaultValue) {
          coercedValues[varName] = valueFromAST(varDefNode.defaultValue, varType);
        }
      } else {
        var _coerced = coerceValue(value, varType, varDefNode);
        var coercionErrors = _coerced.errors;
        if (coercionErrors) {
          (function () {
            var messagePrelude = 'Variable "$' + varName + '" got invalid value ' + JSON.stringify(value) + '; ';
            coercionErrors.forEach(function (error) {
              error.message = messagePrelude + error.message;
            });
            errors.push.apply(errors, coercionErrors);
          })();
        } else {
          coercedValues[varName] = _coerced.value;
        }
      }
    }
  }
  return errors.length === 0 ? { errors: undefined, coerced: coercedValues } : { errors: errors, coerced: undefined };
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
  var argDefs = def.args;
  var argNodes = node.arguments;
  if (!argDefs || !argNodes) {
    return coercedValues;
  }
  var argNodeMap = keyMap(argNodes, function (arg) {
    return arg.name.value;
  });
  for (var i = 0; i < argDefs.length; i++) {
    var argDef = argDefs[i];
    var name = argDef.name;
    var argType = argDef.type;
    var argumentNode = argNodeMap[name];
    var defaultValue = argDef.defaultValue;
    if (!argumentNode) {
      if (!isInvalid(defaultValue)) {
        coercedValues[name] = defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError('Argument "' + name + '" of required type ' + ('"' + String(argType) + '" was not provided.'), [node]);
      }
    } else if (argumentNode.value.kind === Kind.VARIABLE) {
      var variableName = argumentNode.value.name.value;
      if (variableValues && Object.prototype.hasOwnProperty.call(variableValues, variableName) && !isInvalid(variableValues[variableName])) {
        // Note: this does not check that this variable value is correct.
        // This assumes that this query has been validated and the variable
        // usage here is of the correct type.
        coercedValues[name] = variableValues[variableName];
      } else if (!isInvalid(defaultValue)) {
        coercedValues[name] = defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError('Argument "' + name + '" of required type "' + String(argType) + '" was ' + ('provided the variable "$' + variableName + '" which was not provided ') + 'a runtime value.', [argumentNode.value]);
      }
    } else {
      var valueNode = argumentNode.value;
      var coercedValue = valueFromAST(valueNode, argType, variableValues);
      if (isInvalid(coercedValue)) {
        // Note: ValuesOfCorrectType validation should catch this before
        // execution. This is a runtime check to ensure execution does not
        // continue with an invalid argument value.
        throw new GraphQLError('Argument "' + name + '" has invalid value ' + print(valueNode) + '.', [argumentNode.value]);
      }
      coercedValues[name] = coercedValue;
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