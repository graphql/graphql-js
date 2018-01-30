/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ObjMap } from '../jsutils/ObjMap';
import keyValMap from '../jsutils/keyValMap';
import objectValues from '../jsutils/objectValues';
import { GraphQLSchema } from '../type/schema';
import { GraphQLDirective } from '../type/directives';
import { GraphQLList, GraphQLNonNull } from '../type/wrappers';
import type { GraphQLNamedType } from '../type/definition';
import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
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

  const sortMaybeType = maybeType => maybeType && sortNamedType(maybeType);
  return new GraphQLSchema({
    types: sortByName(objectValues(schema.getTypeMap()).map(sortNamedType)),
    directives: sortByName(schema.getDirectives()).map(sortDirective),
    query: sortMaybeType(schema.getQueryType()),
    mutation: sortMaybeType(schema.getMutationType()),
    subscription: sortMaybeType(schema.getSubscriptionType()),
    astNode: schema.astNode,
  });

  function sortDirective(directive) {
    return new GraphQLDirective({
      name: directive.name,
      description: directive.description,
      locations: sortBy(directive.locations, x => x),
      args: sortArgs(directive.args),
      astNode: directive.astNode,
    });
  }

  function sortArgs(args) {
    return keyValMap(
      sortByName(args),
      arg => arg.name,
      arg => ({
        ...arg,
        type: sortType(arg.type),
      }),
    );
  }

  function sortFields(fieldsMap) {
    return () =>
      sortObjMap(fieldsMap, field => ({
        type: sortType(field.type),
        args: sortArgs(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        description: field.description,
        astNode: field.astNode,
      }));
  }

  function sortInputFields(fieldsMap) {
    return () =>
      sortObjMap(fieldsMap, field => ({
        type: sortType(field.type),
        defaultValue: field.defaultValue,
        description: field.description,
        astNode: field.astNode,
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

  function sortTypes<T: GraphQLNamedType>(arr: Array<T>): () => Array<T> {
    return () => sortByName(arr).map(sortNamedType);
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
      return new GraphQLObjectType({
        name: type.name,
        interfaces: sortTypes(type.getInterfaces()),
        fields: sortFields(type.getFields()),
        isTypeOf: type.isTypeOf,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes,
      });
    } else if (isInterfaceType(type)) {
      return new GraphQLInterfaceType({
        name: type.name,
        fields: sortFields(type.getFields()),
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes,
      });
    } else if (isUnionType(type)) {
      return new GraphQLUnionType({
        name: type.name,
        types: sortTypes(type.getTypes()),
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
      });
    } else if (isEnumType(type)) {
      return new GraphQLEnumType({
        name: type.name,
        values: keyValMap(
          sortByName(type.getValues()),
          val => val.name,
          val => ({
            value: val.value,
            deprecationReason: val.deprecationReason,
            description: val.description,
            astNode: val.astNode,
          }),
        ),
        description: type.description,
        astNode: type.astNode,
      });
    } else if (isInputObjectType(type)) {
      return new GraphQLInputObjectType({
        name: type.name,
        fields: sortInputFields(type.getFields()),
        description: type.description,
        astNode: type.astNode,
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
