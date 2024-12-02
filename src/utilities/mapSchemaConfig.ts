import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import type { Maybe } from '../jsutils/Maybe.js';

import type {
  GraphQLArgumentNormalizedConfig,
  GraphQLEnumTypeNormalizedConfig,
  GraphQLEnumValueConfig,
  GraphQLFieldNormalizedConfig,
  GraphQLFieldNormalizedConfigArgumentMap,
  GraphQLFieldNormalizedConfigMap,
  GraphQLInputFieldConfig,
  GraphQLInputObjectTypeNormalizedConfig,
  GraphQLInterfaceTypeNormalizedConfig,
  GraphQLNamedType,
  GraphQLObjectTypeNormalizedConfig,
  GraphQLScalarTypeNormalizedConfig,
  GraphQLType,
  GraphQLUnionTypeNormalizedConfig,
} from '../type/definition.js';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../type/definition.js';
import type { GraphQLDirectiveNormalizedConfig } from '../type/directives.js';
import { GraphQLDirective, isSpecifiedDirective } from '../type/directives.js';
import {
  introspectionTypes,
  isIntrospectionType,
} from '../type/introspection.js';
import {
  isSpecifiedScalarType,
  specifiedScalarTypes,
} from '../type/scalars.js';
import type { GraphQLSchemaNormalizedConfig } from '../type/schema.js';

/**
 * The set of GraphQL Schema Elements.
 */
