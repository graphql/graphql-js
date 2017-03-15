/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import find from '../jsutils/find';
import invariant from '../jsutils/invariant';
import keyValMap from '../jsutils/keyValMap';
import { valueFromAST } from './valueFromAST';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';
import type { Source } from '../language/source';
import { getArgumentValues } from '../execution/values';

import {
  LIST_TYPE,
  NON_NULL_TYPE,
  DOCUMENT,
  SCHEMA_DEFINITION,
  SCALAR_TYPE_DEFINITION,
  OBJECT_TYPE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,
  DIRECTIVE_DEFINITION,
} from '../language/kinds';

import type {
  Location,
  DocumentNode,
  DirectiveNode,
  TypeNode,
  NamedTypeNode,
  SchemaDefinitionNode,
  TypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
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
  isInputType,
  isOutputType,
} from '../type/definition';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLOutputType,
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
  if (inputTypeNode.kind === LIST_TYPE) {
    return new GraphQLList(buildWrappedType(innerType, inputTypeNode.type));
  }
  if (inputTypeNode.kind === NON_NULL_TYPE) {
    const wrappedType = buildWrappedType(innerType, inputTypeNode.type);
    invariant(!(wrappedType instanceof GraphQLNonNull), 'No nesting nonnull.');
    return new GraphQLNonNull(wrappedType);
  }
  return innerType;
}

