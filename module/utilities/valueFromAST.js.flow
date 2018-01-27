/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import keyMap from '../jsutils/keyMap';
import isInvalid from '../jsutils/isInvalid';
import objectValues from '../jsutils/objectValues';
import type { ObjMap } from '../jsutils/ObjMap';
import { Kind } from '../language/kinds';
import {
  isScalarType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
} from '../type/definition';
import type { GraphQLInputType } from '../type/definition';
import type {
  ValueNode,
  VariableNode,
  ListValueNode,
  ObjectValueNode,
} from '../language/ast';

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
export function valueFromAST(
  valueNode: ?ValueNode,
  type: GraphQLInputType,
  variables?: ?ObjMap<mixed>,
): mixed | void {
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
    const variableName = (valueNode: VariableNode).name.value;
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
    const itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      const coercedValues = [];
      const itemNodes = (valueNode: ListValueNode).values;
      for (let i = 0; i < itemNodes.length; i++) {
        if (isMissingVariable(itemNodes[i], variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if (isNonNullType(itemType)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          const itemValue = valueFromAST(itemNodes[i], itemType, variables);
          if (isInvalid(itemValue)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(valueNode, itemType, variables);
    if (isInvalid(coercedValue)) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }

  if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    const coercedObj = Object.create(null);
    const fieldNodes = keyMap(
      (valueNode: ObjectValueNode).fields,
      field => field.name.value,
    );
    const fields = objectValues(type.getFields());
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const fieldNode = fieldNodes[field.name];
      if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
        if (!isInvalid(field.defaultValue)) {
          coercedObj[field.name] = field.defaultValue;
        } else if (isNonNullType(field.type)) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
      if (isInvalid(fieldValue)) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[field.name] = fieldValue;
    }
    return coercedObj;
  }

  if (isEnumType(type)) {
    if (valueNode.kind !== Kind.ENUM) {
      return; // Invalid: intentionally return no value.
    }
    const enumValue = type.getValue(valueNode.value);
    if (!enumValue) {
      return; // Invalid: intentionally return no value.
    }
    return enumValue.value;
  }

  if (isScalarType(type)) {
    // Scalars fulfill parsing a literal value via parseLiteral().
    // Invalid values represent a failure to parse correctly, in which case
    // no value is returned.
    let result;
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
  throw new Error(`Unknown type: ${(type: empty)}.`);
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(valueNode, variables) {
  return (
    valueNode.kind === Kind.VARIABLE &&
    (!variables || isInvalid(variables[(valueNode: VariableNode).name.value]))
  );
}
