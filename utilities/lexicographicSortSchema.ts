import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import { naturalCompare } from '../jsutils/naturalCompare.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type {
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLNamedType,
  GraphQLType,
} from '../type/definition.ts';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../type/definition.ts';
import { GraphQLDirective } from '../type/directives.ts';
import { isIntrospectionType } from '../type/introspection.ts';
import { GraphQLSchema } from '../type/schema.ts';
/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
export function lexicographicSortSchema(schema: GraphQLSchema): GraphQLSchema {
  const schemaConfig = schema.toConfig();
  const typeMap = new Map<string, GraphQLNamedType>(
    sortByName(schemaConfig.types).map((type) => [
      type.name,
      sortNamedType(type),
    ]),
  );
  return new GraphQLSchema({
    ...schemaConfig,
    types: Array.from(typeMap.values()),
    directives: sortByName(schemaConfig.directives).map(sortDirective),
    query: replaceMaybeType(schemaConfig.query),
    mutation: replaceMaybeType(schemaConfig.mutation),
    subscription: replaceMaybeType(schemaConfig.subscription),
  });
  function replaceType<T extends GraphQLType>(type: T): T {
    if (isListType(type)) {
      // @ts-expect-error
      return new GraphQLList(replaceType(type.ofType));
    } else if (isNonNullType(type)) {
      // @ts-expect-error
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    // @ts-expect-error FIXME: TS Conversion
    return replaceNamedType<GraphQLNamedType>(type);
  }
  function replaceNamedType<T extends GraphQLNamedType>(type: T): T {
    return typeMap.get(type.name) as T;
  }
  function replaceMaybeType<T extends GraphQLNamedType>(
    maybeType: Maybe<T>,
  ): Maybe<T> {
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
      args: field.args && sortArgs(field.args),
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
    if (isInputObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLInputObjectType({
        ...config,
        fields: () => sortInputFields(config.fields),
      });
    }
    /* c8 ignore next 3 */
    // Not reachable, all possible types have been considered.
    false || invariant(false, 'Unexpected type: ' + inspect(type));
  }
}
function sortObjMap<T, R>(
  map: ObjMap<T>,
  sortValueFn: (value: T) => R,
): ObjMap<R> {
  const sortedMap = Object.create(null);
  for (const key of Object.keys(map).sort(naturalCompare)) {
    sortedMap[key] = sortValueFn(map[key]);
  }
  return sortedMap;
}
function sortByName<
  T extends {
    readonly name: string;
  },
>(array: ReadonlyArray<T>): Array<T> {
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
