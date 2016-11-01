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
): mixed {
  if (type instanceof GraphQLNonNull) {
    // Note: we're not checking that the result of valueFromAST is non-null.
    // We're assuming that this query has been validated and the value used
    // here is of the correct type.
    return valueFromAST(valueAST, type.ofType, variables);
  }

  if (!valueAST) {
    // When there is no AST, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (valueAST.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (valueAST.kind === Kind.VARIABLE) {
    const variableName = (valueAST: Variable).name.value;
    if (!variables || !variables.hasOwnProperty(variableName)) {
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
      return (valueAST: ListValue).values.map(
        itemAST => valueFromAST(itemAST, itemType, variables)
      );
    }
    return [ valueFromAST(valueAST, itemType, variables) ];
  }

  if (type instanceof GraphQLInputObjectType) {
    if (valueAST.kind !== Kind.OBJECT) {
      // No valid return value.
      return;
    }
    const fields = type.getFields();
    const fieldASTs = keyMap(
      (valueAST: ObjectValue).fields,
      field => field.name.value
    );
    return Object.keys(fields).reduce((obj, fieldName) => {
      const field = fields[fieldName];
      const fieldAST = fieldASTs[fieldName];
      const fieldValue =
        valueFromAST(fieldAST && fieldAST.value, field.type, variables);

      // If no valid field value was provided, use the default value
      obj[fieldName] = isInvalid(fieldValue) ? field.defaultValue : fieldValue;
      return obj;
    }, {});
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  const parsed = type.parseLiteral(valueAST);
  if (!isNullish(parsed)) {
    return parsed;
  }
}
