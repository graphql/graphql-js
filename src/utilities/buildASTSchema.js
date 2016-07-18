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
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import { valueFromAST } from './valueFromAST';

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
  Document,
  Directive,
  Type,
  NamedType,
  SchemaDefinition,
  TypeDefinition,
  ScalarTypeDefinition,
  ObjectTypeDefinition,
  InputValueDefinition,
  InterfaceTypeDefinition,
  UnionTypeDefinition,
  EnumTypeDefinition,
  InputObjectTypeDefinition,
  DirectiveDefinition,
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
  inputTypeAST: Type
): GraphQLType {
  if (inputTypeAST.kind === LIST_TYPE) {
    return new GraphQLList(buildWrappedType(innerType, inputTypeAST.type));
  }
  if (inputTypeAST.kind === NON_NULL_TYPE) {
    const wrappedType = buildWrappedType(innerType, inputTypeAST.type);
    invariant(!(wrappedType instanceof GraphQLNonNull), 'No nesting nonnull.');
    return new GraphQLNonNull(wrappedType);
  }
  return innerType;
}

function getNamedTypeAST(typeAST: Type): NamedType {
  let namedType = typeAST;
  while (namedType.kind === LIST_TYPE || namedType.kind === NON_NULL_TYPE) {
    namedType = namedType.type;
  }
  return namedType;
}

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * Given that AST it constructs a GraphQLSchema. As constructed
 * they are not particularly useful for non-introspection queries
 * since they have no resolve methods.
 */
