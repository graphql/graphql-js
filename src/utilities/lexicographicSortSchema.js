/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ObjMap } from '../jsutils/ObjMap';
import { GraphQLSchema } from '../type/schema';
import { GraphQLDirective } from '../type/directives';
import type { GraphQLNamedType } from '../type/definition';
import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  isListType,
  isNonNullType,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
} from '../type/definition';
import { isSpecifiedScalarType } from '../type/scalars';
import { isIntrospectionType } from '../type/introspection';

/**
 * Sort GraphQLSchema.
 */
export function lexicographicSortSchema(schema: GraphQLSchema): GraphQLSchema {
  const cache = Object.create(null);

  const schemaConfig = schema.toConfig();
  const sortMaybeType = maybeType => maybeType && sortNamedType(maybeType);
  return new GraphQLSchema({
    ...schemaConfig,
    types: sortTypes(schemaConfig.types),
    directives: sortByName(schemaConfig.directives).map(sortDirective),
    query: sortMaybeType(schemaConfig.query),
    mutation: sortMaybeType(schemaConfig.mutation),
    subscription: sortMaybeType(schemaConfig.subscription),
  });

  function sortDirective(directive) {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      locations: sortBy(config.locations, x => x),
      args: sortArgs(config.args),
    });
  }

  function sortArgs(args) {
    return sortObjMap(args, arg => ({
      ...arg,
      type: sortType(arg.type),
    }));
  }

  function sortFields(fieldsMap) {
    return sortObjMap(fieldsMap, field => ({
      ...field,
      type: sortType(field.type),
      args: sortArgs(field.args),
    }));
  }

  function sortInputFields(fieldsMap) {
    return sortObjMap(fieldsMap, field => ({
      ...field,
      type: sortType(field.type),
    }));
  }

  function sortType(type) {
    if (isListType(type)) {
      return new GraphQLList(sortType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(sortType(type.ofType));
    }
    return sortNamedType(type);
  }

  function sortTypes<T: GraphQLNamedType>(arr: Array<T>): Array<T> {
    return sortByName(arr).map(sortNamedType);
  }

  function sortNamedType<T: GraphQLNamedType>(type: T): T {
    if (isSpecifiedScalarType(type) || isIntrospectionType(type)) {
      return type;
    }

    let sortedType = cache[type.name];
    if (!sortedType) {
      sortedType = sortNamedTypeImpl(type);
      cache[type.name] = sortedType;
    }
    return ((sortedType: any): T);
  }

  function sortNamedTypeImpl(type) {
    if (isScalarType(type)) {
      return type;
    } else if (isObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLObjectType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields(config.fields),
      });
    } else if (isInterfaceType(type)) {
      const config = type.toConfig();
      return new GraphQLInterfaceType({
        ...config,
        fields: () => sortFields(config.fields),
      });
    } else if (isUnionType(type)) {
      const config = type.toConfig();
      return new GraphQLUnionType({
        ...config,
        types: () => sortTypes(config.types),
      });
    } else if (isEnumType(type)) {
      const config = type.toConfig();
      return new GraphQLEnumType({
        ...config,
        values: sortObjMap(config.values),
      });
    } else if (isInputObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLInputObjectType({
        ...config,
        fields: () => sortInputFields(config.fields),
      });
    }
    throw new Error(`Unknown type: "${type}"`);
  }
}

function sortObjMap<T, R>(map: ObjMap<T>, sortValueFn?: T => R): ObjMap<R> {
  const sortedMap = Object.create(null);
  const sortedKeys = sortBy(Object.keys(map), x => x);
  for (const key of sortedKeys) {
    const value = map[key];
    sortedMap[key] = sortValueFn ? sortValueFn(value) : value;
  }
  return sortedMap;
}

function sortByName<T: { +name: string }>(array: $ReadOnlyArray<T>): Array<T> {
  return sortBy(array, obj => obj.name);
}

function sortBy<T>(array: $ReadOnlyArray<T>, mapToKey: T => string): Array<T> {
  return array.slice().sort((obj1, obj2) => {
    const key1 = mapToKey(obj1);
    const key2 = mapToKey(obj2);
    return key1.localeCompare(key2);
  });
}
