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
export function isValidJSValue(value: any, type: GraphQLInputType): boolean {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (isNullish(value)) {
      return false;
    }
    var nullableType: GraphQLInputType = (type.ofType: any);
    return isValidJSValue(value, nullableType);
  }

  if (isNullish(value)) {
    return true;
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    var itemType: GraphQLInputType = (type.ofType: any);
    if (Array.isArray(value)) {
      return value.every(item => isValidJSValue(item, itemType));
    }
    return isValidJSValue(value, itemType);
  }

  // Input objects check each defined field.
  if (type instanceof GraphQLInputObjectType) {
    if (typeof value !== 'object') {
      return false;
    }
    var fields = type.getFields();

    // Ensure every provided field is defined.
    if (Object.keys(value).some(fieldName => !fields[fieldName])) {
      return false;
    }

    // Ensure every defined field is valid.
    return Object.keys(fields).every(
      fieldName => isValidJSValue(value[fieldName], fields[fieldName].type)
    );
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  // Scalar/Enum input checks to ensure the type can parse the value to
  // a non-null value.
  return !isNullish(type.parseVariable(value));
}
