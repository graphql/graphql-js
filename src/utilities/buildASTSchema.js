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
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import { valueFromAST } from './valueFromAST';

import {
  LIST_TYPE,
  NON_NULL_TYPE,
} from '../language/kinds';

import {
  OBJECT_TYPE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  SCALAR_TYPE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,
} from '../language/kinds';

import type {
  Document,
  Type,
  NamedType,
  TypeDefinition,
  ObjectTypeDefinition,
  InputValueDefinition,
  InterfaceTypeDefinition,
  UnionTypeDefinition,
  ScalarTypeDefinition,
  EnumTypeDefinition,
  InputObjectTypeDefinition,
} from '../language/ast';

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
} from '../type';

import type {
  GraphQLType,
  GraphQLNamedType
} from '../type/definition';


type CompositeDefinition =
  ObjectTypeDefinition |
  InterfaceTypeDefinition |
  UnionTypeDefinition;

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
 * This takes the ast of a schema document produced by parseSchema in
 * src/language/schema/parser.js.
 *
 * Given that AST it constructs a GraphQLSchema. As constructed
 * they are not particularly useful for non-introspection queries
 * since they have no resolve methods.
 */
export function buildASTSchema(
  ast: Document,
  queryTypeName: string,
  mutationTypeName: ?string,
  subscriptionTypeName: ?string
): GraphQLSchema {
  if (!ast) {
    throw new Error('must pass in ast');
  }

  if (!queryTypeName) {
    throw new Error('must pass in query type');
  }

  const typeDefs: Array<TypeDefinition> = [];
  for (let i = 0; i < ast.definitions.length; i++) {
    const d = ast.definitions[i];
    switch (d.kind) {
      case OBJECT_TYPE_DEFINITION:
      case INTERFACE_TYPE_DEFINITION:
      case ENUM_TYPE_DEFINITION:
      case UNION_TYPE_DEFINITION:
      case SCALAR_TYPE_DEFINITION:
      case INPUT_OBJECT_TYPE_DEFINITION:
        typeDefs.push(d);
    }
  }

  const astMap: {[name: string]: TypeDefinition} =
    keyMap(typeDefs, d => d.name.value);

  if (!astMap[queryTypeName]) {
    throw new Error('Specified query type ' + queryTypeName +
      ' not found in document.');
  }

  if (mutationTypeName && !astMap[mutationTypeName]) {
    throw new Error('Specified mutation type ' + mutationTypeName +
      ' not found in document.');
  }

  if (subscriptionTypeName && !astMap[subscriptionTypeName]) {
    throw new Error('Specified subscription type ' + subscriptionTypeName +
      ' not found in document.');
  }

  const innerTypeMap = {
    String: GraphQLString,
    Int: GraphQLInt,
    Float: GraphQLFloat,
    Boolean: GraphQLBoolean,
    ID: GraphQLID,
  };

  typeDefs.forEach(def => typeDefNamed(def.name.value));

  return new GraphQLSchema({
    query: getObjectType(astMap[queryTypeName]),
    mutation: mutationTypeName ? getObjectType(astMap[mutationTypeName]) : null,
    subscription:
      subscriptionTypeName ? getObjectType(astMap[subscriptionTypeName]) : null,
  });

  function getObjectType(typeAST: TypeDefinition): GraphQLObjectType {
    const type = typeDefNamed(typeAST.name.value);
    invariant(
      type instanceof GraphQLObjectType,
      `AST must provide object type.`
    );
    return (type: any);
  }

  function produceTypeDef(typeAST: Type): GraphQLType {
    const typeName = getNamedTypeAST(typeAST).name.value;
    const typeDef = typeDefNamed(typeName);
    return buildWrappedType(typeDef, typeAST);
  }

  function typeDefNamed(typeName: string): GraphQLNamedType {
    if (innerTypeMap[typeName]) {
      return innerTypeMap[typeName];
    }

    if (!astMap[typeName]) {
      throw new Error(`Type ${typeName} not found in document`);
    }

    const innerTypeDef = makeSchemaDef(astMap[typeName]);
    if (!innerTypeDef) {
      throw new Error('Nothing constructed for ' + typeName);
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
        throw new Error(def.kind + ' not supported');
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

  function makeFieldDefMap(def: CompositeDefinition) {
    return keyValMap(
      def.fields,
      field => field.name.value,
      field => ({
        type: produceTypeDef(field.type),
        args: makeInputValues(field.arguments),
      })
    );
  }

  function makeImplementedInterfaces(def: ObjectTypeDefinition) {
    return def.interfaces.map(inter => produceTypeDef(inter));
  }

  function makeInputValues(values: Array<InputValueDefinition>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = produceTypeDef(value.type);
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
      values: keyValMap(def.values, v => v.name.value, () => ({})),
    });

    return enumType;
  }

  function makeUnionDef(def: UnionTypeDefinition) {
    return new GraphQLUnionType({
      name: def.name.value,
      resolveType: () => null,
      types: def.types.map(t => produceTypeDef(t)),
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
