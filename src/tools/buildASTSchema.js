/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import isNullish from '../utils/isNullish';
import keyMap from '../utils/keyMap';
import keyValMap from '../utils/keyValMap';
import { valueFromAST } from './valueFromAST';

import {
  LIST_TYPE,
  NON_NULL_TYPE,
} from '../language/kinds';

import {
  TYPE_DEFINITION,
  INTERFACE_DEFINITION,
  ENUM_DEFINITION,
  UNION_DEFINITION,
  SCALAR_DEFINITION,
  INPUT_OBJECT_DEFINITION,
} from '../language/schema/kinds';

import {
  SchemaDocument,
  EnumDefinition,
  InterfaceDefinition,
  UnionDefinition,
  TypeDefinition,
  InputValueDefinition,
  ScalarDefinition,
  InputObjectDefinition,
} from '../language/schema/ast';

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
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
} from '../type';


type CompositeDefinition =
  TypeDefinition |
  InterfaceDefinition |
  UnionDefinition;

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
  ast: SchemaDocument,
  queryTypeName: string,
  mutationTypeName: ?string
): GraphQLSchema {

  if (isNullish(ast)) {
    throw new Error('must pass in ast');
  }
  if (isNullish(queryTypeName)) {
    throw new Error('must pass in query type');
  }

  var astMap = keyMap(ast.definitions, d => d.name.value);

  if (isNullish(astMap[queryTypeName])) {
    throw new Error('Specified query type ' + queryTypeName +
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
      Boolean: GraphQLBoolean,
      ID: GraphQLID,
    };

    return (typeAST) => {
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

  if (isNullish(astMap[queryTypeName])) {
    throw new Error(`Type ${queryTypeName} not found in document`);
  }

  var queryType = produceTypeDef(astMap[queryTypeName]);
  var schema;
  if (isNullish(mutationTypeName)) {
    schema = new GraphQLSchema({query: queryType});
  } else {
    schema = new GraphQLSchema({
      query: queryTypeName,
      mutation: produceTypeDef(astMap[mutationTypeName]),
    });
  }

  // This actually constructs all the types by iterating over the schema
  // This makes it so that errors actually get caught before this function
  // exits.
  schema.getTypeMap();
  return schema;

  function makeSchemaDef(def) {
    if (isNullish(def)) {
      throw new Error('def must be defined');
    }
    switch (def.kind) {
      case TYPE_DEFINITION:
        return makeTypeDef(def);
      case INTERFACE_DEFINITION:
        return makeInterfaceDef(def);
      case ENUM_DEFINITION:
        return makeEnumDef(def);
      case UNION_DEFINITION:
        return makeUnionDef(def);
      case SCALAR_DEFINITION:
        return makeScalarDef(def);
      case INPUT_OBJECT_DEFINITION:
        return makeInputObjectDef(def);
      default:
        throw new Error(def.kind + ' not supported');
    }
  }

  function makeTypeDef(def: TypeDefinition) {
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

  function makeImplementedInterfaces(def: TypeDefinition) {
    return def.interfaces.map(inter => produceTypeDef(inter));
  }

  function makeInputValues(values: Array<InputValueDefinition>) {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        var type = produceTypeDef(value.type);
        return {
          type: type,
          defaultValue: valueFromAST(value.defaultValue, type),
        };
      }
    );
  }

  function makeInterfaceDef(def: InterfaceDefinition) {
    var typeName = def.name.value;
    var config = {
      name: typeName,
      fields: () => makeFieldDefMap(def),
    };
    return new GraphQLInterfaceType(config);
  }

  function makeEnumDef(def: EnumDefinition) {
    var enumType = new GraphQLEnumType({
      name: def.name.value,
      values: keyValMap(def.values, v => v.name.value, () => ({})),
    });

    return enumType;
  }

  function makeUnionDef(def: UnionDefinition) {
    return new GraphQLUnionType({
      name: def.name.value,
      types: def.types.map(t => produceTypeDef(t)),
    });
  }

  function makeScalarDef(def: ScalarDefinition) {
    return new GraphQLScalarType({
      name: def.name.value,
    });
  }

  function makeInputObjectDef(def: InputObjectDefinition) {
    return new GraphQLInputObjectType({
      name: def.name.value,
      fields: () => makeInputValues(def.fields),
    });
  }
}
