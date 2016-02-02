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
import {
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import type { GraphQLInputType } from '../type/definition';


/**
 * Given a JavaScript value and a GraphQL type, determine if the value will be
 * accepted for that type. This is primarily useful for validating the
 * runtime values of query variables.
 */
export function isValidJSValue(value: mixed, type: GraphQLInputType): [string] {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (isNullish(value)) {
      if (type.ofType.name) {
        return [ `Expected "${type.ofType.name}!", found null.` ];
      }
      return [ 'Expected non-null value, found null.' ];
    }
    return isValidJSValue(value, type.ofType);
  }

  if (isNullish(value)) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (Array.isArray(value)) {
      return value.reduce((acc, item, index) => {
        const errors = isValidJSValue(item, itemType);
        return acc.concat(errors.map(error =>
          `In element #${index}: ${error}`
        ));
      }, []);
    }
    return isValidJSValue(value, itemType);
  }

  // Input objects check each defined field.
  if (type instanceof GraphQLInputObjectType) {
    if (typeof value !== 'object' || value === null) {
      return [ `Expected "${type.name}", found not an object.` ];
    }
    const fields = type.getFields();

    const errors = [];

    // Ensure every provided field is defined.
    for (const providedField of Object.keys(value)) {
      if (!fields[providedField]) {
        errors.push(`In field "${providedField}": Unknown field.`);
      }
    }

    // Ensure every defined field is valid.
    for (const fieldName of Object.keys(fields)) {
      const newErrors =
        isValidJSValue(value[fieldName], fields[fieldName].type);
      errors.push(...(newErrors.map(error =>
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
  const parseResult = type.parseValue(value);
  if (isNullish(parseResult)) {
    return [
      `Expected type "${type.name}", found ${JSON.stringify(value)}.`
    ];
  }

  return [];
}
