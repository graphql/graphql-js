// @flow strict

import objectValues from '../polyfills/objectValues';

import keyMap from '../jsutils/keyMap';
import inspect from '../jsutils/inspect';
import mapValue from '../jsutils/mapValue';
import invariant from '../jsutils/invariant';
import devAssert from '../jsutils/devAssert';
import { type ObjMap, type ReadOnlyObjMap } from '../jsutils/ObjMap';

import { Kind } from '../language/kinds';
import { TokenKind } from '../language/tokenKind';
import { dedentBlockStringValue } from '../language/blockString';
import { type DirectiveLocationEnum } from '../language/directiveLocation';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../language/predicates';
import {
  type Location,
  type DocumentNode,
  type StringValueNode,
  type TypeNode,
  type TypeExtensionNode,
  type NamedTypeNode,
  type SchemaDefinitionNode,
  type SchemaExtensionNode,
  type TypeDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type InterfaceTypeExtensionNode,
  type ObjectTypeDefinitionNode,
  type ObjectTypeExtensionNode,
  type UnionTypeDefinitionNode,
  type UnionTypeExtensionNode,
  type FieldDefinitionNode,
  type InputObjectTypeDefinitionNode,
  type InputObjectTypeExtensionNode,
  type InputValueDefinitionNode,
  type EnumTypeDefinitionNode,
  type EnumTypeExtensionNode,
  type EnumValueDefinitionNode,
  type DirectiveDefinitionNode,
} from '../language/ast';

import { assertValidSDLExtension } from '../validation/validate';

import { getDirectiveValues } from '../execution/values';

import { specifiedScalarTypes, isSpecifiedScalarType } from '../type/scalars';
import { introspectionTypes, isIntrospectionType } from '../type/introspection';
import {
  GraphQLDirective,
  GraphQLDeprecatedDirective,
} from '../type/directives';
import {
  type GraphQLSchemaValidationOptions,
  assertSchema,
  GraphQLSchema,
  type GraphQLSchemaNormalizedConfig,
} from '../type/schema';
import {
  type GraphQLType,
  type GraphQLNamedType,
  type GraphQLFieldConfigMap,
  type GraphQLEnumValueConfigMap,
  type GraphQLInputFieldConfigMap,
  type GraphQLFieldConfigArgumentMap,
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

type Options = {|
  ...GraphQLSchemaValidationOptions,

  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   * This option is provided to ease adoption and will be removed in v16.
   *
   * Default: false
   */
  commentDescriptions?: boolean,

  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean,
|};

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
 *
 * Accepts options as a third argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function extendSchema(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  options?: Options,
): GraphQLSchema {
  assertSchema(schema);

  devAssert(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST.',
  );

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDLExtension(documentAST, schema);
  }

  const schemaConfig = schema.toConfig();
  const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
  return schemaConfig === extendedConfig
    ? schema
    : new GraphQLSchema(extendedConfig);
}

