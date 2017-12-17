/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import keyMap from '../jsutils/keyMap';
import isInvalid from '../jsutils/isInvalid';

import * as Kind from '../language/kinds';
import { isScalarType, isEnumType, isInputObjectType, isListType, isNonNullType } from '../type/definition';


/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Mixed         |
 * | NullValue            | null          |
 *
 */
export function valueFromAST(valueNode, type, variables) {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueNode, type.ofType, variables);
  }

  if (valueNode.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (valueNode.kind === Kind.VARIABLE) {
    var variableName = valueNode.name.value;
    if (!variables || isInvalid(variables[variableName])) {
      // No valid return value.
      return;
    }
    // Note: we're not doing any checking that this variable is correct. We're
    // assuming that this query has been validated and the variable usage here
    // is of the correct type.
    return variables[variableName];
  }

  if (isListType(type)) {
    var itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      var coercedValues = [];
      var itemNodes = valueNode.values;
      for (var i = 0; i < itemNodes.length; i++) {
        if (isMissingVariable(itemNodes[i], variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if (isNonNullType(itemType)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          var itemValue = valueFromAST(itemNodes[i], itemType, variables);
          if (isInvalid(itemValue)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    var coercedValue = valueFromAST(valueNode, itemType, variables);
    if (isInvalid(coercedValue)) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }

  if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    var coercedObj = Object.create(null);
    var fields = type.getFields();
    var fieldNodes = keyMap(valueNode.fields, function (field) {
      return field.name.value;
    });
    var fieldNames = Object.keys(fields);
    for (var _i = 0; _i < fieldNames.length; _i++) {
      var fieldName = fieldNames[_i];
      var field = fields[fieldName];
      var fieldNode = fieldNodes[fieldName];
      if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
        if (!isInvalid(field.defaultValue)) {
          coercedObj[fieldName] = field.defaultValue;
        } else if (isNonNullType(field.type)) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      var fieldValue = valueFromAST(fieldNode.value, field.type, variables);
      if (isInvalid(fieldValue)) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[fieldName] = fieldValue;
    }
    return coercedObj;
  }

  if (isEnumType(type)) {
    if (valueNode.kind !== Kind.ENUM) {
      return; // Invalid: intentionally return no value.
    }
    var enumValue = type.getValue(valueNode.value);
    if (!enumValue) {
      return; // Invalid: intentionally return no value.
    }
    return enumValue.value;
  }

  if (isScalarType(type)) {
    // Scalars fulfill parsing a literal value via parseLiteral().
    // Invalid values represent a failure to parse correctly, in which case
    // no value is returned.
    var result = void 0;
    try {
      result = type.parseLiteral(valueNode, variables);
    } catch (_error) {
      return; // Invalid: intentionally return no value.
    }
    if (isInvalid(result)) {
      return; // Invalid: intentionally return no value.
    }
    return result;
  }

  /* istanbul ignore next */
  throw new Error('Unknown type: ' + type + '.');
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(valueNode, variables) {
  return valueNode.kind === Kind.VARIABLE && (!variables || isInvalid(variables[valueNode.name.value]));
}