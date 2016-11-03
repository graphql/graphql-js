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
import type {
  ValueNode,
  ListValueNode,
  ObjectValueNode
} from '../language/ast';
import {
  NULL,
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
 * Utility for validators which determines if a value literal node is valid
 * given an input type.
 *
 * Note that this only validates literal values, variables are assumed to
 * provide values of the correct type.
 */
export function isValidLiteralValue(
  type: GraphQLInputType,
  valueNode: ValueNode
): Array<string> {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (!valueNode || (valueNode.kind === NULL)) {
      return [ `Expected "${String(type)}", found null.` ];
    }
    return isValidLiteralValue(type.ofType, valueNode);
  }

  if (!valueNode || (valueNode.kind === NULL)) {
    return [];
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueNode.kind === VARIABLE) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (valueNode.kind === LIST) {
      return (valueNode: ListValueNode).values.reduce((acc, item, index) => {
        const errors = isValidLiteralValue(itemType, item);
        return acc.concat(errors.map(error =>
          `In element #${index}: ${error}`
        ));
      }, []);
    }
    return isValidLiteralValue(itemType, valueNode);
  }

  // Input objects check each defined field and look for undefined fields.
  if (type instanceof GraphQLInputObjectType) {
    if (valueNode.kind !== OBJECT) {
      return [ `Expected "${type.name}", found not an object.` ];
    }
    const fields = type.getFields();

    const errors = [];

    // Ensure every provided field is defined.
    const fieldNodes = (valueNode: ObjectValueNode).fields;
    fieldNodes.forEach(providedFieldNode => {
      if (!fields[providedFieldNode.name.value]) {
        errors.push(
          `In field "${providedFieldNode.name.value}": Unknown field.`
        );
      }
    });

    // Ensure every defined field is valid.
    const fieldNodeMap = keyMap(fieldNodes, fieldNode => fieldNode.name.value);
    Object.keys(fields).forEach(fieldName => {
      const result = isValidLiteralValue(
        fields[fieldName].type,
        fieldNodeMap[fieldName] && fieldNodeMap[fieldName].value
      );
      errors.push(...(result.map(error =>
        `In field "${fieldName}": ${error}`
      )));
    });

    return errors;
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  // Scalar/Enum input checks to ensure the type can parse the value to
  // a non-null value.
  const parseResult = type.parseLiteral(valueNode);
  if (isNullish(parseResult)) {
    return [ `Expected type "${type.name}", found ${print(valueNode)}.` ];
  }

  return [];
}