export function extendSchemaImpl(
  schemaConfig: GraphQLSchemaNormalizedConfig,
  documentAST: DocumentNode,
  options?: Options,
): GraphQLSchemaNormalizedConfig {
  // Collect the type definitions and extensions found in the document.
  const typeDefs = [];
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  let schemaDef: ?SchemaDefinitionNode;
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
    !schemaDef
  ) {
    return schemaConfig;
  }

  const astBuilder = new ASTDefinitionBuilder(options, typeName => {
    const type = typeMap[typeName];
    if (type === undefined) {
      throw new Error(`Unknown type: "${typeName}".`);
    }
    return type;
  });

  const typeMap = astBuilder.buildTypeMap(typeDefs, typeExtensionsMap);
  for (const existingType of schemaConfig.types) {
    typeMap[existingType.name] = extendNamedType(existingType);
  }

  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription:
      schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
    // Then, incorporate schema definition and all schema extensions.
    ...(schemaDef && astBuilder.getOperationTypes([schemaDef])),
    ...astBuilder.getOperationTypes(schemaExtensions),
  };

  // Then produce and return a Schema with these types.
  return {
    ...operationTypes,
    types: objectValues(typeMap),
    directives: [
      ...schemaConfig.directives.map(replaceDirective),
      ...astBuilder.buildDirectives(directiveDefs),
    ],
    extensions: Object.create(null),
    astNode: schemaDef || schemaConfig.astNode,
    extensionASTNodes: concatMaybeArrays(
      schemaConfig.extensionASTNodes,
      schemaExtensions,
    ),
    assumeValid: (options && options.assumeValid) || false,
  };

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function replaceType(type) {
    if (isListType(type)) {
      return new GraphQLList(replaceType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }

  function replaceNamedType<T: GraphQLNamedType>(type: T): T {
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return ((typeMap[type.name]: any): T);
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
    } else if (isScalarType(type)) {
      return extendScalarType(type);
    } else if (isObjectType(type)) {
      return extendObjectType(type);
    } else if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    } else if (isUnionType(type)) {
      return extendUnionType(type);
    } else if (isEnumType(type)) {
      return extendEnumType(type);
    } else if (isInputObjectType(type)) {
      return extendInputObjectType(type);
    }

    // Not reachable. All possible types have been considered.
    invariant(false, 'Unexpected type: ' + inspect((type: empty)));
  }

  function extendInputObjectType(
    type: GraphQLInputObjectType,
  ): GraphQLInputObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLInputObjectType({
      ...config,
      fields: () => ({
        ...mapValue(config.fields, field => ({
          ...field,
          type: replaceType(field.type),
        })),
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildInputFieldMap(extensions),
      }),
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[type.name] || [];

    return new GraphQLEnumType({
      ...config,
      values: {
        ...config.values,
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildEnumValueMap(extensions),
      },
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendScalarType(type: GraphQLScalarType): GraphQLScalarType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLScalarType({
      ...config,
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLObjectType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...astBuilder.buildInterfaces(extensions),
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildFieldMap(extensions),
      }),
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendInterfaceType(
    type: GraphQLInterfaceType,
  ): GraphQLInterfaceType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLInterfaceType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...astBuilder.buildInterfaces(extensions),
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        // $FlowFixMe Bug in Flow, see https://github.com/facebook/flow/issues/8178
        ...astBuilder.buildFieldMap(extensions),
      }),
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] || [];

    return new GraphQLUnionType({
      ...config,
      types: () => [
        ...type.getTypes().map(replaceNamedType),
        ...astBuilder.buildUnionTypes(extensions),
      ],
      extensionASTNodes: concatMaybeArrays(
        config.extensionASTNodes,
        extensions,
      ),
    });
  }

  function extendField(field) {
    return {
      ...field,
      type: replaceType(field.type),
      args: mapValue(field.args, extendArg),
    };
  }

  function extendArg(arg) {
    return {
      ...arg,
      type: replaceType(arg.type),
    };
  }
}

function concatMaybeArrays<X>(
  ...arrays: $ReadOnlyArray<?$ReadOnlyArray<X>>
): ?$ReadOnlyArray<X> {
  // eslint-disable-next-line no-undef-init
  let result = undefined;
  for (const maybeArray of arrays) {
    if (maybeArray) {
      result = result === undefined ? maybeArray : result.concat(maybeArray);
    }
  }
  return result;
}

type TypeResolver = (typeName: string) => GraphQLNamedType;

const stdTypeMap = keyMap(
  specifiedScalarTypes.concat(introspectionTypes),
  type => type.name,
);

class ASTDefinitionBuilder {
  _options: ?{ commentDescriptions?: boolean, ... };
  _resolveType: TypeResolver;

  constructor(
    options: ?{ commentDescriptions?: boolean, ... },
    resolveType: TypeResolver,
  ) {
    this._options = options;
    this._resolveType = resolveType;
  }

