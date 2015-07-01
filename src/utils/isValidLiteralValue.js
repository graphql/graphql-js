/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { Value, ArrayValue, ObjectValue } from '../language/ast';
import {
  VARIABLE,
  ARRAY,
  OBJECT
} from '../language/kinds';
import {
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull
} from '../type/definition';
import type { GraphQLType } from '../type/definition';
import keyMap from './keyMap';
import isNullish from './isNullish';


/**
 * Utility for validators which determines if a value literal AST is valid given
 * an input type.
 *
 * Note that this only validates literal values, variables are assumed to
 * provide values of the correct type.
 */
export default function isValidLiteralValue(
  valueAST: Value,
  type: GraphQLType
): boolean {
  // A value can only be not provided if the type is nullable.
  if (!valueAST) {
    return !(type instanceof GraphQLNonNull);
  }

  // Unwrap non-null.
  if (type instanceof GraphQLNonNull) {
    return isValidLiteralValue(valueAST, type.ofType);
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueAST.kind === VARIABLE) {
    return true;
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    var itemType = type.ofType;
    if (valueAST.kind === ARRAY) {
      return (valueAST: ArrayValue).values.every(
        itemAST => isValidLiteralValue(itemAST, itemType)
      );
    } else {
      return isValidLiteralValue(valueAST, itemType);
    }
  }

  // Scalar/Enum input checks to ensure the type can coerce the value to
  // a non-null value.
  if (type instanceof GraphQLScalarType ||
      type instanceof GraphQLEnumType) {
    return !isNullish(type.coerceLiteral(valueAST));
  }

  // Input objects check each defined field, ensuring it is of the correct
  // type and provided if non-nullable.
  if (type instanceof GraphQLInputObjectType) {
    var fields = type.getFields();
    if (valueAST.kind !== OBJECT) {
      return false;
    }
    var fieldASTs = (valueAST: ObjectValue).fields;
    var fieldASTMap = keyMap(fieldASTs, field => field.name.value);
    var isMissingFields = Object.keys(fields).some(fieldName =>
      !fieldASTMap[fieldName] &&
      fields[fieldName].type instanceof GraphQLNonNull
    );
    if (isMissingFields) {
      return false;
    }
    return fieldASTs.every(fieldAST =>
      fields[fieldAST.name.value] &&
      isValidLiteralValue(fieldAST.value, fields[fieldAST.name.value].type)
    );
  }

  // Any other kind of type is not an input type, and a literal cannot be used.
  return false;
}
