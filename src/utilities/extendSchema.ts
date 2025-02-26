import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { invariant } from '../jsutils/invariant.js';
import type { Maybe } from '../jsutils/Maybe.js';

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
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type {
  GraphQLEnumValueNormalizedConfigMap,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldNormalizedConfigMap,
  GraphQLInputFieldNormalizedConfigMap,
  GraphQLNamedType,
  GraphQLType,
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
} from '../type/definition.js';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLOneOfDirective,
  GraphQLSpecifiedByDirective,
} from '../type/directives.js';
import { introspectionTypes } from '../type/introspection.js';
import { specifiedScalarTypes } from '../type/scalars.js';
import type {
  GraphQLSchemaNormalizedConfig,
  GraphQLSchemaValidationOptions,
} from '../type/schema.js';
import { assertSchema, GraphQLSchema } from '../type/schema.js';

import { assertValidSDLExtension } from '../validation/validate.js';

import { getDirectiveValues } from '../execution/values.js';

import { mapSchemaConfig, SchemaElementKind } from './mapSchemaConfig.js';

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

  return mapSchemaConfig(schemaConfig, (context) => {
    const { getNamedType, setNamedType, getNamedTypes } = context;
    return {
      [SchemaElementKind.SCHEMA]: (config) => {
        for (const typeNode of typeDefs) {
          const type =
            stdTypeMap.get(typeNode.name.value) ?? buildNamedType(typeNode);
          setNamedType(type);
        }

        const operationTypes = {
          // Get the extended root operation types.
          query:
            config.query &&
            (getNamedType(config.query.name) as GraphQLObjectType),
          mutation:
            config.mutation &&
            (getNamedType(config.mutation.name) as GraphQLObjectType),
          subscription:
            config.subscription &&
            (getNamedType(config.subscription.name) as GraphQLObjectType),
          // Then, incorporate schema definition and all schema extensions.
          ...(schemaDef && getOperationTypes([schemaDef])),
          ...getOperationTypes(schemaExtensions),
        };

        // Then produce and return a Schema config with these types.
        return {
          description: schemaDef?.description?.value ?? config.description,
          ...operationTypes,
          types: getNamedTypes(),
          directives: [
            ...config.directives,
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

    function getOperationTypes(
      nodes: ReadonlyArray<SchemaDefinitionNode | SchemaExtensionNode>,
    ): {
      query?: Maybe<GraphQLObjectType>;
      mutation?: Maybe<GraphQLObjectType>;
      subscription?: Maybe<GraphQLObjectType>;
    } {
      const opTypes = {};
      for (const node of nodes) {
        const operationTypesNodes = node.operationTypes ?? [];

        for (const operationType of operationTypesNodes) {
          // Note: While this could make early assertions to get the correctly
          // typed values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          // @ts-expect-error
          opTypes[operationType.operation] = namedTypeFromAST(
            operationType.type,
          );
        }
      }

      return opTypes;
    }

    function namedTypeFromAST(node: NamedTypeNode): GraphQLNamedType {
      const name = node.name.value;
      const type = getNamedType(name);
      invariant(type !== undefined, `Unknown type: "${name}".`);
      return type;
    }

    function typeFromAST(node: TypeNode): GraphQLType {
      if (node.kind === Kind.LIST_TYPE) {
        return new GraphQLList(typeFromAST(node.type));
      }
      if (node.kind === Kind.NON_NULL_TYPE) {
        return new GraphQLNonNull(typeFromAST(node.type));
      }
      return namedTypeFromAST(node);
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
    ): GraphQLFieldNormalizedConfigMap<unknown, unknown> {
      const fieldConfigMap = Object.create(null);
      for (const node of nodes) {
        const nodeFields = node.fields ?? [];

        for (const field of nodeFields) {
          fieldConfigMap[field.name.value] = {
            // Note: While this could make assertions to get the correctly typed
            // value, that would throw immediately while type system validation
            // with validateSchema() will produce more actionable results.
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

    function buildArgumentMap(
      args: Maybe<ReadonlyArray<InputValueDefinitionNode>>,
    ): GraphQLFieldConfigArgumentMap {
      const argsNodes = args ?? [];

      const argConfigMap = Object.create(null);
      for (const arg of argsNodes) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = typeFromAST(arg.type);

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

    function buildInputFieldMap(
      nodes: ReadonlyArray<
        InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode
      >,
    ): GraphQLInputFieldNormalizedConfigMap {
      const inputFieldMap = Object.create(null);
      for (const node of nodes) {
        const fieldsNodes = node.fields ?? [];

        for (const field of fieldsNodes) {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          const type: any = typeFromAST(field.type);

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

    function buildEnumValueMap(
      nodes: ReadonlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
    ): GraphQLEnumValueNormalizedConfigMap {
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
        (node) => node.interfaces?.map(namedTypeFromAST) ?? [],
      );
    }

    function buildUnionTypes(
      nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>,
    ): Array<GraphQLObjectType> {
      // Note: While this could make assertions to get the correctly typed
      // values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      // @ts-expect-error
      return nodes.flatMap((node) => node.types?.map(namedTypeFromAST) ?? []);
    }

    function buildNamedType(astNode: TypeDefinitionNode): GraphQLNamedType {
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
  });
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