  getOperationTypes(
    nodes: $ReadOnlyArray<SchemaDefinitionNode | SchemaExtensionNode>,
  ): {|
    query: ?GraphQLObjectType,
    mutation: ?GraphQLObjectType,
    subscription: ?GraphQLObjectType,
  |} {
    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    const opTypes: any = {};
    for (const node of nodes) {
      if (node.operationTypes != null) {
        for (const operationType of node.operationTypes) {
          const typeName = operationType.type.name.value;
          opTypes[operationType.operation] = this._resolveType(typeName);
        }
      }
    }
    return opTypes;
  }

  getNamedType(node: NamedTypeNode): GraphQLNamedType {
    const name = node.name.value;
    return stdTypeMap[name] || this._resolveType(name);
  }

  getWrappedType(node: TypeNode): GraphQLType {
    if (node.kind === Kind.LIST_TYPE) {
      return new GraphQLList(this.getWrappedType(node.type));
    }
    if (node.kind === Kind.NON_NULL_TYPE) {
      return new GraphQLNonNull(this.getWrappedType(node.type));
    }
    return this.getNamedType(node);
  }

  buildDirectives(
    nodes: Array<DirectiveDefinitionNode>,
  ): Array<GraphQLDirective> {
    return nodes.map(directive => {
      const locations = directive.locations.map(
        ({ value }) => ((value: any): DirectiveLocationEnum),
      );

      return new GraphQLDirective({
        name: directive.name.value,
        description: getDescription(directive, this._options),
        locations,
        isRepeatable: directive.repeatable,
        args: this.buildArgumentMap(directive.arguments),
        astNode: directive,
      });
    });
  }

  buildFieldMap(
    nodes: $ReadOnlyArray<
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode,
    >,
  ): GraphQLFieldConfigMap<mixed, mixed> {
    const fieldConfigMap = Object.create(null);
    for (const node of nodes) {
      if (node.fields != null) {
        for (const field of node.fields) {
          fieldConfigMap[field.name.value] = {
            // Note: While this could make assertions to get the correctly typed
            // value, that would throw immediately while type system validation
            // with validateSchema() will produce more actionable results.
            type: (this.getWrappedType(field.type): any),
            description: getDescription(field, this._options),
            args: this.buildArgumentMap(field.arguments),
            deprecationReason: getDeprecationReason(field),
            astNode: field,
          };
        }
      }
    }
    return fieldConfigMap;
  }