export const SchemaElementKind = {
  SCHEMA: 'SCHEMA' as const,
  SCALAR: 'SCALAR' as const,
  OBJECT: 'OBJECT' as const,
  FIELD: 'FIELD' as const,
  ARGUMENT: 'ARGUMENT' as const,
  INTERFACE: 'INTERFACE' as const,
  UNION: 'UNION' as const,
  ENUM: 'ENUM' as const,
  ENUM_VALUE: 'ENUM_VALUE' as const,
  INPUT_OBJECT: 'INPUT_OBJECT' as const,
  INPUT_FIELD: 'INPUT_FIELD' as const,
  DIRECTIVE: 'DIRECTIVE' as const,
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
type SchemaElementKind =
  (typeof SchemaElementKind)[keyof typeof SchemaElementKind];

export interface MappedSchemaContext {
  getNamedType: (typeName: string) => GraphQLNamedType;
  setNamedType: (type: GraphQLNamedType) => void;
  getNamedTypes: () => ReadonlyArray<GraphQLNamedType>;
}

type GraphQLScalarTypeMappedConfig = GraphQLScalarTypeNormalizedConfig<
  any,
  any
>;

type EnsureThunks<T, ThunkFields extends keyof T> = {
  [K in keyof T]: K extends ThunkFields ? () => T[K] : T[K];
};

type GraphQLObjectTypeMappedConfig = EnsureThunks<
  GraphQLObjectTypeNormalizedConfig<any, any>,
  'interfaces' | 'fields'
>;
type GraphQLInterfaceTypeMappedConfig = EnsureThunks<
  GraphQLInterfaceTypeNormalizedConfig<any, any>,
  'interfaces' | 'fields'
>;
type GraphQLUnionTypeMappedConfig = EnsureThunks<
  GraphQLUnionTypeNormalizedConfig,
  'types'
>;
type GraphQLEnumTypeMappedConfig = EnsureThunks<
  GraphQLEnumTypeNormalizedConfig,
  'values'
>;
type GraphQLInputObjectTypeMappedConfig = EnsureThunks<
  GraphQLInputObjectTypeNormalizedConfig,
  'fields'
>;

type ScalarTypeConfigMapper = (
  scalarConfig: GraphQLScalarTypeMappedConfig,
) => GraphQLScalarTypeMappedConfig;

type ObjectTypeConfigMapper = (
  objectConfig: GraphQLObjectTypeMappedConfig,
) => GraphQLObjectTypeMappedConfig;

type FieldConfigMapper = (
  fieldConfig: GraphQLFieldNormalizedConfig<any, any>,
  parentTypeName: string,
) => GraphQLFieldNormalizedConfig<any, any>;

type ArgumentConfigMapper = (
  argConfig: GraphQLArgumentNormalizedConfig,
  fieldOrDirectiveName: string,
  parentTypeName?: string,
) => GraphQLArgumentNormalizedConfig;

type InterfaceTypeConfigMapper = (
  interfaceConfig: GraphQLInterfaceTypeMappedConfig,
) => GraphQLInterfaceTypeMappedConfig;

type UnionTypeConfigMapper = (
  unionConfig: GraphQLUnionTypeMappedConfig,
) => GraphQLUnionTypeMappedConfig;

type EnumTypeConfigMapper = (
  enumConfig: GraphQLEnumTypeMappedConfig,
) => GraphQLEnumTypeMappedConfig;

type EnumValueConfigMapper = (
  enumValueConfig: GraphQLEnumValueConfig,
  valueName: string,
  enumName: string,
) => GraphQLEnumValueConfig;

type InputObjectTypeConfigMapper = (
  inputObjectConfig: GraphQLInputObjectTypeMappedConfig,
) => GraphQLInputObjectTypeMappedConfig;

type InputFieldConfigMapper = (
  inputFieldConfig: GraphQLInputFieldConfig,
  inputFieldName: string,
  inputObjectTypeName: string,
) => GraphQLInputFieldConfig;

type DirectiveConfigMapper = (
  directiveConfig: GraphQLDirectiveNormalizedConfig,
) => GraphQLDirectiveNormalizedConfig;

type SchemaConfigMapper = (
  originalSchemaConfig: GraphQLSchemaNormalizedConfig,
) => GraphQLSchemaNormalizedConfig;

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
export function mapSchemaConfig(
  schemaConfig: GraphQLSchemaNormalizedConfig,
  configMapperMapFn: (context: MappedSchemaContext) => ConfigMapperMap,
): GraphQLSchemaNormalizedConfig {
  const configMapperMap = configMapperMapFn({
    getNamedType,
    setNamedType,
    getNamedTypes,
  });

  const mappedTypeMap = new Map<string, GraphQLNamedType>();
  for (const type of schemaConfig.types) {
    const typeName = type.name;
    const mappedNamedType = mapNamedType(type);
    if (mappedNamedType) {
      mappedTypeMap.set(typeName, mappedNamedType);
    }
  }

  const mappedDirectives: Array<GraphQLDirective> = [];
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
    query:
      schemaConfig.query &&
      (getNamedType(schemaConfig.query.name) as GraphQLObjectType),
    mutation:
      schemaConfig.mutation &&
      (getNamedType(schemaConfig.mutation.name) as GraphQLObjectType),
    subscription:
      schemaConfig.subscription &&
      (getNamedType(schemaConfig.subscription.name) as GraphQLObjectType),
    types: Array.from(mappedTypeMap.values()),
    directives: mappedDirectives,
  };

  const schemaMapper = configMapperMap[SchemaElementKind.SCHEMA];

  return schemaMapper == null
    ? mappedSchemaConfig
    : schemaMapper(mappedSchemaConfig);

  function getType<T extends GraphQLType>(type: T): T {
    if (isListType(type)) {
      return new GraphQLList(getType(type.ofType)) as T;
    }
    if (isNonNullType(type)) {
      return new GraphQLNonNull(getType(type.ofType)) as T;
    }

    return getNamedType(type.name) as T;
  }

  function getNamedType(typeName: string): GraphQLNamedType {
    const type = stdTypeMap.get(typeName) ?? mappedTypeMap.get(typeName);
    invariant(type !== undefined, `Unknown type: "${typeName}".`);
    return type;
  }

  function setNamedType(type: GraphQLNamedType): void {
    mappedTypeMap.set(type.name, type);
  }

  function getNamedTypes(): ReadonlyArray<GraphQLNamedType> {
    return Array.from(mappedTypeMap.values());
  }

  function mapNamedType(type: GraphQLNamedType): Maybe<GraphQLNamedType> {
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
    invariant(false, 'Unexpected type: ' + inspect(type));
  }

  function mapScalarType(type: GraphQLScalarType): GraphQLScalarType {
    let mappedConfig: Maybe<GraphQLScalarTypeMappedConfig> = type.toConfig();
    const mapper = configMapperMap[SchemaElementKind.SCALAR];
    mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
    return new GraphQLScalarType(mappedConfig);
  }

  function mapObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const config = type.toConfig();
    let mappedConfig: Maybe<GraphQLObjectTypeMappedConfig> = {
      ...config,
      interfaces: () =>
        config.interfaces.map(
          (iface) => getNamedType(iface.name) as GraphQLInterfaceType,
        ),
      fields: () => mapFields(config.fields, type.name),
    };
    const mapper = configMapperMap[SchemaElementKind.OBJECT];
    mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
    return new GraphQLObjectType(mappedConfig);
  }

  function mapFields(
    fieldMap: GraphQLFieldNormalizedConfigMap<any, any>,
    parentTypeName: string,
  ): GraphQLFieldNormalizedConfigMap<any, any> {
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

  function mapArgs(
    argumentMap: GraphQLFieldNormalizedConfigArgumentMap,
    fieldOrDirectiveName: string,
    parentTypeName?: string,
  ): GraphQLFieldNormalizedConfigArgumentMap {
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

  function mapInterfaceType(type: GraphQLInterfaceType): GraphQLInterfaceType {
    const config = type.toConfig();
    let mappedConfig: Maybe<GraphQLInterfaceTypeMappedConfig> = {
      ...config,
      interfaces: () =>
        config.interfaces.map(
          (iface) => getNamedType(iface.name) as GraphQLInterfaceType,
        ),
      fields: () => mapFields(config.fields, type.name),
    };
    const mapper = configMapperMap[SchemaElementKind.INTERFACE];
    mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
    return new GraphQLInterfaceType(mappedConfig);
  }

  function mapUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const config = type.toConfig();
    let mappedConfig: Maybe<GraphQLUnionTypeMappedConfig> = {
      ...config,
      types: () =>
        config.types.map(
          (memberType) => getNamedType(memberType.name) as GraphQLObjectType,
        ),
    };
    const mapper = configMapperMap[SchemaElementKind.UNION];
    mappedConfig = mapper == null ? mappedConfig : mapper(mappedConfig);
    return new GraphQLUnionType(mappedConfig);
  }

  function mapEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const config = type.toConfig();
    let mappedConfig: Maybe<GraphQLEnumTypeMappedConfig> = {
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

  function mapEnumValue(
    valueConfig: GraphQLEnumValueConfig,
    valueName: string,
    enumName: string,
  ): GraphQLEnumValueConfig {
    const mappedConfig = { ...valueConfig };
    const mapper = configMapperMap[SchemaElementKind.ENUM_VALUE];
    return mapper == null
      ? mappedConfig
      : mapper(mappedConfig, valueName, enumName);
  }

  function mapInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const config = type.toConfig();
    let mappedConfig: Maybe<GraphQLInputObjectTypeMappedConfig> = {
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

  function mapInputField(
    inputFieldConfig: GraphQLInputFieldConfig,
    inputFieldName: string,
    inputObjectTypeName: string,
  ): GraphQLInputFieldConfig {
    const mappedConfig = {
      ...inputFieldConfig,
      type: getType(inputFieldConfig.type),
    };
    const mapper = configMapperMap[SchemaElementKind.INPUT_FIELD];
    return mapper == null
      ? mappedConfig
      : mapper(mappedConfig, inputFieldName, inputObjectTypeName);
  }

  function mapDirective(
    config: GraphQLDirectiveNormalizedConfig,
  ): Maybe<GraphQLDirectiveNormalizedConfig> {
    const mappedConfig = {
      ...config,
      args: mapArgs(config.args, config.name, undefined),
    };
    const mapper = configMapperMap[SchemaElementKind.DIRECTIVE];
    return mapper == null ? mappedConfig : mapper(mappedConfig);
  }
}

const stdTypeMap = new Map(
  [...specifiedScalarTypes, ...introspectionTypes].map((type) => [
    type.name,
    type,
  ]),
);
