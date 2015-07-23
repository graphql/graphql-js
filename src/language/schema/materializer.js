/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  TYPE_DEFINITION,
  INTERFACE_DEFINITION,
  ENUM_DEFINITION,
  UNION_DEFINITION,
  SCALAR_DEFINITION,
  INPUT_OBJECT_DEFINITION,
} from './kinds';

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
} from '../../type';

import {
  SchemaDocument,
  EnumDefinition,
  InterfaceDefinition,
  UnionDefinition,
  TypeDefinition,
  CompositeDefinition,
  ArgumentDefinition,
  ScalarDefinition,
  InputObjectDefinition,
} from './ast';

import {
  coerceValueAST
} from '../../executor/values';

import {
  LIST_TYPE,
  NON_NULL_TYPE,
} from '../kinds';

function nullish(obj) {
  return obj === null || obj === undefined;
}

/**
 * Takes the array of N elements constructs an object.
 * For each elemenet sets obj[keyFnArg(e}] = valueFnArg
 * If they are not specified they default to the identity function
 */
function makeDict(array, keyFnArg, valueFnArg) {
  var map = {};
  var keyFn = nullish(keyFnArg) ? t => t : keyFnArg;
  var valueFn = nullish(valueFnArg) ? t => t : valueFnArg;
  array.forEach((item) => {
    map[keyFn(item)] = valueFn(item);
  });
  return map;
}

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
export function materializeSchema(
  ast: SchemaDocument,
  queryTypeName: string,
  mutationTypeName: ?string): GraphQLSchema {

  if (nullish(ast)) {
    throw new Error('must pass in ast');
  }
  if (nullish(queryTypeName)) {
    throw new Error('must pass in query type');
  }

  var astMap = makeDict(ast.definitions, d => d.name.value);

  if (nullish(astMap[queryTypeName])) {
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
      if (!nullish(innerTypeMap[typeName])) {
        return buildWrappedType(innerTypeMap[typeName], typeAST);
      }

      if (nullish(astMap[typeName])) {
        throw new Error(`Type ${typeName} not found in document`);
      }

      var innerTypeDef = makeSchemaDef(astMap[typeName]);
      if (nullish(innerTypeDef)) {
        throw new Error('Nothing constructed for ' + typeName);
      }
      innerTypeMap[typeName] = innerTypeDef;
      return buildWrappedType(innerTypeDef, typeAST);
    };
  }


  var produceTypeDef = getTypeDefProducer(ast);

  if (nullish(astMap[queryTypeName])) {
    throw new Error(`Type ${queryTypeName} not found in document`);
  }

  var queryType = produceTypeDef(astMap[queryTypeName]);
  var schema;
  if (nullish(mutationTypeName)) {
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
    if (nullish(def)) {
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
    return makeDict(
      def.fields,
      field => field.name.value,
      field => ({
        type: produceTypeDef(field.type),
        args: makeArgs(field.arguments),
      })
    );
  }

  function makeImplementedInterfaces(def: TypeDefinition) {
    return def.interfaces.map(inter => produceTypeDef(inter));
  }

  function makeArgs(args: Array<ArgumentDefinition>) {
    return makeDict(
      args,
      arg => arg.name.value,
      arg => {
        var type = produceTypeDef(arg.type);
        return {
          type: type,
          defaultValue: coerceValueAST(type, arg.defaultValue),
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
      values: makeDict(def.values, v => v.name.value, () => ({})),
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
      fields: () => makeInputFieldDefMap(def),
    });
  }

  function makeInputFieldDefMap(def: InputObjectDefinition) {
    return makeDict(
      def.fields,
      field => field.name.value,
      field => ({type: produceTypeDef(field.type)})
    );
  }
}