export function buildASTSchema(ast: Document): GraphQLSchema {
  if (!ast || ast.kind !== DOCUMENT) {
    throw new Error('Must provide a document ast.');
  }

  let schemaDef: ?SchemaDefinition;

  const typeDefs: Array<TypeDefinition> = [];
  const directiveDefs: Array<DirectiveDefinition> = [];
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
        break;
      case DIRECTIVE_DEFINITION:
        directiveDefs.push(d);
        break;
    }
  }

  if (!schemaDef) {
    throw new Error('Must provide a schema definition.');
  }

  let queryTypeName;
  let mutationTypeName;
  let subscriptionTypeName;
  schemaDef.operationTypes.forEach(operationType => {
    const typeName = operationType.type.name.value;
    if (operationType.operation === 'query') {
      if (queryTypeName) {
        throw new Error('Must provide only one query type in schema.');
      }
      queryTypeName = typeName;
    } else if (operationType.operation === 'mutation') {
      if (mutationTypeName) {
        throw new Error('Must provide only one mutation type in schema.');
      }
      mutationTypeName = typeName;
    } else if (operationType.operation === 'subscription') {
      if (subscriptionTypeName) {
        throw new Error('Must provide only one subscription type in schema.');
      }
      subscriptionTypeName = typeName;
    }
  });

  if (!queryTypeName) {
    throw new Error('Must provide schema definition with query type.');
  }

  const astMap: {[name: string]: TypeDefinition} =
    keyMap(typeDefs, d => d.name.value);

  if (!astMap[queryTypeName]) {
    throw new Error(
      `Specified query type "${queryTypeName}" not found in document.`
    );
  }

  if (mutationTypeName && !astMap[mutationTypeName]) {
    throw new Error(
      `Specified mutation type "${mutationTypeName}" not found in document.`
    );
  }

  if (subscriptionTypeName && !astMap[subscriptionTypeName]) {
    throw new Error(
      `Specified subscription type "${
        subscriptionTypeName}" not found in document.`
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
    query: getObjectType(astMap[queryTypeName]),
    mutation: mutationTypeName ? getObjectType(astMap[mutationTypeName]) : null,
    subscription:
      subscriptionTypeName ? getObjectType(astMap[subscriptionTypeName]) : null,
    types,
    directives,
  });

  function getDirective(directiveAST: DirectiveDefinition): GraphQLDirective {
    return new GraphQLDirective({
      name: directiveAST.name.value,
      locations: directiveAST.locations.map(
        node => ((node.value: any): DirectiveLocationEnum)
      ),
      args: directiveAST.arguments && makeInputValues(directiveAST.arguments),
    });
  }

  function getObjectType(typeAST: TypeDefinition): GraphQLObjectType {
    const type = typeDefNamed(typeAST.name.value);
    invariant(
      type instanceof GraphQLObjectType,
      'AST must provide object type.'
    );
    return (type: any);
  }

  function produceType(typeAST: Type): GraphQLType {
    const typeName = getNamedTypeAST(typeAST).name.value;
    const typeDef = typeDefNamed(typeName);
    return buildWrappedType(typeDef, typeAST);
  }

  function produceInputType(typeAST: Type): GraphQLInputType {
    const type = produceType(typeAST);
    invariant(isInputType(type), 'Expected Input type.');
    return (type: any);
  }

  function produceOutputType(typeAST: Type): GraphQLOutputType {
    const type = produceType(typeAST);
    invariant(isOutputType(type), 'Expected Output type.');
    return (type: any);
  }

  function produceObjectType(typeAST: Type): GraphQLObjectType {
    const type = produceType(typeAST);
    invariant(type instanceof GraphQLObjectType, 'Expected Object type.');
    return type;
  }

  function produceInterfaceType(typeAST: Type): GraphQLInterfaceType {
    const type = produceType(typeAST);
    invariant(type instanceof GraphQLInterfaceType, 'Expected Object type.');
    return type;
  }

  function typeDefNamed(typeName: string): GraphQLNamedType {
    if (innerTypeMap[typeName]) {
      return innerTypeMap[typeName];
    }

    if (!astMap[typeName]) {
      throw new Error(`Type "${typeName}" not found in document.`);
    }

    const innerTypeDef = makeSchemaDef(astMap[typeName]);
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

  function makeTypeDef(def: ObjectTypeDefinition) {
    const typeName = def.name.value;
    const config = {
      name: typeName,
      fields: () => makeFieldDefMap(def),
      interfaces: () => makeImplementedInterfaces(def),
    };
    return new GraphQLObjectType(config);
  }

  function makeFieldDefMap(
    def: ObjectTypeDefinition | InterfaceTypeDefinition
  ) {
    return keyValMap(
      def.fields,
      field => field.name.value,
      field => ({
        type: produceOutputType(field.type),
        args: makeInputValues(field.arguments),
        deprecationReason: getDeprecationReason(field.directives)
      })
    );
  }

  function makeImplementedInterfaces(def: ObjectTypeDefinition) {
    return def.interfaces &&
      def.interfaces.map(iface => produceInterfaceType(iface));
  }

  function makeInputValues(values: Array<InputValueDefinition>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = produceInputType(value.type);
        return { type, defaultValue: valueFromAST(value.defaultValue, type) };
      }
    );
  }

  function makeInterfaceDef(def: InterfaceTypeDefinition) {
    const typeName = def.name.value;
    const config = {
      name: typeName,
      resolveType: () => null,
      fields: () => makeFieldDefMap(def),
    };
    return new GraphQLInterfaceType(config);
  }

  function makeEnumDef(def: EnumTypeDefinition) {
    const enumType = new GraphQLEnumType({
      name: def.name.value,
      values: keyValMap(
        def.values,
        enumValue => enumValue.name.value,
        enumValue => ({
          deprecationReason: getDeprecationReason(enumValue.directives)
        })
      ),
    });

    return enumType;
  }

  function makeUnionDef(def: UnionTypeDefinition) {
    return new GraphQLUnionType({
      name: def.name.value,
      resolveType: () => null,
      types: def.types.map(t => produceObjectType(t)),
    });
  }

  function makeScalarDef(def: ScalarTypeDefinition) {
    return new GraphQLScalarType({
      name: def.name.value,
      serialize: () => null,
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: () => false,
      parseLiteral: () => false,
    });
  }

  function makeInputObjectDef(def: InputObjectTypeDefinition) {
    return new GraphQLInputObjectType({
      name: def.name.value,
      fields: () => makeInputValues(def.fields),
    });
  }
}

function getDeprecationReason(directives: ?Array<Directive>): ?string {
  const deprecatedAST = directives && find(
    directives,
    directive => directive.name.value === GraphQLDeprecatedDirective.name
  );
  if (!deprecatedAST) {
    return;
  }
  const { reason } = getArgumentValues(
    GraphQLDeprecatedDirective.args,
    deprecatedAST.arguments
  );
  return (reason: any);
}
