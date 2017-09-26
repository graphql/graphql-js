/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { forEach, isCollection } from 'iterall';

import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import type {
  ValueNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  NullValueNode,
  EnumValueNode,
  ListValueNode,
  ObjectValueNode,
} from '../language/ast';
import * as Kind from '../language/kinds';
import type { GraphQLInputType } from '../type/definition';
import {
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import { GraphQLID } from '../type/scalars';


/**
 * Produces a GraphQL Value AST given a JavaScript value.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * JavaScript values.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 * | Mixed         | Enum Value           |
 * | null          | NullValue            |
 *
 */
export function astFromValue(
  value: mixed,
  type: GraphQLInputType
): ?ValueNode {
  // Ensure flow knows that we treat function params as const.
  const _value = value;

  if (type instanceof GraphQLNonNull) {
    const astValue = astFromValue(_value, type.ofType);
    if (astValue && astValue.kind === Kind.NULL) {
      return null;
    }
    return astValue;
  }

  // only explicit null, not undefined, NaN
  if (_value === null) {
    return ({ kind: Kind.NULL }: NullValueNode);
  }

  // undefined, NaN
  if (isInvalid(_value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (isCollection(_value)) {
      const valuesNodes = [];
      forEach((_value: any), item => {
        const itemNode = astFromValue(item, itemType);
        if (itemNode) {
          valuesNodes.push(itemNode);
        }
      });
      return ({ kind: Kind.LIST, values: valuesNodes }: ListValueNode);
    }
    return astFromValue(_value, itemType);
  }

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object according to the fields in the input type.
  if (type instanceof GraphQLInputObjectType) {
    if (_value === null || typeof _value !== 'object') {
      return null;
    }
    const fields = type.getFields();
    const fieldNodes = [];
    Object.keys(fields).forEach(fieldName => {
      const fieldType = fields[fieldName].type;
      const fieldValue = astFromValue(_value[fieldName], fieldType);
      if (fieldValue) {
        fieldNodes.push({
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: fieldName },
          value: fieldValue
        });
      }
    });
    return ({ kind: Kind.OBJECT, fields: fieldNodes }: ObjectValueNode);
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must provide Input Type, cannot use: ' + String(type)
  );

  // Since value is an internally represented value, it must be serialized
  // to an externally represented value before converting into an AST.
  const serialized = type.serialize(_value);
  if (isNullish(serialized)) {
    return null;
  }

  // Others serialize based on their corresponding JavaScript scalar types.
  if (typeof serialized === 'boolean') {
    return ({ kind: Kind.BOOLEAN, value: serialized }: BooleanValueNode);
  }

  // JavaScript numbers can be Int or Float values.
  if (typeof serialized === 'number') {
    const stringNum = String(serialized);
    return /^[0-9]+$/.test(stringNum) ?
      ({ kind: Kind.INT, value: stringNum }: IntValueNode) :
      ({ kind: Kind.FLOAT, value: stringNum }: FloatValueNode);
  }

  if (typeof serialized === 'string') {
    // Enum types use Enum literals.
    if (type instanceof GraphQLEnumType) {
      return ({ kind: Kind.ENUM, value: serialized }: EnumValueNode);
    }

    // ID types can use Int literals.
    if (type === GraphQLID && /^[0-9]+$/.test(serialized)) {
      return ({ kind: Kind.INT, value: serialized }: IntValueNode);
    }

    // Use JSON stringify, which uses the same string encoding as GraphQL,
    // then remove the quotes.
    return ({
      kind: Kind.STRING,
      value: JSON.stringify(serialized).slice(1, -1)
    }: StringValueNode);
  }

  throw new TypeError('Cannot convert value to AST: ' + String(serialized));
}
