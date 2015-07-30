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
import type { Value } from '../language/ast';
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
import {
  GraphQLType,
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
  value: any,
  type?: ?GraphQLType
): ?Value {
  if (type instanceof GraphQLNonNull) {
    // Note: we're not checking that the result is non-null.
    // This function is not responsible for validating the input value.
    return astFromValue(value, type.ofType);
  }

  if (isNullish(value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (Array.isArray(value)) {
    var itemType = type instanceof GraphQLList ? type.ofType : null;
    return {
      kind: LIST,
      values: value.map(item => astFromValue(item, itemType))
    };
  } else if (type instanceof GraphQLList) {
    // Because GraphQL will accept single values as a "list of one" when
    // expecting a list, if there's a non-array value and an expected list type,
    // create an AST using the list's item type.
    return astFromValue(value, (type: any).ofType);
  }

  if (typeof value === 'boolean') {
    return { kind: BOOLEAN, value };
  }

  // JavaScript numbers can be Float or Int values. Use the GraphQLType to
  // differentiate if available, otherwise prefer Int if the value is a
  // valid Int.
  if (typeof value === 'number') {
    var stringNum = String(value);
    var isIntValue = /^[0-9]+$/.test(stringNum);
    if (isIntValue) {
      if (type === GraphQLFloat) {
        return { kind: FLOAT, value: stringNum + '.0' };
      } else {
        return { kind: INT, value: stringNum };
      }
    }
    return { kind: FLOAT, value: stringNum };
  }

  // JavaScript strings can be Enum values or String values. Use the
  // GraphQLType to differentiate if possible.
  if (typeof value === 'string') {
    if (type instanceof GraphQLEnumType &&
        /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(value)) {
      return { kind: ENUM, value };
    }
    // Use JSON stringify, which uses the same string encoding as GraphQL,
    // then remove the quotes.
    return { kind: STRING, value: JSON.stringify(value).slice(1, -1) };
  }

  // last remaining possible typeof
  invariant(typeof value === 'object');

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object.
  var fields = [];
  Object.keys(value).forEach(fieldName => {
    var fieldType;
    if (type instanceof GraphQLInputObjectType) {
      var fieldDef = type.getFields()[fieldName];
      fieldType = fieldDef && fieldDef.type;
    }
    var fieldValue = astFromValue(value[fieldName], fieldType);
    if (fieldValue) {
      fields.push({
        kind: OBJECT_FIELD,
        name: { kind: NAME, value: fieldName },
        value: fieldValue
      });
    }
  });
  return { kind: OBJECT, fields };
}
