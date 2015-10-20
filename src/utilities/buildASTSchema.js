/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import isNullish from '../jsutils/isNullish';
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


type CompositeDefinition =
  ObjectTypeDefinition |
  InterfaceTypeDefinition |
  UnionTypeDefinition;

function buildWrappedType(innerType, inputTypeAST) {
  if (inputTypeAST.kind === LIST_TYPE) {
    return new GraphQLList(buildWrappedType(innerType, inputTypeAST.type));
  }
  if (inputTypeAST.kind === NON_NULL_TYPE) {
    return new GraphQLNonNull(buildWrappedType(innerType, inputTypeAST.type));
  }
  return innerType;
}

function getInnerTypeName(typeAST) {
  if (typeAST.kind === LIST_TYPE || typeAST.kind === NON_NULL_TYPE) {
    return getInnerTypeName(typeAST.type);
  }
  return typeAST.name.value;
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

  if (isNullish(ast)) {
    throw new Error('must pass in ast');
  }
  if (isNullish(queryTypeName)) {
    throw new Error('must pass in query type');
  }

  var typeDefs = ast.definitions.filter(d => {
    switch (d.kind) {
      case OBJECT_TYPE_DEFINITION:
      case INTERFACE_TYPE_DEFINITION:
      case ENUM_TYPE_DEFINITION:
      case UNION_TYPE_DEFINITION:
      case SCALAR_TYPE_DEFINITION:
      case INPUT_OBJECT_TYPE_DEFINITION: return true;
    }
  });

  var astMap = keyMap(typeDefs, d => d.name.value);

  if (isNullish(astMap[queryTypeName])) {
    throw new Error('Specified query type ' + queryTypeName +
      ' not found in document.');
  }

  if (!isNullish(mutationTypeName) && isNullish(astMap[mutationTypeName])) {
    throw new Error('Specified mutation type ' + mutationTypeName +
      ' not found in document.');
  }

  if (!isNullish(subscriptionTypeName) &&
       isNullish(astMap[subscriptionTypeName])) {
    throw new Error('Specified subscription type ' + subscriptionTypeName +
      ' not found in document.');
  }

  /**
   * This generates a function that allows you to produce
   * type definitions on demand. We produce the function
   * in order to close over the memoization dictionaries
   * that need to be retained over multiple functions calls.
   **/
  function getTypeDefProducer() {

    var innerTypeMap = {
      String: GraphQLString,
      Int: GraphQLInt,
      Float: GraphQLFloat,
      Boolean: GraphQLBoolean,
      ID: GraphQLID,
    };

    return typeAST => {
      var typeName = getInnerTypeName(typeAST);
      if (!isNullish(innerTypeMap[typeName])) {
        return buildWrappedType(innerTypeMap[typeName], typeAST);
      }

      if (isNullish(astMap[typeName])) {
        throw new Error(`Type ${typeName} not found in document`);
      }

      var innerTypeDef = makeSchemaDef(astMap[typeName]);
      if (isNullish(innerTypeDef)) {
        throw new Error('Nothing constructed for ' + typeName);
      }
      innerTypeMap[typeName] = innerTypeDef;
      return buildWrappedType(innerTypeDef, typeAST);
    };
  }

  var produceTypeDef = getTypeDefProducer(ast);

  ast.definitions.forEach(produceTypeDef);

  var queryType = produceTypeDef(astMap[queryTypeName]);

  var schemaBody = {
    query: queryType
  };

  if (!isNullish(mutationTypeName)) {
    schemaBody.mutation = produceTypeDef(astMap[mutationTypeName]);
  }

  if (!isNullish(subscriptionTypeName)) {
    schemaBody.subscription = produceTypeDef(astMap[subscriptionTypeName]);
  }

  return new GraphQLSchema(schemaBody);

  function makeSchemaDef(def) {
    if (isNullish(def)) {
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
    var typeName = def.name.value;
    var config = {
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
        var type = produceTypeDef(value.type);
        return { type, defaultValue: valueFromAST(value.defaultValue, type) };
      }
    );
  }

  function makeInterfaceDef(def: InterfaceTypeDefinition) {
    var typeName = def.name.value;
    var config = {
      name: typeName,
      resolveType: () => null,
      fields: () => makeFieldDefMap(def),
    };
    return new GraphQLInterfaceType(config);
  }

  function makeEnumDef(def: EnumTypeDefinition) {
    var enumType = new GraphQLEnumType({
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
