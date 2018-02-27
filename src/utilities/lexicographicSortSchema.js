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
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';
import { SchemaTransformer } from './transformSchema';

/**
 * Sort GraphQLSchema.
 */
export function lexicographicSortSchema(schema: GraphQLSchema): GraphQLSchema {
  const transformer = new SchemaTransformer(schema, {
    Schema(config) {
      return new GraphQLSchema({
        ...config,
        types: sortByName(config.types),
        directives: sortByName(config.directives),
      });
    },
    Directive(config) {
      return new GraphQLDirective({
        ...config,
        locations: sortBy(config.locations, x => x),
        args: sortObjMap(config.args),
      });
    },
    ScalarType(config) {
      return new GraphQLScalarType(config);
    },
    ObjectType(config) {
      return new GraphQLObjectType({
        ...config,
        fields: () => sortFields(config.fields()),
        interfaces: () => sortByName(config.interfaces()),
      });
    },
    InterfaceType(config) {
      return new GraphQLInterfaceType({
        ...config,
        fields: () => sortFields(config.fields()),
      });
    },
    UnionType(config) {
      return new GraphQLUnionType({
        ...config,
        types: () => sortByName(config.types()),
      });
    },
    EnumType(config) {
      return new GraphQLEnumType({
        ...config,
        values: sortObjMap(config.values),
      });
    },
    InputObjectType(config) {
      return new GraphQLInputObjectType({
        ...config,
        fields: () => sortObjMap(config.fields()),
      });
    },
  });

  return transformer.transformSchema();
}

function sortFields(fields) {
  return sortObjMap(fields, field => ({
    ...field,
    args: sortObjMap(field.args),
  }));
}

function sortObjMap<T>(map: ObjMap<T>, sortValueFn?: T => T): ObjMap<T> {
  const sortedMap = Object.create(null);
  const sortedKeys = sortBy(Object.keys(map), x => x);
  for (const key of sortedKeys) {
    const value = map[key];
    sortedMap[key] = sortValueFn ? sortValueFn(value) : value;
  }
  return sortedMap;
}

function sortByName<T: { +name: string }>(array: Array<T>): Array<T> {
  return sortBy(array, obj => obj.name);
}

function sortBy<T>(array: Array<T>, mapToKey: T => string): Array<T> {
  return array.slice().sort((obj1, obj2) => {
    const key1 = mapToKey(obj1);
    const key2 = mapToKey(obj2);
    return key1.localeCompare(key2);
  });
}
