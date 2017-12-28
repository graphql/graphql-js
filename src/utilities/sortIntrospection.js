/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  IntrospectionQuery,
  IntrospectionType,
  IntrospectionField,
  IntrospectionDirective,
} from './introspectionQuery';

/**
 * Sort the result of Introspection Query.
 */
export function sortIntrospectionQuery(
  introspection: IntrospectionQuery,
): IntrospectionQuery {
  const schema = introspection.__schema;
  return {
    __schema: {
      queryType: schema.queryType,
      mutationType: schema.mutationType,
      subscriptionType: schema.subscriptionType,
      types: sortByName(schema.types, sortType),
      directives: sortByName(schema.directives, sortDirective),
    },
  };
}

function sortDirective(
  directive: IntrospectionDirective,
): IntrospectionDirective {
  return {
    name: directive.name,
    description: directive.description,
    locations: sortBy(directive.locations, x => x),
    args: sortByName(directive.args),
  };
}

function sortType(type: IntrospectionType): IntrospectionType {
  switch (type.kind) {
    case 'OBJECT':
      return {
        kind: 'OBJECT',
        name: type.name,
        description: type.description,
        fields: sortFields(type.fields),
        interfaces: sortByName(type.interfaces),
      };
    case 'INTERFACE':
      return {
        kind: 'INTERFACE',
        name: type.name,
        description: type.description,
        fields: sortFields(type.fields),
        possibleTypes: sortByName(type.possibleTypes),
      };
    case 'UNION':
      return {
        kind: 'UNION',
        name: type.name,
        description: type.description,
        possibleTypes: sortByName(type.possibleTypes),
      };
    case 'ENUM':
      return {
        kind: 'ENUM',
        name: type.name,
        description: type.description,
        enumValues: sortByName(type.enumValues),
      };
    case 'INPUT_OBJECT':
      return {
        kind: 'INPUT_OBJECT',
        name: type.name,
        description: type.description,
        inputFields: sortByName(type.inputFields),
      };
    case 'SCALAR':
      return type;
    default:
      throw new Error('Unexpected value kind: ' + (type.kind: empty));
  }
}

function sortFields(
  fields: $ReadOnlyArray<IntrospectionField>,
): $ReadOnlyArray<IntrospectionField> {
  return sortByName(fields, field => ({
    name: field.name,
    description: field.description,
    args: sortByName(field.args),
    type: field.type,
    isDeprecated: field.isDeprecated,
    deprecationReason: field.deprecationReason,
  }));
}

function sortByName<T: { +name: string }>(
  array: $ReadOnlyArray<T>,
  sortValue?: T => T,
): $ReadOnlyArray<T> {
  return sortBy(array, obj => obj.name, sortValue);
}

function sortBy<T>(
  array: $ReadOnlyArray<T>,
  mapToKey: T => string,
  sortValue?: T => T,
): $ReadOnlyArray<T> {
  if (array == null || !Array.isArray(array)) {
    return array;
  }

  const newArray = sortValue ? array.map(sortValue) : array.slice();
  return newArray.sort((obj1, obj2) => {
    const key1 = mapToKey(obj1);
    const key2 = mapToKey(obj2);
    return key1.localeCompare(key2);
  });
}
