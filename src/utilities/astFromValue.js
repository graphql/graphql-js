/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { forEach, isCollection } from 'iterall';

import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import objectValues from '../jsutils/objectValues';
import type { ValueNode } from '../language/ast';
import { Kind } from '../language/kinds';
import type { GraphQLInputType } from '../type/definition';
import {
  isScalarType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
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
export function astFromValue(value: mixed, type: GraphQLInputType): ?ValueNode {
  // Ensure flow knows that we treat function params as const.
  const _value = value;

  if (isNonNullType(type)) {
    const astValue = astFromValue(_value, type.ofType);
    if (astValue && astValue.kind === Kind.NULL) {
      return null;
    }
    return astValue;
  }

  // only explicit null, not undefined, NaN
  if (_value === null) {
    return { kind: Kind.NULL };
  }

  // undefined, NaN
  if (isInvalid(_value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (isListType(type)) {
    const itemType = type.ofType;
    if (isCollection(_value)) {
      const valuesNodes = [];
      forEach((_value: any), item => {
        const itemNode = astFromValue(item, itemType);
        if (itemNode) {
          valuesNodes.push(itemNode);
        }
      });
      return { kind: Kind.LIST, values: valuesNodes };
    }
    return astFromValue(_value, itemType);
  }

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object according to the fields in the input type.
  if (isInputObjectType(type)) {
    if (_value === null || typeof _value !== 'object') {
      return null;
    }
    const fields = objectValues(type.getFields());
    const fieldNodes = [];
    fields.forEach(field => {
      const fieldValue = astFromValue(_value[field.name], field.type);
      if (fieldValue) {
        fieldNodes.push({
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: field.name },
          value: fieldValue,
        });
      }
    });
    return { kind: Kind.OBJECT, fields: fieldNodes };
  }

  if (isScalarType(type) || isEnumType(type)) {
    // Since value is an internally represented value, it must be serialized
    // to an externally represented value before converting into an AST.
    const serialized = type.serialize(_value);
    if (isNullish(serialized)) {
      return null;
    }

    // Others serialize based on their corresponding JavaScript scalar types.
    if (typeof serialized === 'boolean') {
      return { kind: Kind.BOOLEAN, value: serialized };
    }

    // JavaScript numbers can be Int or Float values.
    if (typeof serialized === 'number') {
      const stringNum = String(serialized);
      return integerStringRegExp.test(stringNum)
        ? { kind: Kind.INT, value: stringNum }
        : { kind: Kind.FLOAT, value: stringNum };
    }

    if (typeof serialized === 'string') {
      // Enum types use Enum literals.
      if (isEnumType(type)) {
        return { kind: Kind.ENUM, value: serialized };
      }

      // ID types can use Int literals.
      if (type === GraphQLID && integerStringRegExp.test(serialized)) {
        return { kind: Kind.INT, value: serialized };
      }

      return {
        kind: Kind.STRING,
        value: serialized,
      };
    }

    throw new TypeError('Cannot convert value to AST: ' + String(serialized));
  }

  /* istanbul ignore next */
  throw new Error(`Unknown type: ${(type: empty)}.`);
}

/**
 * IntValue:
 *   - NegativeSign? 0
 *   - NegativeSign? NonZeroDigit ( Digit+ )?
 */
const integerStringRegExp = /^-?(0|[1-9][0-9]*)$/;
