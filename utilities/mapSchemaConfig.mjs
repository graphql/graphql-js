import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType, isEnumType, isInputObjectType, isInterfaceType, isListType, isNonNullType, isObjectType, isScalarType, isUnionType, } from "../type/definition.mjs";
import { GraphQLDirective, isSpecifiedDirective } from "../type/directives.mjs";
import { introspectionTypes, isIntrospectionType, } from "../type/introspection.mjs";
import { isSpecifiedScalarType, specifiedScalarTypes, } from "../type/scalars.mjs";
/**
 * The set of GraphQL Schema Elements.
 */
export const SchemaElementKind = {
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
export function mapSchemaConfig(schemaConfig, configMapperMapFn) {
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
        if (isSpecifiedDirective(directive)) {
            // Builtin directives cannot be mapped.
            mappedDirectives.push(directive);
            continue;
        }
        const mappedDirectiveConfig = mapDirective(directive.toConfig());
        if (mappedDirectiveConfig) {
            mappedDirectives.push(new GraphQLDirective(mappedDirectiveConfig));
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
    const schemaMapper = configMapperMap[SchemaElementKind.SCHEMA];
    return schemaMapper == null
        ? mappedSchemaConfig
        : schemaMapper(mappedSchemaConfig);
    function getType(type) {
        if (isListType(type)) {
            return new GraphQLList(getType(type.ofType));
        }
        if (isNonNullType(type)) {
            return new GraphQLNonNull(getType(type.ofType));
        }
        return getNamedType(type.name);
    }
    function getNamedType(typeName) {
        const type = stdTypeMap.get(typeName) ?? mappedTypeMap.get(typeName);
        (type !== undefined) || invariant(false, `Unknown type: "${typeName}".`);
        return type;
    }
    function setNamedType(type) {
        mappedTypeMap.set(type.name, type);
    }
    function getNamedTypes() {
        return Array.from(mappedTypeMap.values());
    }
    function mapNamedType(type) {
        if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
            // Builtin types cannot be mapped.
            return type;
        }
        if (isScalarType(type)) {
            return mapScalarType(type);
        }
        if (isObjectType(type)) {
            return mapObjectType(type);
        }
        if (isInterfaceType(type)) {
            return mapInterfaceType(type);
        }
        if (isUnionType(type)) {
            return mapUnionType(type);
        }
        if (isEnumType(type)) {
            return mapEnumType(type);
        }
        if (isInputObjectType(type)) {
            return mapInputObjectType(type);
        }
        /* c8 ignore next 3 */
        // Not reachable, all possible type definition nodes have been considered.
        (false) || invariant(false, 'Unexpected type: ' + inspect(type));
    }
    function mapScalarType(type) {
        let mappedConfig = type.toConfig();
        const mapper = configMapperMap[SchemaElementKind.SCALAR];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new GraphQLScalarType(mappedConfig);
    }
    function mapObjectType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            interfaces: () => config.interfaces.map((iface) => getNamedType(iface.name)),
            fields: () => mapFields(config.fields, type.name),
        };
        const mapper = configMapperMap[SchemaElementKind.OBJECT];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new GraphQLObjectType(mappedConfig);
    }
    function mapFields(fieldMap, parentTypeName) {
        const newFieldMap = Object.create(null);
        for (const [fieldName, field] of Object.entries(fieldMap)) {
            let mappedField = {
                ...field,
                type: getType(field.type),
                args: mapArgs(field.args, parentTypeName, fieldName),
            };
            const mapper = configMapperMap[SchemaElementKind.FIELD];
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
            const mapper = configMapperMap[SchemaElementKind.ARGUMENT];
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
        const mapper = configMapperMap[SchemaElementKind.INTERFACE];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new GraphQLInterfaceType(mappedConfig);
    }
    function mapUnionType(type) {
        const config = type.toConfig();
        let mappedConfig = {
            ...config,
            types: () => config.types.map((memberType) => getNamedType(memberType.name)),
        };
        const mapper = configMapperMap[SchemaElementKind.UNION];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new GraphQLUnionType(mappedConfig);
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
        const mapper = configMapperMap[SchemaElementKind.ENUM];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new GraphQLEnumType(mappedConfig);
    }
    function mapEnumValue(valueConfig, valueName, enumName) {
        const mappedConfig = { ...valueConfig };
        const mapper = configMapperMap[SchemaElementKind.ENUM_VALUE];
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
        const mapper = configMapperMap[SchemaElementKind.INPUT_OBJECT];
        mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
        return new GraphQLInputObjectType(mappedConfig);
    }
    function mapInputField(inputFieldConfig, inputFieldName, inputObjectTypeName) {
        const mappedConfig = {
            ...inputFieldConfig,
            type: getType(inputFieldConfig.type),
        };
        const mapper = configMapperMap[SchemaElementKind.INPUT_FIELD];
        return mapper == null
            ? mappedConfig
            : mapper(mappedConfig, inputFieldName, inputObjectTypeName);
    }
    function mapDirective(config) {
        const mappedConfig = {
            ...config,
            args: mapArgs(config.args, config.name, undefined),
        };
        const mapper = configMapperMap[SchemaElementKind.DIRECTIVE];
        return mapper == null ? mappedConfig : mapper(mappedConfig);
    }
}
const stdTypeMap = new Map([...specifiedScalarTypes, ...introspectionTypes].map((type) => [
    type.name,
    type,
]));
//# sourceMappingURL=mapSchemaConfig.js.map