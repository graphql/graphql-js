/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { forEach, isCollection } from 'iterall';
import isInvalid from '../jsutils/isInvalid';
import isNullish from '../jsutils/isNullish';
import orList from '../jsutils/orList';
import suggestionList from '../jsutils/suggestionList';
import { GraphQLError } from '../error';
import type { ASTNode } from '../language/ast';
import {
  isScalarType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
} from '../type/definition';
import type { GraphQLInputType } from '../type/definition';

type CoercedValue = {|
  +errors: $ReadOnlyArray<GraphQLError> | void,
  +value: mixed,
|};

type Path = {| +prev: Path | void, +key: string | number |};

/**
 * Coerces a JavaScript value given a GraphQL Type.
 *
 * Returns either a value which is valid for the provided type or a list of
 * encountered coercion errors.
 *
 */
export function coerceValue(
  value: mixed,
  type: GraphQLInputType,
  blameNode?: ASTNode,
  path?: Path,
): CoercedValue {
  // A value must be provided if the type is non-null.
  if (isNonNullType(type)) {
    if (isNullish(value)) {
      return ofErrors([
        coercionError(
          `Expected non-nullable type ${String(type)} not to be null`,
          blameNode,
          path,
        ),
      ]);
    }
    return coerceValue(value, type.ofType, blameNode, path);
  }

  if (isNullish(value)) {
    // Explicitly return the value null.
    return ofValue(null);
  }

  if (isScalarType(type)) {
    // Scalars determine if a value is valid via parseValue(), which can
    // throw to indicate failure. If it throws, maintain a reference to
    // the original error.
    try {
      const parseResult = type.parseValue(value);
      if (isInvalid(parseResult)) {
        return ofErrors([
          coercionError(`Expected type ${type.name}`, blameNode, path),
        ]);
      }
      return ofValue(parseResult);
    } catch (error) {
      return ofErrors([
        coercionError(
          `Expected type ${type.name}`,
          blameNode,
          path,
          error.message,
          error,
        ),
      ]);
    }
  }

  if (isEnumType(type)) {
    if (typeof value === 'string') {
      const enumValue = type.getValue(value);
      if (enumValue) {
        return ofValue(enumValue.value);
      }
    }
    const suggestions = suggestionList(
      String(value),
      type.getValues().map(enumValue => enumValue.name),
    );
    const didYouMean =
      suggestions.length !== 0
        ? `did you mean ${orList(suggestions)}?`
        : undefined;
    return ofErrors([
      coercionError(`Expected type ${type.name}`, blameNode, path, didYouMean),
    ]);
  }

  if (isListType(type)) {
    const itemType = type.ofType;
    if (isCollection(value)) {
      let errors;
      const coercedValue = [];
      forEach((value: any), (itemValue, index) => {
        const coercedItem = coerceValue(
          itemValue,
          itemType,
          blameNode,
          atPath(path, index),
        );
        if (coercedItem.errors) {
          errors = add(errors, coercedItem.errors);
        } else if (!errors) {
          coercedValue.push(coercedItem.value);
        }
      });
      return errors ? ofErrors(errors) : ofValue(coercedValue);
    }
    // Lists accept a non-list value as a list of one.
    const coercedItem = coerceValue(value, itemType, blameNode);
    return coercedItem.errors ? coercedItem : ofValue([coercedItem.value]);
  }

  if (isInputObjectType(type)) {
    if (typeof value !== 'object') {
      return ofErrors([
        coercionError(
          `Expected type ${type.name} to be an object`,
          blameNode,
          path,
        ),
      ]);
    }
    let errors;
    const coercedValue = {};
    const fields = type.getFields();

    // Ensure every defined field is valid.
    for (const fieldName in fields) {
      if (hasOwnProperty.call(fields, fieldName)) {
        const field = fields[fieldName];
        const fieldValue = value[fieldName];
        if (isInvalid(fieldValue)) {
          if (!isInvalid(field.defaultValue)) {
            coercedValue[fieldName] = field.defaultValue;
          } else if (isNonNullType(field.type)) {
            errors = add(
              errors,
              coercionError(
                `Field ${printPath(atPath(path, fieldName))} of required ` +
                  `type ${String(field.type)} was not provided`,
                blameNode,
              ),
            );
          }
        } else {
          const coercedField = coerceValue(
            fieldValue,
            field.type,
            blameNode,
            atPath(path, fieldName),
          );
          if (coercedField.errors) {
            errors = add(errors, coercedField.errors);
          } else if (!errors) {
            coercedValue[fieldName] = coercedField.value;
          }
        }
      }
    }

    // Ensure every provided field is defined.
    for (const fieldName in value) {
      if (hasOwnProperty.call(value, fieldName)) {
        if (!fields[fieldName]) {
          const suggestions = suggestionList(fieldName, Object.keys(fields));
          const didYouMean =
            suggestions.length !== 0
              ? `did you mean ${orList(suggestions)}?`
              : undefined;
          errors = add(
            errors,
            coercionError(
              `Field "${fieldName}" is not defined by type ${type.name}`,
              blameNode,
              path,
              didYouMean,
            ),
          );
        }
      }
    }

    return errors ? ofErrors(errors) : ofValue(coercedValue);
  }

  /* istanbul ignore next */
  throw new Error(`Unexpected type: ${(type: empty)}.`);
}

function ofValue(value) {
  return { errors: undefined, value };
}

function ofErrors(errors) {
  return { errors, value: undefined };
}

function add(errors, moreErrors) {
  return (errors || []).concat(moreErrors);
}

function atPath(prev, key) {
  return { prev, key };
}

function coercionError(message, blameNode, path, subMessage, originalError) {
  const pathStr = printPath(path);
  // Return a GraphQLError instance
  return new GraphQLError(
    message +
      (pathStr ? ' at ' + pathStr : '') +
      (subMessage ? '; ' + subMessage : '.'),
    blameNode,
    undefined,
    undefined,
    undefined,
    originalError,
  );
}

// Build a string describing the path into the value where the error was found
function printPath(path) {
  let pathStr = '';
  let currentPath = path;
  while (currentPath) {
    pathStr =
      (typeof currentPath.key === 'string'
        ? '.' + currentPath.key
        : '[' + String(currentPath.key) + ']') + pathStr;
    currentPath = currentPath.prev;
  }
  return pathStr ? 'value' + pathStr : '';
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
