import type { ObjMap } from '../jsutils/ObjMap';
import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { keyValMap } from '../jsutils/keyValMap';
import { naturalCompare } from '../jsutils/naturalCompare';
import type { Maybe } from '../jsutils/Maybe';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLFieldConfigMap,
  GraphQLFieldConfigArgumentMap,
  GraphQLInputFieldConfigMap,
} from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import { GraphQLDirective } from '../type/directives';
import { isIntrospectionType } from '../type/introspection';
import {
  GraphQLList,
  GraphQLNonNull,
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

/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
export function lexicographicSortSchema(schema: GraphQLSchema): GraphQLSchema {
  const schemaConfig = schema.toConfig();
  const typeMap = keyValMap(
    sortByName(schemaConfig.types),
    (type) => type.name,
    sortNamedType,
  );

  return new GraphQLSchema({
    ...schemaConfig,
    types: Object.values(typeMap),
    directives: sortByName(schemaConfig.directives).map(sortDirective),
    query: replaceMaybeType(schemaConfig.query),
    mutation: replaceMaybeType(schemaConfig.mutation),
    subscription: replaceMaybeType(schemaConfig.subscription),
  });

  function replaceType<T extends GraphQLType>(type: T): T {
    if (isListType(type)) {
      // $FlowFixMe[incompatible-return]
      return new GraphQLList(replaceType(type.ofType));
    } else if (isNonNullType(type)) {
      // $FlowFixMe[incompatible-return]
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }

  function replaceNamedType<T extends GraphQLNamedType>(type: T): T {
    // $FlowFixMe[incompatible-return]
    return typeMap[type.name];
  }

  function replaceMaybeType<T extends Maybe<GraphQLNamedType>>(
    maybeType: T,
  ): T {
    return maybeType && replaceNamedType(maybeType);
  }

  function sortDirective(directive: GraphQLDirective) {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      locations: sortBy(config.locations, (x) => x),
      args: sortArgs(config.args),
    });
  }

  function sortArgs(args: GraphQLFieldConfigArgumentMap) {
    return sortObjMap(args, (arg) => ({
      ...arg,
      type: replaceType(arg.type),
    }));
  }

  function sortFields(fieldsMap: GraphQLFieldConfigMap<unknown, unknown>) {
    return sortObjMap(fieldsMap, (field) => ({
      ...field,
      type: replaceType(field.type),
      args: sortArgs(field.args),
    }));
  }

  function sortInputFields(fieldsMap: GraphQLInputFieldConfigMap) {
    return sortObjMap(fieldsMap, (field) => ({
      ...field,
      type: replaceType(field.type),
    }));
  }

  function sortTypes<T extends GraphQLNamedType>(
    array: ReadonlyArray<T>,
  ): Array<T> {
    return sortByName(array).map(replaceNamedType);
  }

  function sortNamedType(type: GraphQLNamedType): GraphQLNamedType {
    if (isScalarType(type) || isIntrospectionType(type)) {
      return type;
    }
    if (isObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLObjectType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields(config.fields),
      });
    }
    if (isInterfaceType(type)) {
      const config = type.toConfig();
      return new GraphQLInterfaceType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields(config.fields),
      });
    }
    if (isUnionType(type)) {
      const config = type.toConfig();
      return new GraphQLUnionType({
        ...config,
        types: () => sortTypes(config.types),
      });
    }
    if (isEnumType(type)) {
      const config = type.toConfig();
      return new GraphQLEnumType({
        ...config,
        values: sortObjMap(config.values, (value) => value),
      });
    }
    // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
    if (isInputObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLInputObjectType({
        ...config,
        fields: () => sortInputFields(config.fields),
      });
    }

    // istanbul ignore next (Not reachable. All possible types have been considered)
    invariant(false, 'Unexpected type: ' + inspect(type));
  }
}

function sortObjMap<T, R>(
  map: ObjMap<T>,
  sortValueFn: (value: T) => R,
): ObjMap<R> {
  const sortedMap = Object.create(null);
  const sortedEntries = sortBy(Object.entries(map), ([key]) => key);
  for (const [key, value] of sortedEntries) {
    sortedMap[key] = sortValueFn(value);
  }
  return sortedMap;
}

function sortByName<T extends { readonly name: string }>(
  array: ReadonlyArray<T>,
): Array<T> {
  return sortBy(array, (obj) => obj.name);
}

function sortBy<T>(
  array: ReadonlyArray<T>,
  mapToKey: (item: T) => string,
): Array<T> {
  return array.slice().sort((obj1, obj2) => {
    const key1 = mapToKey(obj1);
    const key2 = mapToKey(obj2);
    return naturalCompare(key1, key2);
  });
}
