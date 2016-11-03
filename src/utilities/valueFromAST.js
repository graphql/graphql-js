/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import keyMap from '../jsutils/keyMap';
import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import * as Kind from '../language/kinds';
import {
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import type { GraphQLInputType } from '../type/definition';
import type {
  Value,
  Variable,
  ListValue,
  ObjectValue
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
  valueAST: ?Value,
  type: GraphQLInputType,
  variables?: ?{ [key: string]: mixed }
): mixed | void {
  if (!valueAST) {
    // When there is no AST, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (type instanceof GraphQLNonNull) {
    if (valueAST.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueAST, type.ofType, variables);
  }

  if (valueAST.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (valueAST.kind === Kind.VARIABLE) {
    const variableName = (valueAST: Variable).name.value;
    if (!variables || isInvalid(variables[variableName])) {
      // No valid return value.
      return;
    }
    // Note: we're not doing any checking that this variable is correct. We're
    // assuming that this query has been validated and the variable usage here
    // is of the correct type.
    return variables[variableName];
  }

  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (valueAST.kind === Kind.LIST) {
      const coercedValues = [];
      const itemASTs = (valueAST: ListValue).values;
      for (let i = 0; i < itemASTs.length; i++) {
        if (isMissingVariable(itemASTs[i], variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if (itemType instanceof GraphQLNonNull) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          const itemValue = valueFromAST(itemASTs[i], itemType, variables);
          if (isInvalid(itemValue)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(valueAST, itemType, variables);
    if (isInvalid(coercedValue)) {
      return; // Invalid: intentionally return no value.
    }
    return [ coercedValue ];
  }

  if (type instanceof GraphQLInputObjectType) {
    if (valueAST.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    const coercedObj = Object.create(null);
    const fields = type.getFields();
    const fieldASTs = keyMap(
      (valueAST: ObjectValue).fields,
      field => field.name.value
    );
    const fieldNames = Object.keys(fields);
    for (let i = 0; i < fieldNames.length; i++) {
      const fieldName = fieldNames[i];
      const field = fields[fieldName];
      const fieldAST = fieldASTs[fieldName];
      if (!fieldAST || isMissingVariable(fieldAST.value, variables)) {
        if (!isInvalid(field.defaultValue)) {
          coercedObj[fieldName] = field.defaultValue;
        } else if (field.type instanceof GraphQLNonNull) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      const fieldValue = valueFromAST(fieldAST.value, field.type, variables);
      if (isInvalid(fieldValue)) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[fieldName] = fieldValue;
    }
    return coercedObj;
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  const parsed = type.parseLiteral(valueAST);
  if (isNullish(parsed)) {
    // null or invalid values represent a failure to parse correctly,
    // in which case no value is returned.
    return;
  }

  return parsed;
}

// Returns true if the provided valueAST is a variable which is not defined
// in the set of variables.
function isMissingVariable(valueAST, variables) {
  return valueAST.kind === Kind.VARIABLE &&
    (!variables || isInvalid(variables[(valueAST: Variable).name.value]));
}
