import { naturalCompare } from '../jsutils/naturalCompare.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import { GraphQLSchema } from '../type/schema.js';

import { mapSchemaConfig, SchemaElementKind } from './mapSchemaConfig.js';

/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
export function lexicographicSortSchema(schema: GraphQLSchema): GraphQLSchema {
  return new GraphQLSchema(
    mapSchemaConfig(schema.toConfig(), () => ({
      [SchemaElementKind.OBJECT]: (config) => ({
        ...config,
        interfaces: () => sortByName(config.interfaces()),
        fields: () => sortObjMap(config.fields()),
      }),
      [SchemaElementKind.FIELD]: (config) => ({
        ...config,
        args: sortObjMap(config.args),
      }),
      [SchemaElementKind.INTERFACE]: (config) => ({
        ...config,
        interfaces: () => sortByName(config.interfaces()),
        fields: () => sortObjMap(config.fields()),
      }),
      [SchemaElementKind.UNION]: (config) => ({
        ...config,
        types: () => sortByName(config.types()),
      }),
      [SchemaElementKind.ENUM]: (config) => ({
        ...config,
        values: () => sortObjMap(config.values()),
      }),
      [SchemaElementKind.INPUT_OBJECT]: (config) => ({
        ...config,
        fields: () => sortObjMap(config.fields()),
      }),
      [SchemaElementKind.DIRECTIVE]: (config) => ({
        ...config,
        locations: sortBy(config.locations, (x) => x),
        args: sortObjMap(config.args),
      }),
      [SchemaElementKind.SCHEMA]: (config) => ({
        ...config,
        types: sortByName(config.types),
        directives: sortByName(config.directives),
      }),
    })),
  );
}

function sortObjMap<T, R>(map: ObjMap<T>): ObjMap<R> {
  const sortedMap = Object.create(null);
  for (const key of Object.keys(map).sort(naturalCompare)) {
    sortedMap[key] = map[key];
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
