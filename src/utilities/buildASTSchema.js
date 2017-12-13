/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import type { ObjMap } from '../jsutils/ObjMap';
import { valueFromAST } from './valueFromAST';
import blockStringValue from '../language/blockStringValue';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';
import type { Source } from '../language/source';
import { getDirectiveValues } from '../execution/values';

import * as Kind from '../language/kinds';

import type {
  DocumentNode,
  TypeNode,
  NamedTypeNode,
  SchemaDefinitionNode,
  TypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  DirectiveDefinitionNode,
} from '../language/ast';

import type { DirectiveLocationEnum } from '../language/directiveLocation';

import {
  assertNullableType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';

import { GraphQLList, GraphQLNonNull } from '../type/wrappers';

import {
  GraphQLDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../type/directives';

import { introspectionTypes } from '../type/introspection';

import { specifiedScalarTypes } from '../type/scalars';

import { GraphQLSchema } from '../type/schema';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLFieldConfig,
} from '../type/definition';

type Options = {|
  /**
   * When building a schema from a GraphQL service's introspection result, it
   * might be safe to assume the schema is valid. Set to true to assume the
   * produced schema is valid.
   *
   * Default: false
   */
  assumeValid?: boolean,

  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   *
   * Default: false
   */
  commentDescriptions?: boolean,
|};

function buildWrappedType(
  innerType: GraphQLType,
  inputTypeNode: TypeNode,
): GraphQLType {
  if (inputTypeNode.kind === Kind.LIST_TYPE) {
    return GraphQLList(buildWrappedType(innerType, inputTypeNode.type));
  }
  if (inputTypeNode.kind === Kind.NON_NULL_TYPE) {
    const wrappedType = buildWrappedType(innerType, inputTypeNode.type);
    return GraphQLNonNull(assertNullableType(wrappedType));
  }
  return innerType;
}

function getNamedTypeNode(typeNode: TypeNode): NamedTypeNode {
  let namedType = typeNode;
  while (
    namedType.kind === Kind.LIST_TYPE ||
    namedType.kind === Kind.NON_NULL_TYPE
  ) {
    namedType = namedType.type;
  }
  return namedType;
}

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query
 * and Mutation.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function buildASTSchema(
  ast: DocumentNode,
  options?: Options,
): GraphQLSchema {
  if (!ast || ast.kind !== Kind.DOCUMENT) {
    throw new Error('Must provide a document ast.');
  }

  let schemaDef: ?SchemaDefinitionNode;

  const typeDefs: Array<TypeDefinitionNode> = [];
  const nodeMap: ObjMap<TypeDefinitionNode> = Object.create(null);
  const directiveDefs: Array<DirectiveDefinitionNode> = [];
  for (let i = 0; i < ast.definitions.length; i++) {
    const d = ast.definitions[i];
    switch (d.kind) {
      case Kind.SCHEMA_DEFINITION:
        if (schemaDef) {
          throw new Error('Must provide only one schema definition.');
        }
        schemaDef = d;
        break;
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        const typeName = d.name.value;
        if (nodeMap[typeName]) {
          throw new Error(`Type "${typeName}" was defined more than once.`);
        }
        typeDefs.push(d);
        nodeMap[typeName] = d;
        break;
      case Kind.DIRECTIVE_DEFINITION:
        directiveDefs.push(d);
        break;
    }
  }

  const operationTypes = schemaDef
    ? getOperationTypes(schemaDef)
    : {
        query: nodeMap.Query ? 'Query' : null,
        mutation: nodeMap.Mutation ? 'Mutation' : null,
        subscription: nodeMap.Subscription ? 'Subscription' : null,
      };

  const definitionBuilder = new ASTDefinitionBuilder(
    nodeMap,
    options,
    typeName => {
      throw new Error(`Type "${typeName}" not found in document.`);
    },
  );

  const types = typeDefs.map(def =>
    definitionBuilder.buildType(def.name.value),
  );

  const directives = directiveDefs.map(def =>
    definitionBuilder.buildDirective(def),
  );

  // If specified directives were not explicitly declared, add them.
  if (!directives.some(directive => directive.name === 'skip')) {
    directives.push(GraphQLSkipDirective);
  }

  if (!directives.some(directive => directive.name === 'include')) {
    directives.push(GraphQLIncludeDirective);
  }

  if (!directives.some(directive => directive.name === 'deprecated')) {
    directives.push(GraphQLDeprecatedDirective);
  }

  // Note: While this could make early assertions to get the correctly
  // typed values below, that would throw immediately while type system
  // validation with validateSchema() will produce more actionable results.
  return new GraphQLSchema({
    query: operationTypes.query
      ? (definitionBuilder.buildType(operationTypes.query): any)
      : null,
    mutation: operationTypes.mutation
      ? (definitionBuilder.buildType(operationTypes.mutation): any)
      : null,
    subscription: operationTypes.subscription
      ? (definitionBuilder.buildType(operationTypes.subscription): any)
      : null,
    types,
    directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid,
  });

  function getOperationTypes(schema: SchemaDefinitionNode) {
    const opTypes = {};
    schema.operationTypes.forEach(operationType => {
      const typeName = operationType.type.name.value;
      const operation = operationType.operation;
      if (opTypes[operation]) {
        throw new Error(`Must provide only one ${operation} type in schema.`);
      }
      if (!nodeMap[typeName]) {
        throw new Error(
          `Specified ${operation} type "${typeName}" not found in document.`,
        );
      }
      opTypes[operation] = typeName;
    });
    return opTypes;
  }
}

type TypeDefinitionsMap = ObjMap<TypeDefinitionNode>;
type TypeResolver = (
  typeName: string,
  node?: ?NamedTypeNode,
) => GraphQLNamedType;

export class ASTDefinitionBuilder {
  _typeDefinitionsMap: TypeDefinitionsMap;
  _options: ?Options;
  _resolveType: TypeResolver;
  _cache: ObjMap<GraphQLNamedType>;

  constructor(
    typeDefinitionsMap: TypeDefinitionsMap,
    options: ?Options,
    resolveType: TypeResolver,
  ) {
    this._typeDefinitionsMap = typeDefinitionsMap;
    this._options = options;
    this._resolveType = resolveType;
    // Initialize to the GraphQL built in scalars and introspection types.
    this._cache = keyMap(
      specifiedScalarTypes.concat(introspectionTypes),
      type => type.name,
    );
  }

  _buildType(typeName: string, typeNode?: ?NamedTypeNode): GraphQLNamedType {
    if (!this._cache[typeName]) {
      const defNode = this._typeDefinitionsMap[typeName];
      if (defNode) {
        this._cache[typeName] = this._makeSchemaDef(defNode);
      } else {
        this._cache[typeName] = this._resolveType(typeName, typeNode);
      }
    }
    return this._cache[typeName];
  }

  buildType(ref: string | NamedTypeNode): GraphQLNamedType {
    if (typeof ref === 'string') {
      return this._buildType(ref);
    }
    return this._buildType(ref.name.value, ref);
  }

  _buildWrappedType(typeNode: TypeNode): GraphQLType {
    const typeDef = this.buildType(getNamedTypeNode(typeNode));
    return buildWrappedType(typeDef, typeNode);
  }

  buildDirective(directiveNode: DirectiveDefinitionNode): GraphQLDirective {
    return new GraphQLDirective({
      name: directiveNode.name.value,
      description: getDescription(directiveNode, this._options),
      locations: directiveNode.locations.map(
        node => ((node.value: any): DirectiveLocationEnum),
      ),
      args:
        directiveNode.arguments &&
        this._makeInputValues(directiveNode.arguments),
      astNode: directiveNode,
    });
  }

  buildField(field: FieldDefinitionNode): GraphQLFieldConfig<*, *> {
    return {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      type: (this._buildWrappedType(field.type): any),
      description: getDescription(field, this._options),
      args: field.arguments && this._makeInputValues(field.arguments),
      deprecationReason: getDeprecationReason(field),
      astNode: field,
    };
  }

  _makeSchemaDef(def: TypeDefinitionNode): GraphQLNamedType {
    switch (def.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        return this._makeTypeDef(def);
      case Kind.INTERFACE_TYPE_DEFINITION:
        return this._makeInterfaceDef(def);
      case Kind.ENUM_TYPE_DEFINITION:
        return this._makeEnumDef(def);
      case Kind.UNION_TYPE_DEFINITION:
        return this._makeUnionDef(def);
      case Kind.SCALAR_TYPE_DEFINITION:
        return this._makeScalarDef(def);
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return this._makeInputObjectDef(def);
      default:
        throw new Error(`Type kind "${def.kind}" not supported.`);
    }
  }

  _makeTypeDef(def: ObjectTypeDefinitionNode) {
    const typeName = def.name.value;
    return new GraphQLObjectType({
      name: typeName,
      description: getDescription(def, this._options),
      fields: () => this._makeFieldDefMap(def),
      interfaces: () => this._makeImplementedInterfaces(def),
      astNode: def,
    });
  }

  _makeFieldDefMap(
    def: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode,
  ) {
    return def.fields
      ? keyValMap(
          def.fields,
          field => field.name.value,
          field => this.buildField(field),
        )
      : {};
  }

  _makeImplementedInterfaces(def: ObjectTypeDefinitionNode) {
    return (
      def.interfaces &&
      // Note: While this could make early assertions to get the correctly
      // typed values, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      def.interfaces.map(iface => (this.buildType(iface): any))
    );
  }

  _makeInputValues(values: $ReadOnlyArray<InputValueDefinitionNode>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = this._buildWrappedType(value.type);
        return {
          type,
          description: getDescription(value, this._options),
          defaultValue: valueFromAST(value.defaultValue, type),
          astNode: value,
        };
      },
    );
  }

  _makeInterfaceDef(def: InterfaceTypeDefinitionNode) {
    return new GraphQLInterfaceType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: () => this._makeFieldDefMap(def),
      astNode: def,
    });
  }

  _makeEnumDef(def: EnumTypeDefinitionNode) {
    return new GraphQLEnumType({
      name: def.name.value,
      description: getDescription(def, this._options),
      values: def.values
        ? keyValMap(
            def.values,
            enumValue => enumValue.name.value,
            enumValue => ({
              description: getDescription(enumValue, this._options),
              deprecationReason: getDeprecationReason(enumValue),
              astNode: enumValue,
            }),
          )
        : {},
      astNode: def,
    });
  }

  _makeUnionDef(def: UnionTypeDefinitionNode) {
    return new GraphQLUnionType({
      name: def.name.value,
      description: getDescription(def, this._options),
      // Note: While this could make assertions to get the correctly typed
      // values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      types: def.types ? def.types.map(t => (this.buildType(t): any)) : [],
      astNode: def,
    });
  }

  _makeScalarDef(def: ScalarTypeDefinitionNode) {
    return new GraphQLScalarType({
      name: def.name.value,
      description: getDescription(def, this._options),
      astNode: def,
      serialize: value => value,
    });
  }

  _makeInputObjectDef(def: InputObjectTypeDefinitionNode) {
    return new GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: () => (def.fields ? this._makeInputValues(def.fields) : {}),
      astNode: def,
    });
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
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
function getDescription(node, options: ?Options): void | string {
  if (node.description) {
    return node.description.value;
  }
  if (options && options.commentDescriptions) {
    const rawValue = getLeadingCommentBlock(node);
    if (rawValue !== undefined) {
      return blockStringValue('\n' + rawValue);
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
  return comments.reverse().join('\n');
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(source: string | Source): GraphQLSchema {
  return buildASTSchema(parse(source));
}
