"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaElementKind = void 0;
exports.mapSchemaConfig = mapSchemaConfig;
const inspect_js_1 = require("../jsutils/inspect.js");
const invariant_js_1 = require("../jsutils/invariant.js");
const definition_js_1 = require("../type/definition.js");
const directives_js_1 = require("../type/directives.js");
const introspection_js_1 = require("../type/introspection.js");
const scalars_js_1 = require("../type/scalars.js");
/**
 * The set of GraphQL Schema Elements.
 */
exports.SchemaElementKind = {
    SCHEMA: 'SCHEMA',
    SCALAR: 'SCALAR',
    OBJECT: 'OBJECT',
    FIELD: 'FIELD',
    ARGUMENT: 'ARGUMENT',
    INTERFACE: 'INTERFACE',
    UNION: 'UNION',
    ENUM: 'ENUM',
    ENUM_VALUE: 'ENUM_VALUE',
    INPUT_OBJECT: 'INPUT_OBJECT',
    INPUT_FIELD: 'INPUT_FIELD',
    DIRECTIVE: 'DIRECTIVE',
};
/**
 * @internal
 */
function mapSchemaConfig(schemaConfig, configMapperMapFn) {
    const configMapperMap = configMapperMapFn({
        getNamedType,
        setNamedType,
        getNamedTypes,
    });
    const mappedTypeMap = new Map();
    for (const type of schemaConfig.types) {
        const typeName = type.name;
        const mappedNamedType = mapNamedType(type);
        if (mappedNamedType) {
            mappedTypeMap.set(typeName, mappedNamedType);
        }
    }
    const mappedDirectives = [];
    for (const directive of schemaConfig.directives) {
        if ((0, directives_js_1.isSpecifiedDirective)(directive)) {
            // Builtin directives cannot be mapped.
            mappedDirectives.push(directive);
            continue;
        }
        const mappedDirectiveConfig = mapDirective(directive.toConfig());
        if (mappedDirectiveConfig) {
            mappedDirectives.push(new directives_js_1.GraphQLDirective(mappedDirectiveConfig));
        }
    }
    const mappedSchemaConfig = {
        ...schemaConfig,
        query: schemaConfig.query &&
            getNamedType(schemaConfig.query.name),
        mutation: schemaConfig.mutation &&
            getNamedType(schemaConfig.mutation.name),
        subscription: schemaConfig.subscription &&
            getNamedType(schemaConfig.subscription.name),
        types: Array.from(mappedTypeMap.values()),
        directives: mappedDirectives,
    };
    const schemaMapper = configMapperMap[exports.SchemaElementKind.SCHEMA];
    return schemaMapper == null
        ? mappedSchemaConfig
        : schemaMapper(mappedSchemaConfig);
    function getType(type) {
        if ((0, definition_js_1.isListType)(type)) {
            return new definition_js_1.GraphQLList(getType(type.ofType));
        }
        if ((0, definition_js_1.isNonNullType)(type)) {
            return new definition_js_1.GraphQLNonNull(getType(type.ofType));
        }
        return getNamedType(type.name);
    }
    function getNamedType(typeName) {
        const type = stdTypeMap.get(typeName) ?? mappedTypeMap.get(typeName);
        (type !== undefined) || (0, invariant_js_1.invariant)(false, `Unknown type: "${typeName}".`);
        return type;
    }
    function setNamedType(type) {
        mappedTypeMap.set(type.name, type);
    }
    function getNamedTypes() {
        return Array.from(mappedTypeMap.values());
    }
    function mapNamedType(type) {
        if ((0, introspection_js_1.isIntrospectionType)(type) || (0, scalars_js_1.isSpecifiedScalarType)(type)) {
            // Builtin types cannot be mapped.
            return type;
        }
        if ((0, definition_js_1.isScalarType)(type)) {
            return mapScalarType(type);
        }
        if ((0, definition_js_1.isObjectType)(type)) {
            return mapObjectType(type);
        }
        if ((0, definition_js_1.isInterfaceType)(type)) {
            return mapInterfaceType(type);
        }
        if ((0, definition_js_1.isUnionType)(type)) {
            return mapUnionType(type);
        }
        if ((0, definition_js_1.isEnumType)(type)) {
            return mapEnumType(type);
        }
        if ((0, definition_js_1.isInputObjectType)(type)) {
            return mapInputObjectType(type);
        }
        /* c8 ignore next 3 */
        // Not reachable, all possible type definition nodes have been considered.
        (false) || (0, invariant_js_1.invariant)(false, 'Unexpected type: ' + (0, inspect_js_1.inspect)(type));
    }
    function mapScalarType(type) {
        let mappedConfig = type.toConfig();
        const mapper = configMapperMap[exports.SchemaElementKind.SCALAR];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new definition_js_1.GraphQLScalarType(mappedConfig);
    }
    function mapObjectType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            interfaces: () => config.interfaces.map((iface) => getNamedType(iface.name)),
            fields: () => mapFields(config.fields, type.name),
        };
        const mapper = configMapperMap[exports.SchemaElementKind.OBJECT];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new definition_js_1.GraphQLObjectType(mappedConfig);
    }
    function mapFields(fieldMap, parentTypeName) {
        const newFieldMap = Object.create(null);
        for (const [fieldName, field] of Object.entries(fieldMap)) {
            let mappedField = {
                ...field,
                type: getType(field.type),
                args: mapArgs(field.args, parentTypeName, fieldName),
            };
            const mapper = configMapperMap[exports.SchemaElementKind.FIELD];
            if (mapper) {
                mappedField = mapper(mappedField, parentTypeName);
            }
            newFieldMap[fieldName] = mappedField;
        }
        return newFieldMap;
    }
    function mapArgs(argumentMap, fieldOrDirectiveName, parentTypeName) {
        const newArgumentMap = Object.create(null);
        for (const [argName, arg] of Object.entries(argumentMap)) {
            let mappedArg = {
                ...arg,
                type: getType(arg.type),
            };
            const mapper = configMapperMap[exports.SchemaElementKind.ARGUMENT];
            if (mapper) {
                mappedArg = mapper(mappedArg, fieldOrDirectiveName, parentTypeName);
            }
            newArgumentMap[argName] = mappedArg;
        }
        return newArgumentMap;
    }
    function mapInterfaceType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            interfaces: () => config.interfaces.map((iface) => getNamedType(iface.name)),
            fields: () => mapFields(config.fields, type.name),
        };
        const mapper = configMapperMap[exports.SchemaElementKind.INTERFACE];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new definition_js_1.GraphQLInterfaceType(mappedConfig);
    }
    function mapUnionType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            types: () => config.types.map((memberType) => getNamedType(memberType.name)),
        };
        const mapper = configMapperMap[exports.SchemaElementKind.UNION];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new definition_js_1.GraphQLUnionType(mappedConfig);
    }
    function mapEnumType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            values: () => {
                const newEnumValues = Object.create(null);
                for (const [valueName, value] of Object.entries(config.values)) {
                    const mappedValue = mapEnumValue(value, valueName, type.name);
                    newEnumValues[valueName] = mappedValue;
                }
                return newEnumValues;
            },
        };
        const mapper = configMapperMap[exports.SchemaElementKind.ENUM];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new definition_js_1.GraphQLEnumType(mappedConfig);
    }
    function mapEnumValue(valueConfig, valueName, enumName) {
        const mappedConfig = { ...valueConfig };
        const mapper = configMapperMap[exports.SchemaElementKind.ENUM_VALUE];
        return mapper == null
            ? mappedConfig
            : mapper(mappedConfig, valueName, enumName);
    }
    function mapInputObjectType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            fields: () => {
                const newInputFieldMap = Object.create(null);
                for (const [fieldName, field] of Object.entries(config.fields)) {
                    const mappedField = mapInputField(field, fieldName, type.name);
                    newInputFieldMap[fieldName] = mappedField;
                }
                return newInputFieldMap;
            },
        };
        const mapper = configMapperMap[exports.SchemaElementKind.INPUT_OBJECT];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new definition_js_1.GraphQLInputObjectType(mappedConfig);
    }
    function mapInputField(inputFieldConfig, inputFieldName, inputObjectTypeName) {
        const mappedConfig = {
            ...inputFieldConfig,
            type: getType(inputFieldConfig.type),
        };
        const mapper = configMapperMap[exports.SchemaElementKind.INPUT_FIELD];
        return mapper == null
            ? mappedConfig
            : mapper(mappedConfig, inputFieldName, inputObjectTypeName);
    }
    function mapDirective(config) {
        const mappedConfig = {
            ...config,
            args: mapArgs(config.args, config.name, undefined),
        };
        const mapper = configMapperMap[exports.SchemaElementKind.DIRECTIVE];
        return mapper == null ? mappedConfig : mapper(mappedConfig);
    }
}
const stdTypeMap = new Map([...scalars_js_1.specifiedScalarTypes, ...introspection_js_1.introspectionTypes].map((type) => [
    type.name,
    type,
]));
//# sourceMappingURL=mapSchemaConfig.js.map