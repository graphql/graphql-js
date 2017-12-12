/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { print } from '../language/printer';
import type {
  ValueNode,
  ListValueNode,
  ObjectValueNode,
} from '../language/ast';
import * as Kind from '../language/kinds';
import {
  isScalarType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
} from '../type/definition';
import type { GraphQLInputType } from '../type/definition';
import isInvalid from '../jsutils/isInvalid';
import keyMap from '../jsutils/keyMap';

/**
 * Utility for validators which determines if a value literal node is valid
 * given an input type.
 *
 * Note that this only validates literal values, variables are assumed to
 * provide values of the correct type.
 */
export function isValidLiteralValue(
  type: GraphQLInputType,
  valueNode: ValueNode,
): Array<string> {
  // A value must be provided if the type is non-null.
  if (isNonNullType(type)) {
    if (!valueNode || valueNode.kind === Kind.NULL) {
      return [`Expected "${String(type)}", found null.`];
    }
    return isValidLiteralValue(type.ofType, valueNode);
  }

  if (!valueNode || valueNode.kind === Kind.NULL) {
    return [];
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueNode.kind === Kind.VARIABLE) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (isListType(type)) {
    const itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      return (valueNode: ListValueNode).values.reduce((acc, item, index) => {
        const errors = isValidLiteralValue(itemType, item);
        return acc.concat(
          errors.map(error => `In element #${index}: ${error}`),
        );
      }, []);
    }
    return isValidLiteralValue(itemType, valueNode);
  }

  // Input objects check each defined field and look for undefined fields.
  if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      return [`Expected "${type.name}", found not an object.`];
    }
    const fields = type.getFields();

    const errors = [];

    // Ensure every provided field is defined.
    const fieldNodes = (valueNode: ObjectValueNode).fields;
    fieldNodes.forEach(providedFieldNode => {
      if (!fields[providedFieldNode.name.value]) {
        errors.push(
          `In field "${providedFieldNode.name.value}": Unknown field.`,
        );
      }
    });

    // Ensure every defined field is valid.
    const fieldNodeMap = keyMap(fieldNodes, fieldNode => fieldNode.name.value);
    Object.keys(fields).forEach(fieldName => {
      const result = isValidLiteralValue(
        fields[fieldName].type,
        fieldNodeMap[fieldName] && fieldNodeMap[fieldName].value,
      );
      errors.push(...result.map(error => `In field "${fieldName}": ${error}`));
    });

    return errors;
  }

  if (isEnumType(type)) {
    if (valueNode.kind !== Kind.ENUM || !type.getValue(valueNode.value)) {
      return [`Expected type "${type.name}", found ${print(valueNode)}.`];
    }

    return [];
  }

  if (isScalarType(type)) {
    // Scalars determine if a literal value is valid via parseLiteral().
    try {
      const parseResult = type.parseLiteral(valueNode, null);
      if (isInvalid(parseResult)) {
        return [`Expected type "${type.name}", found ${print(valueNode)}.`];
      }
    } catch (error) {
      const printed = print(valueNode);
      const message = error.message;
      return [`Expected type "${type.name}", found ${printed}; ${message}`];
    }

    return [];
  }

  /* istanbul ignore next */
  throw new Error(`Unknown type: ${(type: empty)}.`);
}
