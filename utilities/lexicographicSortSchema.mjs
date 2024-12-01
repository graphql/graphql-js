import { naturalCompare } from "../jsutils/naturalCompare.mjs";
import { GraphQLSchema } from "../type/schema.mjs";
import { mapSchemaConfig, SchemaElementKind } from "./mapSchemaConfig.mjs";
/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
export function lexicographicSortSchema(schema) {
    return new GraphQLSchema(mapSchemaConfig(schema.toConfig(), () => ({
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
    })));
}
function sortObjMap(map) {
    const sortedMap = Object.create(null);
    for (const key of Object.keys(map).sort(naturalCompare)) {
        sortedMap[key] = map[key];
    }
    return sortedMap;
}
function sortByName(array) {
    return sortBy(array, (obj) => obj.name);
}
function sortBy(array, mapToKey) {
    return array.slice().sort((obj1, obj2) => {
        const key1 = mapToKey(obj1);
        const key2 = mapToKey(obj2);
        return naturalCompare(key1, key2);
    });
}
//# sourceMappingURL=lexicographicSortSchema.js.map