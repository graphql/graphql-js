import { AccumulatorMap } from '../jsutils/AccumulatorMap.ts';
import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import { mapValue } from '../jsutils/mapValue.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type {
  DirectiveDefinitionNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  TypeDefinitionNode,
  TypeNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type {
  GraphQLArgumentConfig,
  GraphQLEnumValueConfigMap,
  GraphQLFieldConfig,
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
} from '../type/definition.ts';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLOneOfDirective,
  GraphQLSpecifiedByDirective,
  isSpecifiedDirective,
} from '../type/directives.ts';
import {
  introspectionTypes,
  isIntrospectionType,
} from '../type/introspection.ts';
import {
  isSpecifiedScalarType,
  specifiedScalarTypes,
} from '../type/scalars.ts';
import type {
  GraphQLSchemaNormalizedConfig,
  GraphQLSchemaValidationOptions,
} from '../type/schema.ts';
import { assertSchema, GraphQLSchema } from '../type/schema.ts';
import { assertValidSDLExtension } from '../validation/validate.ts';
import { getDirectiveValues } from '../execution/values.ts';
import { valueFromAST } from './valueFromAST.ts';
interface Options extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean | undefined;
}
/**
 * Produces a new schema given an existing schema and a document which may
 * contain GraphQL type extensions and definitions. The original schema will
 * remain unaltered.
 *
 * Because a schema represents a graph of references, a schema cannot be
 * extended without effectively making an entire copy. We do not know until it's
 * too late if subgraphs remain unchanged.
 *
 * This algorithm copies the provided schema, applying extensions while
 * producing the copy. The original schema remains unaltered.
 */