  buildArgumentMap(
    args: ?$ReadOnlyArray<InputValueDefinitionNode>,
  ): GraphQLFieldConfigArgumentMap {
    const argConfigMap = Object.create(null);
    if (args != null) {
      for (const arg of args) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = this.getWrappedType(arg.type);

        argConfigMap[arg.name.value] = {
          type,
          description: getDescription(arg, this._options),
          defaultValue: valueFromAST(arg.defaultValue, type),
          astNode: arg,
        };
      }
    }
    return argConfigMap;
  }

  buildInputFieldMap(
    nodes: $ReadOnlyArray<
      InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode,
    >,
  ): GraphQLInputFieldConfigMap {
    const inputFieldMap = Object.create(null);
    for (const node of nodes) {
      if (node.fields != null) {
        for (const field of node.fields) {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          const type: any = this.getWrappedType(field.type);

          inputFieldMap[field.name.value] = {
            type,
            description: getDescription(field, this._options),
            defaultValue: valueFromAST(field.defaultValue, type),
            astNode: field,
          };
        }
      }
    }
    return inputFieldMap;
  }

  buildEnumValueMap(
    nodes: $ReadOnlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
  ): GraphQLEnumValueConfigMap {
    const enumValueMap = Object.create(null);
    for (const node of nodes) {
      if (node.values != null) {
        for (const value of node.values) {
          enumValueMap[value.name.value] = {
            description: getDescription(value, this._options),
            deprecationReason: getDeprecationReason(value),
            astNode: value,
          };
        }
      }
    }
    return enumValueMap;
  }

  buildInterfaces(
    nodes: $ReadOnlyArray<
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode,
    >,
  ): Array<GraphQLInterfaceType> {
    const interfaces = [];
    for (const node of nodes) {
      if (node.interfaces != null) {
        for (const type of node.interfaces) {
          // Note: While this could make assertions to get the correctly typed
          // values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable
          // results.
          interfaces.push((this.getNamedType(type): any));
        }
      }
    }
    return interfaces;
  }

  buildUnionTypes(
    nodes: $ReadOnlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>,
  ): Array<GraphQLObjectType> {
    const types = [];
    for (const node of nodes) {
      if (node.types != null) {
        for (const type of node.types) {
          // Note: While this could make assertions to get the correctly typed
          // values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable
          // results.
          types.push((this.getNamedType(type): any));
        }
      }
    }
    return types;
  }

  buildTypeMap(
    nodes: $ReadOnlyArray<TypeDefinitionNode>,
    extensionMap: ReadOnlyObjMap<$ReadOnlyArray<TypeExtensionNode>>,
  ): ObjMap<GraphQLNamedType> {
    const typeMap = Object.create(null);
    for (const node of nodes) {
      const name = node.name.value;
      typeMap[name] =
        stdTypeMap[name] || this._buildType(node, extensionMap[name] || []);
    }
    return typeMap;
  }

  _buildType(
    astNode: TypeDefinitionNode,
    extensionNodes: $ReadOnlyArray<TypeExtensionNode>,
  ): GraphQLNamedType {
    const name = astNode.name.value;
    const description = getDescription(astNode, this._options);

    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION: {
        const extensionASTNodes = (extensionNodes: any);
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLObjectType({
          name,
          description,
          interfaces: () => this.buildInterfaces(allNodes),
          fields: () => this.buildFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.INTERFACE_TYPE_DEFINITION: {
        const extensionASTNodes = (extensionNodes: any);
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLInterfaceType({
          name,
          description,
          interfaces: () => this.buildInterfaces(allNodes),
          fields: () => this.buildFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.ENUM_TYPE_DEFINITION: {
        const extensionASTNodes = (extensionNodes: any);
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLEnumType({
          name,
          description,
          values: this.buildEnumValueMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.UNION_TYPE_DEFINITION: {
        const extensionASTNodes = (extensionNodes: any);
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLUnionType({
          name,
          description,
          types: () => this.buildUnionTypes(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.SCALAR_TYPE_DEFINITION: {
        const extensionASTNodes = (extensionNodes: any);

        return new GraphQLScalarType({
          name,
          description,
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
        const extensionASTNodes = (extensionNodes: any);
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLInputObjectType({
          name,
          description,
          fields: () => this.buildInputFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
    }

    // Not reachable. All possible type definition nodes have been considered.
    invariant(
      false,
      'Unexpected type definition node: ' + inspect((astNode: empty)),
    );
  }
}

/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(
  node: EnumValueDefinitionNode | FieldDefinitionNode,
): ?string {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  return deprecated && (deprecated.reason: any);
}

/**
 * Given an ast node, returns its string description.
 * @deprecated: provided to ease adoption and will be removed in v16.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function getDescription(
  node: { +description?: StringValueNode, +loc?: Location, ... },
  options: ?{ commentDescriptions?: boolean, ... },
): void | string {
  if (node.description) {
    return node.description.value;
  }
  if (options && options.commentDescriptions) {
    const rawValue = getLeadingCommentBlock(node);
    if (rawValue !== undefined) {
      return dedentBlockStringValue('\n' + rawValue);
    }
  }
}

function getLeadingCommentBlock(node): void | string {
  const loc = node.loc;
  if (!loc) {
    return;
  }
  const comments = [];
  let token = loc.startToken.prev;
  while (
    token &&
    token.kind === TokenKind.COMMENT &&
    token.next &&
    token.prev &&
    token.line + 1 === token.next.line &&
    token.line !== token.prev.line
  ) {
    const value = String(token.value);
    comments.push(value);
    token = token.prev;
  }
  return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
