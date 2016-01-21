/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { print } from '../language/printer';
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
): [ string ] {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (!valueAST) {
      if (type.ofType.name) {
        return [ `Expected "${type.ofType.name}!", found null.` ];
      }
      return [ 'Expected non-null value, found null.' ];
    }
    return isValidLiteralValue(type.ofType, valueAST);
  }

  if (!valueAST) {
    return [];
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueAST.kind === VARIABLE) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (valueAST.kind === LIST) {
      return (valueAST: ListValue).values.reduce((acc, itemAST, index) => {
        const errors = isValidLiteralValue(itemType, itemAST);
        return acc.concat(errors.map(error =>
          `In element #${index}: ${error}`
        ));
      }, []);
    }
    return isValidLiteralValue(itemType, valueAST);
  }

  // Input objects check each defined field and look for undefined fields.
  if (type instanceof GraphQLInputObjectType) {
    if (valueAST.kind !== OBJECT) {
      return [ `Expected "${type.name}", found not an object.` ];
    }
    const fields = type.getFields();

    const errors = [];

    // Ensure every provided field is defined.
    const fieldASTs = (valueAST: ObjectValue).fields;
    for (const providedFieldAST of fieldASTs) {
      if (!fields[providedFieldAST.name.value]) {
        errors.push(
          `In field "${providedFieldAST.name.value}": Unknown field.`
        );
      }
    }

    // Ensure every defined field is valid.
    const fieldASTMap = keyMap(fieldASTs, fieldAST => fieldAST.name.value);
    for (const fieldName of Object.keys(fields)) {
      const result = isValidLiteralValue(
        fields[fieldName].type,
        fieldASTMap[fieldName] && fieldASTMap[fieldName].value
      );
      errors.push(...(result.map(error =>
        `In field "${fieldName}": ${error}`
      )));
    }

    return errors;
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  // Scalar/Enum input checks to ensure the type can parse the value to
  // a non-null value.
  const parseResult = type.parseLiteral(valueAST);
  if (isNullish(parseResult)) {
    return [ `Expected type "${type.name}", found ${print(valueAST)}.` ];
  }

  return [];
}
