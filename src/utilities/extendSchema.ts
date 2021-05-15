import { keyMap } from '../jsutils/keyMap';
import { inspect } from '../jsutils/inspect';
import { mapValue } from '../jsutils/mapValue';
import { invariant } from '../jsutils/invariant';
import { devAssert } from '../jsutils/devAssert';
import type { Maybe } from '../jsutils/Maybe';

import type {
  DocumentNode,
  TypeNode,
  NamedTypeNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  TypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  DirectiveDefinitionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../language/predicates';

import { assertValidSDLExtension } from '../validation/validate';

import { getDirectiveValues } from '../execution/values';

import type {
  GraphQLSchemaValidationOptions,
  GraphQLSchemaNormalizedConfig,
} from '../type/schema';
import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLArgumentConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLEnumValueConfigMap,
  GraphQLInputFieldConfigMap,
} from '../type/definition';
import { assertSchema, GraphQLSchema } from '../type/schema';
import { specifiedScalarTypes, isSpecifiedScalarType } from '../type/scalars';
import { introspectionTypes, isIntrospectionType } from '../type/introspection';
import {
  GraphQLDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
} from '../type/directives';
import {
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isListType,
  isNonNullType,
  isEnumType,
  isInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';

import { valueFromAST } from './valueFromAST';

interface Options extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean;
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

  devAssert(
    documentAST != null && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST.',
  );

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
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  let schemaDef: Maybe<SchemaDefinitionNode>;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];

  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (def.kind === Kind.SCHEMA_EXTENSION) {
      schemaExtensions.push(def);
    } else if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (isTypeExtensionNode(def)) {
      const extendedTypeName = def.name.value;
      const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
      typeExtensionsMap[extendedTypeName] = existingTypeExtensions
        ? existingTypeExtensions.concat([def])
        : [def];
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (
    Object.keys(typeExtensionsMap).length === 0 &&
    typeDefs.length === 0 &&
    directiveDefs.length === 0 &&
    schemaExtensions.length === 0 &&
    schemaDef == null
  ) {
    return schemaConfig;
  }

  const typeMap = Object.create(null);
  for (const existingType of schemaConfig.types) {
    typeMap[existingType.name] = extendNamedType(existingType);
  }

  for (const typeNode of typeDefs) {
    const name = typeNode.name.value;
    typeMap[name] = stdTypeMap[name] ?? buildType(typeNode);
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
    description: schemaDef?.description?.value,
    ...operationTypes,
    types: Object.values(typeMap),
    directives: [
      ...schemaConfig.directives.map(replaceDirective),
      ...directiveDefs.map(buildDirective),
    ],
    extensions: undefined,
    astNode: schemaDef ?? schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
    assumeValid: options?.assumeValid ?? false,
  };

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function replaceType<T extends GraphQLType>(type: T): T {
    if (isListType(type)) {
      // $FlowFixMe[incompatible-return]
      return new GraphQLList(replaceType(type.ofType));
    }
    if (isNonNullType(type)) {
      // $FlowFixMe[incompatible-return]
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }

  function replaceNamedType<T extends GraphQLNamedType>(type: T): T {
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return typeMap[type.name];
  }

  function replaceDirective(directive: GraphQLDirective): GraphQLDirective {
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
    // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
    if (isInputObjectType(type)) {
      return extendInputObjectType(type);
    }

    // istanbul ignore next (Not reachable. All possible types have been considered)
    invariant(false, 'Unexpected type: ' + inspect(type as never));
  }

  function extendInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] ?? [];

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
    const extensions = typeExtensionsMap[type.name] ?? [];

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
    const extensions = typeExtensionsMap[config.name] ?? [];

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
    const extensions = typeExtensionsMap[config.name] ?? [];

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
    const extensions = typeExtensionsMap[config.name] ?? [];

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
    const extensions = typeExtensionsMap[config.name] ?? [];

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
      // $FlowFixMe[incompatible-call]
      args: mapValue(field.args, extendArg),
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
    query: Maybe<GraphQLObjectType>;
    mutation: Maybe<GraphQLObjectType>;
    subscription: Maybe<GraphQLObjectType>;
  } {
    const opTypes = {};
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const operationTypesNodes = node.operationTypes ?? [];

      for (const operationType of operationTypesNodes) {
        opTypes[operationType.operation] = getNamedType(operationType.type);
      }
    }

    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[incompatible-exact]
    return opTypes;
  }

  function getNamedType(node: NamedTypeNode): GraphQLNamedType {
    const name = node.name.value;
    const type = stdTypeMap[name] ?? typeMap[name];

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
      // $FlowFixMe[incompatible-call]
      return new GraphQLNonNull(getWrappedType(node.type));
    }
    return getNamedType(node);
  }

  function buildDirective(node: DirectiveDefinitionNode): GraphQLDirective {
    return new GraphQLDirective({
      name: node.name.value,
      description: node.description?.value,
      // $FlowFixMe[incompatible-call]
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
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const nodeFields = node.fields ?? [];

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
    // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
    const argsNodes = args ?? [];

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
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const fieldsNodes = node.fields ?? [];

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
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
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
    // $FlowFixMe[incompatible-return]
    return nodes.flatMap(
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      (node) => node.interfaces?.map(getNamedType) ?? [],
    );
  }

  function buildUnionTypes(
    nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>,
  ): Array<GraphQLObjectType> {
    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    // $FlowFixMe[incompatible-return]
    return nodes.flatMap(
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      (node) => node.types?.map(getNamedType) ?? [],
    );
  }

  function buildType(astNode: TypeDefinitionNode): GraphQLNamedType {
    const name = astNode.name.value;
    const extensionASTNodes = typeExtensionsMap[name] ?? [];

    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION: {
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
        return new GraphQLScalarType({
          name,
          description: astNode.description?.value,
          specifiedByURL: getSpecifiedByURL(astNode),
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLInputObjectType({
          name,
          description: astNode.description?.value,
          fields: () => buildInputFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
    }

    // istanbul ignore next (Not reachable. All possible type definition nodes have been considered)
    invariant(
      false,
      'Unexpected type definition node: ' + inspect(astNode as never),
    );
  }
}

const stdTypeMap = keyMap(
  specifiedScalarTypes.concat(introspectionTypes),
  (type) => type.name,
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
  // $FlowExpectedError[incompatible-return] validated by `getDirectiveValues`
  return deprecated?.reason;
}

/**
 * Given a scalar node, returns the string value for the specifiedByURL.
 */
function getSpecifiedByURL(
  node: ScalarTypeDefinitionNode | ScalarTypeExtensionNode,
): Maybe<string> {
  const specifiedBy = getDirectiveValues(GraphQLSpecifiedByDirective, node);
  // $FlowExpectedError[incompatible-return] validated by `getDirectiveValues`
  return specifiedBy?.url;
}