export function extendSchema(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  options?: Options,
): GraphQLSchema {
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
/**
 * @internal
 */
export function extendSchemaImpl(
  schemaConfig: GraphQLSchemaNormalizedConfig,
  documentAST: DocumentNode,
  options?: Options,
): GraphQLSchemaNormalizedConfig {
  // Collect the type definitions and extensions found in the document.
  const typeDefs: Array<TypeDefinitionNode> = [];
  const scalarExtensions = new AccumulatorMap<
    string,
    ScalarTypeExtensionNode
  >();
  const objectExtensions = new AccumulatorMap<
    string,
    ObjectTypeExtensionNode
  >();
  const interfaceExtensions = new AccumulatorMap<
    string,
    InterfaceTypeExtensionNode
  >();
  const unionExtensions = new AccumulatorMap<string, UnionTypeExtensionNode>();
  const enumExtensions = new AccumulatorMap<string, EnumTypeExtensionNode>();
  const inputObjectExtensions = new AccumulatorMap<
    string,
    InputObjectTypeExtensionNode
  >();
  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];
  let schemaDef: Maybe<SchemaDefinitionNode>;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];
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
      // Type Definitions
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        typeDefs.push(def);
        break;
      // Type System Extensions
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
  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (!isSchemaChanged) {
    return schemaConfig;
  }
  const typeMap = new Map<string, GraphQLNamedType>(
    schemaConfig.types.map((type) => [type.name, extendNamedType(type)]),
  );
  for (const typeNode of typeDefs) {
    const name = typeNode.name.value;
    typeMap.set(name, stdTypeMap.get(name) ?? buildType(typeNode));
  }
  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription:
      schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
    // Then, incorporate schema definition and all schema extensions.
    ...(schemaDef && getOperationTypes([schemaDef])),
    ...getOperationTypes(schemaExtensions),
  };
  // Then produce and return a Schema config with these types.
  return {
    description: schemaDef?.description?.value ?? schemaConfig.description,
    ...operationTypes,
    types: Array.from(typeMap.values()),
    directives: [
      ...schemaConfig.directives.map(replaceDirective),
      ...directiveDefs.map(buildDirective),
    ],
    extensions: schemaConfig.extensions,
    astNode: schemaDef ?? schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
    assumeValid: options?.assumeValid ?? false,
  };
  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.
  function replaceType<T extends GraphQLType>(type: T): T {
    if (isListType(type)) {
      // @ts-expect-error
      return new GraphQLList(replaceType(type.ofType));
    }
    if (isNonNullType(type)) {
      // @ts-expect-error
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    // @ts-expect-error FIXME
    return replaceNamedType(type);
  }
  function replaceNamedType<T extends GraphQLNamedType>(type: T): T {
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return typeMap.get(type.name) as T;
  }
  function replaceDirective(directive: GraphQLDirective): GraphQLDirective {
    if (isSpecifiedDirective(directive)) {
      // Builtin directives are not extended.
      return directive;
    }
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      args: mapValue(config.args, extendArg),
    });
  }
  function extendNamedType(type: GraphQLNamedType): GraphQLNamedType {
    if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
      // Builtin types are not extended.
      return type;
    }
    if (isScalarType(type)) {
      return extendScalarType(type);
    }
    if (isObjectType(type)) {
      return extendObjectType(type);
    }
    if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    }
    if (isUnionType(type)) {
      return extendUnionType(type);
    }
    if (isEnumType(type)) {
      return extendEnumType(type);
    }
    if (isInputObjectType(type)) {
      return extendInputObjectType(type);
    }
    /* c8 ignore next 3 */
    // Not reachable, all possible type definition nodes have been considered.
    false || invariant(false, 'Unexpected type: ' + inspect(type));
  }
  function extendInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const config = type.toConfig();
    const extensions = inputObjectExtensions.get(config.name) ?? [];
    return new GraphQLInputObjectType({
      ...config,
      fields: () => ({
        ...mapValue(config.fields, (field) => ({
          ...field,
          type: replaceType(field.type),
        })),
        ...buildInputFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const config = type.toConfig();
    const extensions = enumExtensions.get(type.name) ?? [];
    return new GraphQLEnumType({
      ...config,
      values: {
        ...config.values,
        ...buildEnumValueMap(extensions),
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendScalarType(type: GraphQLScalarType): GraphQLScalarType {
    const config = type.toConfig();
    const extensions = scalarExtensions.get(config.name) ?? [];
    let specifiedByURL = config.specifiedByURL;
    for (const extensionNode of extensions) {
      specifiedByURL = getSpecifiedByURL(extensionNode) ?? specifiedByURL;
    }
    return new GraphQLScalarType({
      ...config,
      specifiedByURL,
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const config = type.toConfig();
    const extensions = objectExtensions.get(config.name) ?? [];
    return new GraphQLObjectType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...buildInterfaces(extensions),
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        ...buildFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendInterfaceType(
    type: GraphQLInterfaceType,
  ): GraphQLInterfaceType {
    const config = type.toConfig();
    const extensions = interfaceExtensions.get(config.name) ?? [];
    return new GraphQLInterfaceType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...buildInterfaces(extensions),
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        ...buildFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const config = type.toConfig();
    const extensions = unionExtensions.get(config.name) ?? [];
    return new GraphQLUnionType({
      ...config,
      types: () => [
        ...type.getTypes().map(replaceNamedType),
        ...buildUnionTypes(extensions),
      ],
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }
  function extendField(
    field: GraphQLFieldConfig<unknown, unknown>,
  ): GraphQLFieldConfig<unknown, unknown> {
    return {
      ...field,
      type: replaceType(field.type),
      args: field.args && mapValue(field.args, extendArg),
    };
  }
  function extendArg(arg: GraphQLArgumentConfig) {
    return {
      ...arg,
      type: replaceType(arg.type),
    };
  }
  function getOperationTypes(
    nodes: ReadonlyArray<SchemaDefinitionNode | SchemaExtensionNode>,
  ): {
    query?: Maybe<GraphQLObjectType>;
    mutation?: Maybe<GraphQLObjectType>;
    subscription?: Maybe<GraphQLObjectType>;
  } {
    const opTypes = {};
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const operationTypesNodes =
        /* c8 ignore next */ node.operationTypes ?? [];
      for (const operationType of operationTypesNodes) {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        // @ts-expect-error
        opTypes[operationType.operation] = getNamedType(operationType.type);
      }
    }
    return opTypes;
  }
  function getNamedType(node: NamedTypeNode): GraphQLNamedType {
    const name = node.name.value;
    const type = stdTypeMap.get(name) ?? typeMap.get(name);
    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }
    return type;
  }
  function getWrappedType(node: TypeNode): GraphQLType {
    if (node.kind === Kind.LIST_TYPE) {
      return new GraphQLList(getWrappedType(node.type));
    }
    if (node.kind === Kind.NON_NULL_TYPE) {
      return new GraphQLNonNull(getWrappedType(node.type));
    }
    return getNamedType(node);
  }
  function buildDirective(node: DirectiveDefinitionNode): GraphQLDirective {
    return new GraphQLDirective({
      name: node.name.value,
      description: node.description?.value,
      // @ts-expect-error
      locations: node.locations.map(({ value }) => value),
      isRepeatable: node.repeatable,
      args: buildArgumentMap(node.arguments),
      astNode: node,
    });
  }
  function buildFieldMap(
    nodes: ReadonlyArray<
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode
    >,
  ): GraphQLFieldConfigMap<unknown, unknown> {
    const fieldConfigMap = Object.create(null);
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const nodeFields = /* c8 ignore next */ node.fields ?? [];
      for (const field of nodeFields) {
        fieldConfigMap[field.name.value] = {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          type: getWrappedType(field.type),
          description: field.description?.value,
          args: buildArgumentMap(field.arguments),
          deprecationReason: getDeprecationReason(field),
          astNode: field,
        };
      }
    }
    return fieldConfigMap;
  }
  function buildArgumentMap(
    args: Maybe<ReadonlyArray<InputValueDefinitionNode>>,
  ): GraphQLFieldConfigArgumentMap {
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    const argsNodes = /* c8 ignore next */ args ?? [];
    const argConfigMap = Object.create(null);
    for (const arg of argsNodes) {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      const type: any = getWrappedType(arg.type);
      argConfigMap[arg.name.value] = {
        type,
        description: arg.description?.value,
        defaultValue: valueFromAST(arg.defaultValue, type),
        deprecationReason: getDeprecationReason(arg),
        astNode: arg,
      };
    }
    return argConfigMap;
  }
  function buildInputFieldMap(
    nodes: ReadonlyArray<
      InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode
    >,
  ): GraphQLInputFieldConfigMap {
    const inputFieldMap = Object.create(null);
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const fieldsNodes = /* c8 ignore next */ node.fields ?? [];
      for (const field of fieldsNodes) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = getWrappedType(field.type);
        inputFieldMap[field.name.value] = {
          type,
          description: field.description?.value,
          defaultValue: valueFromAST(field.defaultValue, type),
          deprecationReason: getDeprecationReason(field),
          astNode: field,
        };
      }
    }
    return inputFieldMap;
  }
  function buildEnumValueMap(
    nodes: ReadonlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
  ): GraphQLEnumValueConfigMap {
    const enumValueMap = Object.create(null);
    for (const node of nodes) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      const valuesNodes = /* c8 ignore next */ node.values ?? [];
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
  function buildInterfaces(
    nodes: ReadonlyArray<
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode
    >,
  ): Array<GraphQLInterfaceType> {
    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    // @ts-expect-error
    return nodes.flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (node) => /* c8 ignore next */ node.interfaces?.map(getNamedType) ?? [],
    );
  }
  function buildUnionTypes(
    nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>,
  ): Array<GraphQLObjectType> {
    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    // @ts-expect-error
    return nodes.flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (node) => /* c8 ignore next */ node.types?.map(getNamedType) ?? [],
    );
  }
  function buildType(astNode: TypeDefinitionNode): GraphQLNamedType {
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
          values: buildEnumValueMap(allNodes),
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
        return new GraphQLScalarType({
          name,
          description: astNode.description?.value,
          specifiedByURL: getSpecifiedByURL(astNode),
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
}
const stdTypeMap = new Map(
  [...specifiedScalarTypes, ...introspectionTypes].map((type) => [
    type.name,
    type,
  ]),
);
/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(
  node:
    | EnumValueDefinitionNode
    | FieldDefinitionNode
    | InputValueDefinitionNode,
): Maybe<string> {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  // @ts-expect-error validated by `getDirectiveValues`
  return deprecated?.reason;
}
/**
 * Given a scalar node, returns the string value for the specifiedByURL.
 */
function getSpecifiedByURL(
  node: ScalarTypeDefinitionNode | ScalarTypeExtensionNode,
): Maybe<string> {
  const specifiedBy = getDirectiveValues(GraphQLSpecifiedByDirective, node);
  // @ts-expect-error validated by `getDirectiveValues`
  return specifiedBy?.url;
}
/**
 * Given an input object node, returns if the node should be OneOf.
 */
function isOneOf(node: InputObjectTypeDefinitionNode): boolean {
  return Boolean(getDirectiveValues(GraphQLOneOfDirective, node));
}
