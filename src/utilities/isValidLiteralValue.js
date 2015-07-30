/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { Value, ListValue, ObjectValue } from '../language/ast';
import {
  VARIABLE,
  LIST,
  OBJECT
} from '../language/kinds';
import {
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull
} from '../type/definition';
import type { GraphQLInputType } from '../type/definition';
import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import isNullish from '../jsutils/isNullish';


/**
 * Utility for validators which determines if a value literal AST is valid given
 * an input type.
 *
 * Note that this only validates literal values, variables are assumed to
 * provide values of the correct type.
 */
export function isValidLiteralValue(
  type: GraphQLInputType,
  valueAST: Value
): boolean {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (!valueAST) {
      return false;
    }
    var ofType: GraphQLInputType = (type.ofType: any);
    return isValidLiteralValue(ofType, valueAST);
  }

  if (!valueAST) {
    return true;
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueAST.kind === VARIABLE) {
    return true;
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    var itemType: GraphQLInputType = (type.ofType: any);
    if (valueAST.kind === LIST) {
      return (valueAST: ListValue).values.every(
        itemAST => isValidLiteralValue(itemType, itemAST)
      );
    } else {
      return isValidLiteralValue(itemType, valueAST);
    }
  }

  // Input objects check each defined field and look for undefined fields.
  if (type instanceof GraphQLInputObjectType) {
    if (valueAST.kind !== OBJECT) {
      return false;
    }
    var fields = type.getFields();

    // Ensure every provided field is defined.
    var fieldASTs = (valueAST: ObjectValue).fields;
    if (fieldASTs.some(fieldAST => !fields[fieldAST.name.value])) {
      return false;
    }

    // Ensure every defined field is valid.
    var fieldASTMap = keyMap(fieldASTs, fieldAST => fieldAST.name.value);
    return Object.keys(fields).every(fieldName => isValidLiteralValue(
      fields[fieldName].type,
      fieldASTMap[fieldName] && fieldASTMap[fieldName].value
    ));
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  // Scalar/Enum input checks to ensure the type can coerce the value to
  // a non-null value.
  return !isNullish(type.coerceLiteral(valueAST));
}
