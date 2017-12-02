/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import keyValMap from '../jsutils/keyValMap';
import type {ObjMap} from '../jsutils/ObjMap';
import { valueFromAST } from './valueFromAST';
import blockStringValue from '../language/blockStringValue';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';
import type { Source } from '../language/source';
import { getDirectiveValues } from '../execution/values';

import * as Kind from '../language/kinds';

import type {
  Location,
  DocumentNode,
  StringValueNode,
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

import { GraphQLSchema } from '../type/schema';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
} from '../type/scalars';

import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  assertInputType,
  assertOutputType,
} from '../type/definition';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLFieldConfig,
} from '../type/definition';

import {
  GraphQLDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../type/directives';

import type {
  DirectiveLocationEnum
} from '../type/directives';

import {
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind,
} from '../type/introspection';

type Options = {| commentDescriptions?: boolean |};

function buildWrappedType(
  innerType: GraphQLType,
  inputTypeNode: TypeNode
): GraphQLType {
  if (inputTypeNode.kind === Kind.LIST_TYPE) {
    return new GraphQLList(buildWrappedType(innerType, inputTypeNode.type));
  }
  if (inputTypeNode.kind === Kind.NON_NULL_TYPE) {
    const wrappedType = buildWrappedType(innerType, inputTypeNode.type);
    invariant(!(wrappedType instanceof GraphQLNonNull), 'No nesting nonnull.');
    return new GraphQLNonNull(wrappedType);
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

  const operationTypes = schemaDef ? getOperationTypes(schemaDef) : {
    query: nodeMap.Query ? 'Query' : null,
    mutation: nodeMap.Mutation ? 'Mutation' : null,
    subscription: nodeMap.Subscription ? 'Subscription' : null,
  };

  const definitionBuilder = new ASTDefinitionBuilder(
    nodeMap,
    options,
    typeName => {
      throw new Error(`Type "${typeName}" not found in document.`);
    }
  );

  const types = typeDefs.map(
    def => definitionBuilder.buildType(def.name.value)
  );

  const directives = directiveDefs.map(
    def => definitionBuilder.buildDirective(def)
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

  if (!operationTypes.query) {
    throw new Error(
      'Must provide schema definition with query type or a type named Query.'
    );
  }

  return new GraphQLSchema({
    query: definitionBuilder.buildObjectType(operationTypes.query),
    mutation: operationTypes.mutation ?
      definitionBuilder.buildObjectType(operationTypes.mutation) :
      null,
    subscription: operationTypes.subscription ?
      definitionBuilder.buildObjectType(operationTypes.subscription) :
      null,
    types,
    directives,
    astNode: schemaDef,
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
          `Specified ${operation} type "${typeName}" not found in document.`
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
  node?: ?NamedTypeNode
) => GraphQLNamedType;

export class ASTDefinitionBuilder {
  _typeDefinitionsMap: TypeDefinitionsMap;
  _options: ?Options;
  _resolveType: TypeResolver;
  _cache: { [typeName: string]: GraphQLNamedType };

  constructor(
    typeDefinitionsMap: TypeDefinitionsMap,
    options: ?Options,
    resolveType: TypeResolver
  ) {
    this._typeDefinitionsMap = typeDefinitionsMap;
    this._options = options;
    this._resolveType = resolveType;
    // Initialize to the GraphQL built in scalars and introspection types.
    this._cache = {
      String: GraphQLString,
      Int: GraphQLInt,
      Float: GraphQLFloat,
      Boolean: GraphQLBoolean,
      ID: GraphQLID,
      __Schema,
      __Directive,
      __DirectiveLocation,
      __Type,
      __Field,
      __InputValue,
      __EnumValue,
      __TypeKind,
    };
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

  _buildInputType(typeNode: TypeNode): GraphQLInputType {
    return assertInputType(this._buildWrappedType(typeNode));
  }

  _buildOutputType(typeNode: TypeNode): GraphQLOutputType {
    return assertOutputType(this._buildWrappedType(typeNode));
  }

  buildObjectType(ref: string | NamedTypeNode): GraphQLObjectType {
    const type = this.buildType(ref);
    invariant(type instanceof GraphQLObjectType, 'Expected Object type.');
    return type;
  }

  buildInterfaceType(ref: string | NamedTypeNode): GraphQLInterfaceType {
    const type = this.buildType(ref);
    invariant(type instanceof GraphQLInterfaceType, 'Expected Interface type.');
    return type;
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
        node => ((node.value: any): DirectiveLocationEnum)
      ),
      args: directiveNode.arguments &&
        this._makeInputValues(directiveNode.arguments),
      astNode: directiveNode,
    });
  }

  buildField(field: FieldDefinitionNode): GraphQLFieldConfig<*,*> {
    return {
      type: this._buildOutputType(field.type),
      description: getDescription(field, this._options),
      args: this._makeInputValues(field.arguments),
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
    def: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode
  ) {
    return keyValMap(
      def.fields,
      field => field.name.value,
      field => this.buildField(field)
    );
  }

  _makeImplementedInterfaces(def: ObjectTypeDefinitionNode) {
    return def.interfaces &&
      def.interfaces.map(iface => this.buildInterfaceType(iface));
  }

  _makeInputValues(values: Array<InputValueDefinitionNode>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = this._buildInputType(value.type);
        return {
          type,
          description: getDescription(value, this._options),
          defaultValue: valueFromAST(value.defaultValue, type),
          astNode: value,
        };
      }
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
      values: keyValMap(
        def.values,
        enumValue => enumValue.name.value,
        enumValue => ({
          description: getDescription(enumValue, this._options),
          deprecationReason: getDeprecationReason(enumValue),
          astNode: enumValue,
        })
      ),
      astNode: def,
    });
  }

  _makeUnionDef(def: UnionTypeDefinitionNode) {
    return new GraphQLUnionType({
      name: def.name.value,
      description: getDescription(def, this._options),
      types: def.types.map(t => this.buildObjectType(t)),
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
      fields: () => this._makeInputValues(def.fields),
      astNode: def,
    });
  }
}

/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(
  node: EnumValueDefinitionNode | FieldDefinitionNode
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
function getDescription(
  node: { loc?: Location, description?: ?StringValueNode },
  options: ?Options,
): void | string {
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

function getLeadingCommentBlock(node: { loc?: Location }): void | string {
  const loc = node.loc;
  if (!loc) {
    return;
  }
  const comments = [];
  let token = loc.startToken.prev;
  while (
    token &&
    token.kind === TokenKind.COMMENT &&
    token.next && token.prev &&
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