function getNamedTypeNode(typeNode: TypeNode): NamedTypeNode {
  let namedType = typeNode;
  while (namedType.kind === LIST_TYPE || namedType.kind === NON_NULL_TYPE) {
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
  if (!ast || ast.kind !== DOCUMENT) {
    throw new Error('Must provide a document ast.');
  }

  let schemaDef: ?SchemaDefinitionNode;

  const typeDefs: Array<TypeDefinitionNode> = [];
  const nodeMap: {[name: string]: TypeDefinitionNode} = Object.create(null);
  const directiveDefs: Array<DirectiveDefinitionNode> = [];
  for (let i = 0; i < ast.definitions.length; i++) {
    const d = ast.definitions[i];
    switch (d.kind) {
      case SCHEMA_DEFINITION:
        if (schemaDef) {
          throw new Error('Must provide only one schema definition.');
        }
        schemaDef = d;
        break;
      case SCALAR_TYPE_DEFINITION:
      case OBJECT_TYPE_DEFINITION:
      case INTERFACE_TYPE_DEFINITION:
      case ENUM_TYPE_DEFINITION:
      case UNION_TYPE_DEFINITION:
      case INPUT_OBJECT_TYPE_DEFINITION:
        typeDefs.push(d);
        nodeMap[d.name.value] = d;
        break;
      case DIRECTIVE_DEFINITION:
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

  const innerTypeMap = {
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

  const types = typeDefs.map(def => typeDefNamed(def.name.value));

  const directives = directiveDefs.map(getDirective);

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
    query: getObjectType(nodeMap[queryTypeName]),
    mutation: mutationTypeName ?
      getObjectType(nodeMap[mutationTypeName]) :
      null,
    subscription: subscriptionTypeName ?
      getObjectType(nodeMap[subscriptionTypeName]) :
      null,
    types,
    directives,
  });

  function getDirective(
    directiveNode: DirectiveDefinitionNode
  ): GraphQLDirective {
    return new GraphQLDirective({
      name: directiveNode.name.value,
      description: getDescription(directiveNode),
      locations: directiveNode.locations.map(
        node => ((node.value: any): DirectiveLocationEnum)
      ),
      args: directiveNode.arguments && makeInputValues(directiveNode.arguments),
    });
  }

  function getObjectType(typeNode: TypeDefinitionNode): GraphQLObjectType {
    const type = typeDefNamed(typeNode.name.value);
    invariant(
      type instanceof GraphQLObjectType,
      'AST must provide object type.'
    );
    return (type: any);
  }

  function produceType(typeNode: TypeNode): GraphQLType {
    const typeName = getNamedTypeNode(typeNode).name.value;
    const typeDef = typeDefNamed(typeName);
    return buildWrappedType(typeDef, typeNode);
  }

  function produceInputType(typeNode: TypeNode): GraphQLInputType {
    const type = produceType(typeNode);
    invariant(isInputType(type), 'Expected Input type.');
    return (type: any);
  }

  function produceOutputType(typeNode: TypeNode): GraphQLOutputType {
    const type = produceType(typeNode);
    invariant(isOutputType(type), 'Expected Output type.');
    return (type: any);
  }

  function produceObjectType(typeNode: TypeNode): GraphQLObjectType {
    const type = produceType(typeNode);
    invariant(type instanceof GraphQLObjectType, 'Expected Object type.');
    return type;
  }

  function produceInterfaceType(typeNode: TypeNode): GraphQLInterfaceType {
    const type = produceType(typeNode);
    invariant(type instanceof GraphQLInterfaceType, 'Expected Interface type.');
    return type;
  }

  function typeDefNamed(typeName: string): GraphQLNamedType {
    if (innerTypeMap[typeName]) {
      return innerTypeMap[typeName];
    }

    if (!nodeMap[typeName]) {
      throw new Error(`Type "${typeName}" not found in document.`);
    }

    const innerTypeDef = makeSchemaDef(nodeMap[typeName]);
    if (!innerTypeDef) {
      throw new Error(`Nothing constructed for "${typeName}".`);
    }
    innerTypeMap[typeName] = innerTypeDef;
    return innerTypeDef;
  }

  function makeSchemaDef(def) {
    if (!def) {
      throw new Error('def must be defined');
    }
    switch (def.kind) {
      case OBJECT_TYPE_DEFINITION:
        return makeTypeDef(def);
      case INTERFACE_TYPE_DEFINITION:
        return makeInterfaceDef(def);
      case ENUM_TYPE_DEFINITION:
        return makeEnumDef(def);
      case UNION_TYPE_DEFINITION:
        return makeUnionDef(def);
      case SCALAR_TYPE_DEFINITION:
        return makeScalarDef(def);
      case INPUT_OBJECT_TYPE_DEFINITION:
        return makeInputObjectDef(def);
      default:
        throw new Error(`Type kind "${def.kind}" not supported.`);
    }
  }

  function makeTypeDef(def: ObjectTypeDefinitionNode) {
    const typeName = def.name.value;
    return new GraphQLObjectType({
      name: typeName,
      description: getDescription(def),
      fields: () => makeFieldDefMap(def),
      interfaces: () => makeImplementedInterfaces(def),
    });
  }

  function makeFieldDefMap(
    def: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode
  ) {
    return keyValMap(
      def.fields,
      field => field.name.value,
      field => ({
        type: produceOutputType(field.type),
        description: getDescription(field),
        args: makeInputValues(field.arguments),
        deprecationReason: getDeprecationReason(field.directives)
      })
    );
  }

  function makeImplementedInterfaces(def: ObjectTypeDefinitionNode) {
    return def.interfaces &&
      def.interfaces.map(iface => produceInterfaceType(iface));
  }

  function makeInputValues(values: Array<InputValueDefinitionNode>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = produceInputType(value.type);
        return {
          type,
          description: getDescription(value),
          defaultValue: valueFromAST(value.defaultValue, type)
        };
      }
    );
  }

  function makeInterfaceDef(def: InterfaceTypeDefinitionNode) {
    const typeName = def.name.value;
    return new GraphQLInterfaceType({
      name: typeName,
      description: getDescription(def),
      fields: () => makeFieldDefMap(def),
      resolveType: cannotExecuteSchema,
    });
  }

  function makeEnumDef(def: EnumTypeDefinitionNode) {
    const enumType = new GraphQLEnumType({
      name: def.name.value,
      description: getDescription(def),
      values: keyValMap(
        def.values,
        enumValue => enumValue.name.value,
        enumValue => ({
          description: getDescription(enumValue),
          deprecationReason: getDeprecationReason(enumValue.directives)
        })
      ),
    });

    return enumType;
  }

  function makeUnionDef(def: UnionTypeDefinitionNode) {
    return new GraphQLUnionType({
      name: def.name.value,
      description: getDescription(def),
      types: def.types.map(t => produceObjectType(t)),
      resolveType: cannotExecuteSchema,
    });
  }

  function makeScalarDef(def: ScalarTypeDefinitionNode) {
    return new GraphQLScalarType({
      name: def.name.value,
      description: getDescription(def),
      serialize: () => null,
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: () => false,
      parseLiteral: () => false,
    });
  }

  function makeInputObjectDef(def: InputObjectTypeDefinitionNode) {
    return new GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def),
      fields: () => makeInputValues(def.fields),
    });
  }
}

/**
 * Given a collection of directives, returns the string value for the
 * deprecation reason.
 */
export function getDeprecationReason(
  directives: ?Array<DirectiveNode>,
): ?string {
  const deprecatedAST = directives && find(
    directives,
    directive => directive.name.value === GraphQLDeprecatedDirective.name
  );
  if (!deprecatedAST) {
    return;
  }
  const { reason } = getArgumentValues(
    GraphQLDeprecatedDirective,
    deprecatedAST
  );
  return (reason: any);
}

/**
 * Given an ast node, returns its string description based on a contiguous
 * block full-line of comments preceding it.
 */
export function getDescription(node: { loc?: Location }): ?string {
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
