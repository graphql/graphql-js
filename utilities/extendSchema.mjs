import { AccumulatorMap } from "../jsutils/AccumulatorMap.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { Kind } from "../language/kinds.mjs";
import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType, } from "../type/definition.mjs";
import { GraphQLDeprecatedDirective, GraphQLDirective, GraphQLOneOfDirective, GraphQLSpecifiedByDirective, } from "../type/directives.mjs";
import { introspectionTypes } from "../type/introspection.mjs";
import { specifiedScalarTypes } from "../type/scalars.mjs";
import { assertSchema, GraphQLSchema } from "../type/schema.mjs";
import { assertValidSDLExtension } from "../validation/validate.mjs";
import { getDirectiveValues } from "../execution/values.mjs";
import { mapSchemaConfig, SchemaElementKind } from "./mapSchemaConfig.mjs";
export function extendSchema(schema, documentAST, options) {
    assertSchema(schema);
    if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
        assertValidSDLExtension(documentAST, schema);
    }
    const schemaConfig = schema.toConfig();
    const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
    return schemaConfig === extendedConfig
        ? schema
        : new GraphQLSchema(extendedConfig);
}
export function extendSchemaImpl(schemaConfig, documentAST, options) {
    const typeDefs = [];
    const scalarExtensions = new AccumulatorMap();
    const objectExtensions = new AccumulatorMap();
    const interfaceExtensions = new AccumulatorMap();
    const unionExtensions = new AccumulatorMap();
    const enumExtensions = new AccumulatorMap();
    const inputObjectExtensions = new AccumulatorMap();
    const directiveExtensions = new AccumulatorMap();
    const directiveDefs = [];
    let schemaDef;
    const schemaExtensions = [];
    let isSchemaChanged = false;
    for (const def of documentAST.definitions) {
        switch (def.kind) {
            case Kind.SCHEMA_DEFINITION:
                schemaDef = def;
                break;
            case Kind.SCHEMA_EXTENSION:
                schemaExtensions.push(def);
                break;
            case Kind.DIRECTIVE_DEFINITION:
                directiveDefs.push(def);
                break;
            case Kind.DIRECTIVE_EXTENSION:
                directiveExtensions.add(def.name.value, def);
                break;
            case Kind.SCALAR_TYPE_DEFINITION:
            case Kind.OBJECT_TYPE_DEFINITION:
            case Kind.INTERFACE_TYPE_DEFINITION:
            case Kind.UNION_TYPE_DEFINITION:
            case Kind.ENUM_TYPE_DEFINITION:
            case Kind.INPUT_OBJECT_TYPE_DEFINITION:
                typeDefs.push(def);
                break;
            case Kind.SCALAR_TYPE_EXTENSION:
                scalarExtensions.add(def.name.value, def);
                break;
            case Kind.OBJECT_TYPE_EXTENSION:
                objectExtensions.add(def.name.value, def);
                break;
            case Kind.INTERFACE_TYPE_EXTENSION:
                interfaceExtensions.add(def.name.value, def);
                break;
            case Kind.UNION_TYPE_EXTENSION:
                unionExtensions.add(def.name.value, def);
                break;
            case Kind.ENUM_TYPE_EXTENSION:
                enumExtensions.add(def.name.value, def);
                break;
            case Kind.INPUT_OBJECT_TYPE_EXTENSION:
                inputObjectExtensions.add(def.name.value, def);
                break;
            default:
                continue;
        }
        isSchemaChanged = true;
    }
    if (!isSchemaChanged) {
        return schemaConfig;
    }
    return mapSchemaConfig(schemaConfig, (context) => {
        const { getNamedType, setNamedType, getNamedTypes } = context;
        return {
            [SchemaElementKind.SCHEMA]: (config) => {
                for (const typeNode of typeDefs) {
                    const type = stdTypeMap.get(typeNode.name.value) ?? buildNamedType(typeNode);
                    setNamedType(type);
                }
                const operationTypes = {
                    query: config.query &&
                        getNamedType(config.query.name),
                    mutation: config.mutation &&
                        getNamedType(config.mutation.name),
                    subscription: config.subscription &&
                        getNamedType(config.subscription.name),
                    ...(schemaDef && getOperationTypes([schemaDef])),
                    ...getOperationTypes(schemaExtensions),
                };
                return {
                    description: schemaDef?.description?.value ?? config.description,
                    ...operationTypes,
                    types: getNamedTypes(),
                    directives: [
                        ...config.directives.map(extendDirective),
                        ...directiveDefs.map(buildDirective),
                    ],
                    extensions: config.extensions,
                    astNode: schemaDef ?? config.astNode,
                    extensionASTNodes: config.extensionASTNodes.concat(schemaExtensions),
                    assumeValid: options?.assumeValid ?? false,
                };
            },
            [SchemaElementKind.INPUT_OBJECT]: (config) => {
                const extensions = inputObjectExtensions.get(config.name) ?? [];
                return {
                    ...config,
                    fields: () => ({
                        ...config.fields(),
                        ...buildInputFieldMap(extensions),
                    }),
                    extensionASTNodes: config.extensionASTNodes.concat(extensions),
                };
            },
            [SchemaElementKind.ENUM]: (config) => {
                const extensions = enumExtensions.get(config.name) ?? [];
                return {
                    ...config,
                    values: () => ({
                        ...config.values(),
                        ...buildEnumValueMap(extensions),
                    }),
                    extensionASTNodes: config.extensionASTNodes.concat(extensions),
                };
            },
            [SchemaElementKind.SCALAR]: (config) => {
                const extensions = scalarExtensions.get(config.name) ?? [];
                let specifiedByURL = config.specifiedByURL;
                for (const extensionNode of extensions) {
                    specifiedByURL = getSpecifiedByURL(extensionNode) ?? specifiedByURL;
                }
                return {
                    ...config,
                    specifiedByURL,
                    extensionASTNodes: config.extensionASTNodes.concat(extensions),
                };
            },
            [SchemaElementKind.OBJECT]: (config) => {
                const extensions = objectExtensions.get(config.name) ?? [];
                return {
                    ...config,
                    interfaces: () => [
                        ...config.interfaces(),
                        ...buildInterfaces(extensions),
                    ],
                    fields: () => ({
                        ...config.fields(),
                        ...buildFieldMap(extensions),
                    }),
                    extensionASTNodes: config.extensionASTNodes.concat(extensions),
                };
            },
            [SchemaElementKind.INTERFACE]: (config) => {
                const extensions = interfaceExtensions.get(config.name) ?? [];
                return {
                    ...config,
                    interfaces: () => [
                        ...config.interfaces(),
                        ...buildInterfaces(extensions),
                    ],
                    fields: () => ({
                        ...config.fields(),
                        ...buildFieldMap(extensions),
                    }),
                    extensionASTNodes: config.extensionASTNodes.concat(extensions),
                };
            },
            [SchemaElementKind.UNION]: (config) => {
                const extensions = unionExtensions.get(config.name) ?? [];
                return {
                    ...config,
                    types: () => [...config.types(), ...buildUnionTypes(extensions)],
                    extensionASTNodes: config.extensionASTNodes.concat(extensions),
                };
            },
        };
        function getOperationTypes(nodes) {
            const opTypes = {};
            for (const node of nodes) {
                const operationTypesNodes = node.operationTypes ?? [];
                for (const operationType of operationTypesNodes) {
                    opTypes[operationType.operation] = namedTypeFromAST(operationType.type);
                }
            }
            return opTypes;
        }
        function namedTypeFromAST(node) {
            const name = node.name.value;
            const type = getNamedType(name);
            if (!(type !== undefined))
                invariant(false, `Unknown type: "${name}".`);
            return type;
        }
        function typeFromAST(node) {
            if (node.kind === Kind.LIST_TYPE) {
                return new GraphQLList(typeFromAST(node.type));
            }
            if (node.kind === Kind.NON_NULL_TYPE) {
                return new GraphQLNonNull(typeFromAST(node.type));
            }
            return namedTypeFromAST(node);
        }
        function buildDirective(node) {
            const extensionASTNodes = directiveExtensions.get(node.name.value) ?? [];
            const deprecationReason = getDeprecationReason(node) ??
                extensionASTNodes
                    .map((extensionNode) => getDeprecationReason(extensionNode))
                    .find((reason) => reason != null);
            return new GraphQLDirective({
                name: node.name.value,
                description: node.description?.value,
                locations: node.locations.map(({ value }) => value),
                isRepeatable: node.repeatable,
                args: buildArgumentMap(node.arguments),
                deprecationReason,
                astNode: node,
                extensionASTNodes,
            });
        }
        function extendDirective(directive) {
            const extensionASTNodes = directiveExtensions.get(directive.name) ?? [];
            if (extensionASTNodes.length === 0) {
                return directive;
            }
            const deprecationReason = directive.deprecationReason ??
                extensionASTNodes
                    .map((extensionNode) => getDeprecationReason(extensionNode))
                    .find((reason) => reason != null);
            return new GraphQLDirective({
                ...directive.toConfig(),
                deprecationReason,
                extensionASTNodes: directive.extensionASTNodes.concat(extensionASTNodes),
            });
        }
        function buildFieldMap(nodes) {
            const fieldConfigMap = Object.create(null);
            for (const node of nodes) {
                const nodeFields = node.fields ?? [];
                for (const field of nodeFields) {
                    fieldConfigMap[field.name.value] = {
                        type: typeFromAST(field.type),
                        description: field.description?.value,
                        args: buildArgumentMap(field.arguments),
                        deprecationReason: getDeprecationReason(field),
                        astNode: field,
                    };
                }
            }
            return fieldConfigMap;
        }
        function buildArgumentMap(args) {
            const argsNodes = args ?? [];
            const argConfigMap = Object.create(null);
            for (const arg of argsNodes) {
                const type = typeFromAST(arg.type);
                argConfigMap[arg.name.value] = {
                    type,
                    description: arg.description?.value,
                    default: arg.defaultValue && { literal: arg.defaultValue },
                    deprecationReason: getDeprecationReason(arg),
                    astNode: arg,
                };
            }
            return argConfigMap;
        }
        function buildInputFieldMap(nodes) {
            const inputFieldMap = Object.create(null);
            for (const node of nodes) {
                const fieldsNodes = node.fields ?? [];
                for (const field of fieldsNodes) {
                    const type = typeFromAST(field.type);
                    inputFieldMap[field.name.value] = {
                        type,
                        description: field.description?.value,
                        default: field.defaultValue && { literal: field.defaultValue },
                        deprecationReason: getDeprecationReason(field),
                        astNode: field,
                    };
                }
            }
            return inputFieldMap;
        }
        function buildEnumValueMap(nodes) {
            const enumValueMap = Object.create(null);
            for (const node of nodes) {
                const valuesNodes = node.values ?? [];
                for (const value of valuesNodes) {
                    enumValueMap[value.name.value] = {
                        description: value.description?.value,
                        deprecationReason: getDeprecationReason(value),
                        astNode: value,
                    };
                }
            }
            return enumValueMap;
        }
        function buildInterfaces(nodes) {
            return nodes.flatMap((node) => node.interfaces?.map(namedTypeFromAST) ?? []);
        }
        function buildUnionTypes(nodes) {
            return nodes.flatMap((node) => node.types?.map(namedTypeFromAST) ?? []);
        }
        function buildNamedType(astNode) {
            const name = astNode.name.value;
            switch (astNode.kind) {
                case Kind.OBJECT_TYPE_DEFINITION: {
                    const extensionASTNodes = objectExtensions.get(name) ?? [];
                    const allNodes = [astNode, ...extensionASTNodes];
                    return new GraphQLObjectType({
                        name,
                        description: astNode.description?.value,
                        interfaces: () => buildInterfaces(allNodes),
                        fields: () => buildFieldMap(allNodes),
                        astNode,
                        extensionASTNodes,
                    });
                }
                case Kind.INTERFACE_TYPE_DEFINITION: {
                    const extensionASTNodes = interfaceExtensions.get(name) ?? [];
                    const allNodes = [astNode, ...extensionASTNodes];
                    return new GraphQLInterfaceType({
                        name,
                        description: astNode.description?.value,
                        interfaces: () => buildInterfaces(allNodes),
                        fields: () => buildFieldMap(allNodes),
                        astNode,
                        extensionASTNodes,
                    });
                }
                case Kind.ENUM_TYPE_DEFINITION: {
                    const extensionASTNodes = enumExtensions.get(name) ?? [];
                    const allNodes = [astNode, ...extensionASTNodes];
                    return new GraphQLEnumType({
                        name,
                        description: astNode.description?.value,
                        values: () => buildEnumValueMap(allNodes),
                        astNode,
                        extensionASTNodes,
                    });
                }
                case Kind.UNION_TYPE_DEFINITION: {
                    const extensionASTNodes = unionExtensions.get(name) ?? [];
                    const allNodes = [astNode, ...extensionASTNodes];
                    return new GraphQLUnionType({
                        name,
                        description: astNode.description?.value,
                        types: () => buildUnionTypes(allNodes),
                        astNode,
                        extensionASTNodes,
                    });
                }
                case Kind.SCALAR_TYPE_DEFINITION: {
                    const extensionASTNodes = scalarExtensions.get(name) ?? [];
                    let specifiedByURL = getSpecifiedByURL(astNode);
                    for (const extensionNode of extensionASTNodes) {
                        specifiedByURL = getSpecifiedByURL(extensionNode) ?? specifiedByURL;
                    }
                    return new GraphQLScalarType({
                        name,
                        description: astNode.description?.value,
                        specifiedByURL,
                        astNode,
                        extensionASTNodes,
                    });
                }
                case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
                    const extensionASTNodes = inputObjectExtensions.get(name) ?? [];
                    const allNodes = [astNode, ...extensionASTNodes];
                    return new GraphQLInputObjectType({
                        name,
                        description: astNode.description?.value,
                        fields: () => buildInputFieldMap(allNodes),
                        astNode,
                        extensionASTNodes,
                        isOneOf: isOneOf(astNode),
                    });
                }
            }
        }
    });
}
const stdTypeMap = new Map([...specifiedScalarTypes, ...introspectionTypes].map((type) => [
    type.name,
    type,
]));
function getDeprecationReason(node) {
    const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
    return deprecated?.reason;
}
function getSpecifiedByURL(node) {
    const specifiedBy = getDirectiveValues(GraphQLSpecifiedByDirective, node);
    return specifiedBy?.url;
}
function isOneOf(node) {
    return Boolean(getDirectiveValues(GraphQLOneOfDirective, node));
}
//# sourceMappingURL=extendSchema.mjs.map