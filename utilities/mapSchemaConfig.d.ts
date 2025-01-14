import type { GraphQLArgumentNormalizedConfig, GraphQLEnumTypeNormalizedConfig, GraphQLEnumValueConfig, GraphQLFieldNormalizedConfig, GraphQLInputFieldConfig, GraphQLInputObjectTypeNormalizedConfig, GraphQLInterfaceTypeNormalizedConfig, GraphQLNamedType, GraphQLObjectTypeNormalizedConfig, GraphQLScalarTypeNormalizedConfig, GraphQLUnionTypeNormalizedConfig } from '../type/definition.js';
import type { GraphQLDirectiveNormalizedConfig } from '../type/directives.js';
import type { GraphQLSchemaNormalizedConfig } from '../type/schema.js';
/**
 * The set of GraphQL Schema Elements.
 */
export declare const SchemaElementKind: {
    readonly SCHEMA: "SCHEMA";
    readonly SCALAR: "SCALAR";
    readonly OBJECT: "OBJECT";
    readonly FIELD: "FIELD";
    readonly ARGUMENT: "ARGUMENT";
    readonly INTERFACE: "INTERFACE";
    readonly UNION: "UNION";
    readonly ENUM: "ENUM";
    readonly ENUM_VALUE: "ENUM_VALUE";
    readonly INPUT_OBJECT: "INPUT_OBJECT";
    readonly INPUT_FIELD: "INPUT_FIELD";
    readonly DIRECTIVE: "DIRECTIVE";
};
type SchemaElementKind = (typeof SchemaElementKind)[keyof typeof SchemaElementKind];
export interface MappedSchemaContext {
    getNamedType: (typeName: string) => GraphQLNamedType;
    setNamedType: (type: GraphQLNamedType) => void;
    getNamedTypes: () => ReadonlyArray<GraphQLNamedType>;
}
type GraphQLScalarTypeMappedConfig = GraphQLScalarTypeNormalizedConfig<any, any>;
type EnsureThunks<T, ThunkFields extends keyof T> = {
    [K in keyof T]: K extends ThunkFields ? () => T[K] : T[K];
};
type GraphQLObjectTypeMappedConfig = EnsureThunks<GraphQLObjectTypeNormalizedConfig<any, any>, 'interfaces' | 'fields'>;
type GraphQLInterfaceTypeMappedConfig = EnsureThunks<GraphQLInterfaceTypeNormalizedConfig<any, any>, 'interfaces' | 'fields'>;
type GraphQLUnionTypeMappedConfig = EnsureThunks<GraphQLUnionTypeNormalizedConfig, 'types'>;
type GraphQLEnumTypeMappedConfig = EnsureThunks<GraphQLEnumTypeNormalizedConfig, 'values'>;
type GraphQLInputObjectTypeMappedConfig = EnsureThunks<GraphQLInputObjectTypeNormalizedConfig, 'fields'>;
type ScalarTypeConfigMapper = (scalarConfig: GraphQLScalarTypeMappedConfig) => GraphQLScalarTypeMappedConfig;
type ObjectTypeConfigMapper = (objectConfig: GraphQLObjectTypeMappedConfig) => GraphQLObjectTypeMappedConfig;
type FieldConfigMapper = (fieldConfig: GraphQLFieldNormalizedConfig<any, any>, parentTypeName: string) => GraphQLFieldNormalizedConfig<any, any>;
type ArgumentConfigMapper = (argConfig: GraphQLArgumentNormalizedConfig, fieldOrDirectiveName: string, parentTypeName?: string) => GraphQLArgumentNormalizedConfig;
type InterfaceTypeConfigMapper = (interfaceConfig: GraphQLInterfaceTypeMappedConfig) => GraphQLInterfaceTypeMappedConfig;
type UnionTypeConfigMapper = (unionConfig: GraphQLUnionTypeMappedConfig) => GraphQLUnionTypeMappedConfig;
type EnumTypeConfigMapper = (enumConfig: GraphQLEnumTypeMappedConfig) => GraphQLEnumTypeMappedConfig;
type EnumValueConfigMapper = (enumValueConfig: GraphQLEnumValueConfig, valueName: string, enumName: string) => GraphQLEnumValueConfig;
type InputObjectTypeConfigMapper = (inputObjectConfig: GraphQLInputObjectTypeMappedConfig) => GraphQLInputObjectTypeMappedConfig;
type InputFieldConfigMapper = (inputFieldConfig: GraphQLInputFieldConfig, inputFieldName: string, inputObjectTypeName: string) => GraphQLInputFieldConfig;
type DirectiveConfigMapper = (directiveConfig: GraphQLDirectiveNormalizedConfig) => GraphQLDirectiveNormalizedConfig;
type SchemaConfigMapper = (originalSchemaConfig: GraphQLSchemaNormalizedConfig) => GraphQLSchemaNormalizedConfig;
export interface ConfigMapperMap {
    [SchemaElementKind.SCALAR]?: ScalarTypeConfigMapper;
    [SchemaElementKind.OBJECT]?: ObjectTypeConfigMapper;
    [SchemaElementKind.FIELD]?: FieldConfigMapper;
    [SchemaElementKind.ARGUMENT]?: ArgumentConfigMapper;
    [SchemaElementKind.INTERFACE]?: InterfaceTypeConfigMapper;
    [SchemaElementKind.UNION]?: UnionTypeConfigMapper;
    [SchemaElementKind.ENUM]?: EnumTypeConfigMapper;
    [SchemaElementKind.ENUM_VALUE]?: EnumValueConfigMapper;
    [SchemaElementKind.INPUT_OBJECT]?: InputObjectTypeConfigMapper;
    [SchemaElementKind.INPUT_FIELD]?: InputFieldConfigMapper;
    [SchemaElementKind.DIRECTIVE]?: DirectiveConfigMapper;
    [SchemaElementKind.SCHEMA]?: SchemaConfigMapper;
}
/**
 * @internal
 */
export declare function mapSchemaConfig(schemaConfig: GraphQLSchemaNormalizedConfig, configMapperMapFn: (context: MappedSchemaContext) => ConfigMapperMap): GraphQLSchemaNormalizedConfig;
export {};
