"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lexicographicSortSchema = void 0;
const naturalCompare_js_1 = require("../jsutils/naturalCompare.js");
const schema_js_1 = require("../type/schema.js");
const mapSchemaConfig_js_1 = require("./mapSchemaConfig.js");
/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
function lexicographicSortSchema(schema) {
    return new schema_js_1.GraphQLSchema((0, mapSchemaConfig_js_1.mapSchemaConfig)(schema.toConfig(), () => ({
        [mapSchemaConfig_js_1.SchemaElementKind.OBJECT]: (config) => ({
            ...config,
            interfaces: () => sortByName(config.interfaces()),
            fields: () => sortObjMap(config.fields()),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.FIELD]: (config) => ({
            ...config,
            args: sortObjMap(config.args),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.INTERFACE]: (config) => ({
            ...config,
            interfaces: () => sortByName(config.interfaces()),
            fields: () => sortObjMap(config.fields()),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.UNION]: (config) => ({
            ...config,
            types: () => sortByName(config.types()),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.ENUM]: (config) => ({
            ...config,
            values: () => sortObjMap(config.values()),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.INPUT_OBJECT]: (config) => ({
            ...config,
            fields: () => sortObjMap(config.fields()),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.DIRECTIVE]: (config) => ({
            ...config,
            locations: sortBy(config.locations, (x) => x),
            args: sortObjMap(config.args),
        }),
        [mapSchemaConfig_js_1.SchemaElementKind.SCHEMA]: (config) => ({
            ...config,
            types: sortByName(config.types),
            directives: sortByName(config.directives),
        }),
    })));
}
exports.lexicographicSortSchema = lexicographicSortSchema;
function sortObjMap(map) {
    const sortedMap = Object.create(null);
    for (const key of Object.keys(map).sort(naturalCompare_js_1.naturalCompare)) {
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
        return (0, naturalCompare_js_1.naturalCompare)(key1, key2);
    });
}
//# sourceMappingURL=lexicographicSortSchema.js.map