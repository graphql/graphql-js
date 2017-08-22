/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import keyValMap from '../jsutils/keyValMap';
import { valueFromAST } from './valueFromAST';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';
import type { Source } from '../language/source';
import { getDirectiveValues } from '../execution/values';

import * as Kind from '../language/kinds';

import type {
  Location,
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
 */
export function buildASTSchema(ast: DocumentNode): GraphQLSchema {
  if (!ast || ast.kind !== Kind.DOCUMENT) {
    throw new Error('Must provide a document ast.');
  }

  let schemaDef: ?SchemaDefinitionNode;

  const typeDefs: Array<TypeDefinitionNode> = [];
  const nodeMap: {[name: string]: TypeDefinitionNode} = Object.create(null);
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

  let queryTypeName;
  let mutationTypeName;
  let subscriptionTypeName;
  if (schemaDef) {
    schemaDef.operationTypes.forEach(operationType => {
      const typeName = operationType.type.name.value;
      if (operationType.operation === 'query') {
        if (queryTypeName) {
          throw new Error('Must provide only one query type in schema.');
        }
        if (!nodeMap[typeName]) {
          throw new Error(
            `Specified query type "${typeName}" not found in document.`
          );
        }
        queryTypeName = typeName;
      } else if (operationType.operation === 'mutation') {
        if (mutationTypeName) {
          throw new Error('Must provide only one mutation type in schema.');
        }
        if (!nodeMap[typeName]) {
          throw new Error(
            `Specified mutation type "${typeName}" not found in document.`
          );
        }
        mutationTypeName = typeName;
      } else if (operationType.operation === 'subscription') {
        if (subscriptionTypeName) {
          throw new Error('Must provide only one subscription type in schema.');
        }
        if (!nodeMap[typeName]) {
          throw new Error(
            `Specified subscription type "${typeName}" not found in document.`
          );
        }
        subscriptionTypeName = typeName;
      }
    });
  } else {
    if (nodeMap.Query) {
      queryTypeName = 'Query';
    }
    if (nodeMap.Mutation) {
      mutationTypeName = 'Mutation';
    }
    if (nodeMap.Subscription) {
      subscriptionTypeName = 'Subscription';
    }
  }

  if (!queryTypeName) {
    throw new Error(
      'Must provide schema definition with query type or a type named Query.'
    );
  }

  const definitionBuilder = new ASTDefinitionBuilder(nodeMap, typeName => {
    throw new Error(`Type "${typeName}" not found in document.`);
  });

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

  return new GraphQLSchema({
    query: definitionBuilder.buildObjectType(queryTypeName),
    mutation: mutationTypeName ?
      definitionBuilder.buildObjectType(mutationTypeName) :
      null,
    subscription: subscriptionTypeName ?
      definitionBuilder.buildObjectType(subscriptionTypeName) :
      null,
    types,
    directives,
    astNode: schemaDef,
  });
}

type TypeDefinitionsMap = { [typeName: string]: TypeDefinitionNode };
type TypeResolver = (
  typeName: string,
  node?: ?NamedTypeNode
) => GraphQLNamedType;

export class ASTDefinitionBuilder {
  _typeDefinitionsMap: TypeDefinitionsMap;
  _resolveType: TypeResolver;
  _cache: { [typeName: string]: GraphQLNamedType };

  constructor(
    typeDefinitionsMap: TypeDefinitionsMap,
    resolveType: TypeResolver
  ) {
    this._typeDefinitionsMap = typeDefinitionsMap;
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
      description: getDescription(directiveNode),
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
      description: getDescription(field),
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
      description: getDescription(def),
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
          description: getDescription(value),
          defaultValue: valueFromAST(value.defaultValue, type),
          astNode: value,
        };
      }
    );
  }

  _makeInterfaceDef(def: InterfaceTypeDefinitionNode) {
    return new GraphQLInterfaceType({
      name: def.name.value,
      description: getDescription(def),
      fields: () => this._makeFieldDefMap(def),
      astNode: def,
      resolveType: cannotExecuteSchema,
    });
  }

  _makeEnumDef(def: EnumTypeDefinitionNode) {
    return new GraphQLEnumType({
      name: def.name.value,
      description: getDescription(def),
      values: keyValMap(
        def.values,
        enumValue => enumValue.name.value,
        enumValue => ({
          description: getDescription(enumValue),
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
      description: getDescription(def),
      types: def.types.map(t => this.buildObjectType(t)),
      resolveType: cannotExecuteSchema,
      astNode: def,
    });
  }

  _makeScalarDef(def: ScalarTypeDefinitionNode) {
    return new GraphQLScalarType({
      name: def.name.value,
      description: getDescription(def),
      astNode: def,
      serialize: () => null,
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: () => false,
      parseLiteral: () => false,
    });
  }

  _makeInputObjectDef(def: InputObjectTypeDefinitionNode) {
    return new GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def),
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
 * Given an ast node, returns its string description based on a contiguous
 * block full-line of comments preceding it.
 */
function getDescription(node: { loc?: Location }): ?string {
  const loc = node.loc;
  if (!loc) {
    return;
  }
  const comments = [];
  let minSpaces;
  let token = loc.startToken.prev;
  while (
    token &&
    token.kind === TokenKind.COMMENT &&
    token.next && token.prev &&
    token.line + 1 === token.next.line &&
    token.line !== token.prev.line
  ) {
    const value = String(token.value);
    const spaces = leadingSpaces(value);
    if (minSpaces === undefined || spaces < minSpaces) {
      minSpaces = spaces;
    }
    comments.push(value);
    token = token.prev;
  }
  return comments
    .reverse()
    .map(comment => comment.slice(minSpaces))
    .join('\n');
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(source: string | Source): GraphQLSchema {
  return buildASTSchema(parse(source));
}

// Count the number of spaces on the starting side of a string.
function leadingSpaces(str) {
  let i = 0;
  for (; i < str.length; i++) {
    if (str[i] !== ' ') {
      break;
    }
  }
  return i;
}

function cannotExecuteSchema() {
  throw new Error(
    'Generated Schema cannot use Interface or Union types for execution.'
  );
}
