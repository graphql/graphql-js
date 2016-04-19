/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import type {
  Value,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
  EnumValue,
  ListValue,
  ObjectValue,
} from '../language/ast';
import {
  NAME,
  INT,
  FLOAT,
  STRING,
  BOOLEAN,
  ENUM,
  LIST,
  OBJECT,
  OBJECT_FIELD,
} from '../language/kinds';
import type { GraphQLType } from '../type/definition';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import { GraphQLFloat } from '../type/scalars';


/**
 * Produces a GraphQL Value AST given a JavaScript value.
 *
 * Optionally, a GraphQL type may be provided, which will be used to
 * disambiguate between value primitives.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 *
 */
export function astFromValue(
  value: mixed,
  type?: ?GraphQLType
): ?Value {
  // Ensure flow knows that we treat function params as const.
  const _value = value;

  if (type instanceof GraphQLNonNull) {
    // Note: we're not checking that the result is non-null.
    // This function is not responsible for validating the input value.
    return astFromValue(_value, type.ofType);
  }

  if (isNullish(_value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (Array.isArray(_value)) {
    const itemType = type instanceof GraphQLList ? type.ofType : null;
    return ({
      kind: LIST,
      values: _value.map(item => {
        const itemValue = astFromValue(item, itemType);
        invariant(itemValue, 'Could not create AST item.');
        return itemValue;
      })
    }: ListValue);
  } else if (type instanceof GraphQLList) {
    // Because GraphQL will accept single values as a "list of one" when
    // expecting a list, if there's a non-array value and an expected list type,
    // create an AST using the list's item type.
    return astFromValue(_value, type.ofType);
  }

  if (typeof _value === 'boolean') {
    return ({ kind: BOOLEAN, value: _value }: BooleanValue);
  }

  // JavaScript numbers can be Float or Int values. Use the GraphQLType to
  // differentiate if available, otherwise prefer Int if the value is a
  // valid Int.
  if (typeof _value === 'number') {
    const stringNum = String(_value);
    const isIntValue = /^[0-9]+$/.test(stringNum);
    if (isIntValue) {
      if (type === GraphQLFloat) {
        return ({ kind: FLOAT, value: stringNum + '.0' }: FloatValue);
      }
      return ({ kind: INT, value: stringNum }: IntValue);
    }
    return ({ kind: FLOAT, value: stringNum }: FloatValue);
  }

  // JavaScript strings can be Enum values or String values. Use the
  // GraphQLType to differentiate if possible.
  if (typeof _value === 'string') {
    if (type instanceof GraphQLEnumType &&
        /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(_value)) {
      return ({ kind: ENUM, value: _value }: EnumValue);
    }
    // Use JSON stringify, which uses the same string encoding as GraphQL,
    // then remove the quotes.
    return ({
      kind: STRING,
      value: JSON.stringify(_value).slice(1, -1)
    }: StringValue);
  }

  // last remaining possible typeof
  invariant(typeof _value === 'object' && _value !== null);

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object.
  const fields = [];
  Object.keys(_value).forEach(fieldName => {
    let fieldType;
    if (type instanceof GraphQLInputObjectType) {
      const fieldDef = type.getFields()[fieldName];
      fieldType = fieldDef && fieldDef.type;
    }
    const fieldValue = astFromValue(_value[fieldName], fieldType);
    if (fieldValue) {
      fields.push({
        kind: OBJECT_FIELD,
        name: { kind: NAME, value: fieldName },
        value: fieldValue
      });
    }
  });
  return ({ kind: OBJECT, fields }: ObjectValue);
}
