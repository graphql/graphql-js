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
import isInvalid from '../jsutils/isInvalid';
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
export function isValidJSValue(
  value: mixed,
  type: GraphQLInputType,
): Array<string> {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (isNullish(value)) {
      return [`Expected "${String(type)}", found null.`];
    }
    return isValidJSValue(value, type.ofType);
  }

  if (isNullish(value)) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (isCollection(value)) {
      const errors = [];
      forEach((value: any), (item, index) => {
        errors.push.apply(
          errors,
          isValidJSValue(item, itemType).map(
            error => `In element #${index}: ${error}`,
          ),
        );
      });
      return errors;
    }
    return isValidJSValue(value, itemType);
  }

  // Input objects check each defined field.
  if (type instanceof GraphQLInputObjectType) {
    if (typeof value !== 'object' || value === null) {
      return [`Expected "${type.name}", found not an object.`];
    }
    const fields = type.getFields();

    const errors = [];

    // Ensure every provided field is defined.
    Object.keys(value).forEach(providedField => {
      if (!fields[providedField]) {
        errors.push(`In field "${providedField}": Unknown field.`);
      }
    });

    // Ensure every defined field is valid.
    Object.keys(fields).forEach(fieldName => {
      const newErrors = isValidJSValue(
        (value: any)[fieldName],
        fields[fieldName].type,
      );
      errors.push(
        ...newErrors.map(error => `In field "${fieldName}": ${error}`),
      );
    });

    return errors;
  }

  // Enum types only accept certain values
  if (type instanceof GraphQLEnumType) {
    if (typeof value !== 'string' || !type.getValue(value)) {
      const printed = JSON.stringify(value);
      return [`Expected type "${type.name}", found ${printed}.`];
    }

    return [];
  }

  invariant(type instanceof GraphQLScalarType, 'Must be scalar type');

  // Scalars determine if a value is valid via parseValue().
  try {
    const parseResult = type.parseValue(value);
    if (isInvalid(parseResult)) {
      return [`Expected type "${type.name}", found ${JSON.stringify(value)}.`];
    }
  } catch (error) {
    const printed = JSON.stringify(value);
    const message = error.message;
    return [`Expected type "${type.name}", found ${printed}; ${message}`];
  }

  return [];
}
