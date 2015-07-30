/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../utils/invariant';
import keyMap from '../utils/keyMap';
import keyValMap from '../utils/keyValMap';

import { parseValue } from '../language/parser';
import { coerceValueAST } from '../executor/values';

import { GraphQLSchema } from './schema';

import {
  isInputType,
  isOutputType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from './definition';

import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID
} from './scalars';

import { TypeKind } from './introspection';

import type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLNamedType,
} from './definition';

import type {
  IntrospectionQuery,
  IntrospectionType,
  IntrospectionScalarType,
  IntrospectionObjectType,
  IntrospectionInterfaceType,
  IntrospectionUnionType,
  IntrospectionEnumType,
  IntrospectionInputObjectType,
  IntrospectionTypeRef,
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
} from './introspectionQuery';


/**
 * Build a GraphQLSchema for use by client tools.
 *
 * Given the result of a client running the introspection query, creates and
 * returns a GraphQLSchema instance which can be then used with all graphql-js
 * tools, but cannot be used to execute a query, as introspection does not
 * represent the "resolver" or "coerce" functions or any other server-internal
 * mechanisms.
 */
export function buildClientSchema(
  introspection: IntrospectionQuery
): GraphQLSchema {

  // Get the schema from the introspection result.
  var schemaIntrospection = introspection.__schema;

  // Converts the list of types into a keyMap based on the type names.
  var typeIntrospectionMap = keyMap(
    schemaIntrospection.types,
    type => type.name
  );

  // A cache to use to store the actual GraphQLType definition objects by name.
  // Initialize to the GraphQL built in scalars. All functions below are inline
  // so that this type def cache is within the scope of the closure.
  var typeDefCache = {
    String: GraphQLString,
    Int: GraphQLInt,
    Float: GraphQLFloat,
    Boolean: GraphQLBoolean,
    ID: GraphQLID,
  };

  // Given a type reference in introspection, return the GraphQLType instance.
  // preferring cached instances before building new instances.
  function getType(typeRef: IntrospectionTypeRef): GraphQLType {
    if (typeRef.kind === TypeKind.LIST) {
      var itemRef = ((typeRef: any): IntrospectionListTypeRef).ofType;
      if (!itemRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return new GraphQLList(getType(itemRef));
    } else if (typeRef.kind === TypeKind.NON_NULL) {
      var nullableRef = ((typeRef: any): IntrospectionNonNullTypeRef).ofType;
      if (!nullableRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return new GraphQLNonNull(getType(nullableRef));
    } else {
      return getNamedType(typeRef.name);
    }
  }

  function getNamedType(typeName: string): GraphQLNamedType {
    if (typeDefCache[typeName]) {
      return typeDefCache[typeName];
    }
    var typeIntrospection = typeIntrospectionMap[typeName];
    if (!typeIntrospection) {
      throw new Error(
        `Invalid or incomplete schema, unknown type: ${typeName}. Ensure ` +
        `that a full introspection query is used in order to build a ` +
        `client schema.`
      );
    }
    var typeDef = buildType(typeIntrospection);
    typeDefCache[typeName] = typeDef;
    return typeDef;
  }

  function getInputType(typeRef: IntrospectionTypeRef): GraphQLInputType {
    var type = getType(typeRef);
    invariant(
      isInputType(type),
      `Introspection must provide input type for arguments.`
    );
    return (type: any);
  }

  function getOutputType(typeRef: IntrospectionTypeRef): GraphQLOutputType {
    var type = getType(typeRef);
    invariant(
      isOutputType(type),
      `Introspection must provide output type for fields.`
    );
    return (type: any);
  }

  function getObjectType(typeRef: IntrospectionTypeRef): GraphQLObjectType {
    var type = getType(typeRef);
    invariant(
      type instanceof GraphQLObjectType,
      `Introspection must provide object type for possibleTypes.`
    );
    return (type: any);
  }

  function getInterfaceType(
    typeRef: IntrospectionTypeRef
  ): GraphQLInterfaceType {
    var type = getType(typeRef);
    invariant(
      type instanceof GraphQLInterfaceType,
      `Introspection must provide interface type for interfaces.`
    );
    return (type: any);
  }


  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function buildType(type: IntrospectionType): GraphQLType {
    switch (type.kind) {
      case TypeKind.SCALAR:
        return buildScalarDef(type);
      case TypeKind.OBJECT:
        return buildObjectDef(type);
      case TypeKind.INTERFACE:
        return buildInterfaceDef(type);
      case TypeKind.UNION:
        return buildUnionDef(type);
      case TypeKind.ENUM:
        return buildEnumDef(type);
      case TypeKind.INPUT_OBJECT:
        return buildInputObjectDef(type);
      default:
        throw new Error(
          `Invalid or incomplete schema, unknown kind: ${type.kind}. Ensure ` +
          `that a full introspection query is used in order to build a ` +
          `client schema.`
        );
    }
  }

  function buildScalarDef(
    scalarIntrospection: IntrospectionScalarType
  ): GraphQLScalarType {
    return new GraphQLScalarType({
      name: scalarIntrospection.name,
      description: scalarIntrospection.description,
      // Note: validation calls the coerce functions to determine if a
      // query value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      coerce: () => false,
      coerceLiteral: () => false,
    });
  }

  function buildObjectDef(
    objectIntrospection: IntrospectionObjectType
  ): GraphQLObjectType {
    return new GraphQLObjectType({
      name: objectIntrospection.name,
      description: objectIntrospection.description,
      interfaces: objectIntrospection.interfaces.map(getInterfaceType),
      fields: () => buildFieldDefMap(objectIntrospection),
    });
  }

  function buildInterfaceDef(
    interfaceIntrospection: IntrospectionInterfaceType
  ): GraphQLInterfaceType {
    return new GraphQLInterfaceType({
      name: interfaceIntrospection.name,
      description: interfaceIntrospection.description,
      fields: () => buildFieldDefMap(interfaceIntrospection),
    });
  }

  function buildUnionDef(
    unionIntrospection: IntrospectionUnionType
  ): GraphQLUnionType {
    return new GraphQLUnionType({
      name: unionIntrospection.name,
      description: unionIntrospection.description,
      types: unionIntrospection.possibleTypes.map(getObjectType),
    });
  }

  function buildEnumDef(
    enumIntrospection: IntrospectionEnumType
  ): GraphQLEnumType {
    return new GraphQLEnumType({
      name: enumIntrospection.name,
      description: enumIntrospection.description,
      values: keyValMap(
        enumIntrospection.enumValues,
        valueIntrospection => valueIntrospection.name,
        valueIntrospection => ({
          description: valueIntrospection.description,
        })
      )
    });
  }

  function buildInputObjectDef(
    inputObjectIntrospection: IntrospectionInputObjectType
  ): GraphQLInputObjectType {
    return new GraphQLInputObjectType({
      name: inputObjectIntrospection.name,
      description: inputObjectIntrospection.description,
      fields: () => buildInputValueDefMap(inputObjectIntrospection.inputFields),
    });
  }

  function buildFieldDefMap(typeIntrospection): any {
    return keyValMap(
      typeIntrospection.fields,
      fieldIntrospection => fieldIntrospection.name,
      fieldIntrospection => ({
        description: fieldIntrospection.description,
        type: getOutputType(fieldIntrospection.type),
        args: buildInputValueDefMap(fieldIntrospection.args),
        resolve: () => {
          throw new Error('Client Schema cannot be used for execution.');
        },
      })
    );
  }

  function buildInputValueDefMap(inputValueIntrospections) {
    return keyValMap(
      inputValueIntrospections,
      inputValue => inputValue.name,
      inputValue => {
        var description = inputValue.description;
        var type = getInputType(inputValue.type);
        var defaultValue = inputValue.defaultValue ?
          coerceValueAST(type, parseValue(inputValue.defaultValue)) :
          null;
        return { description, type, defaultValue };
      }
    );
  }

  // TODO: deprecation
  // TODO: directives

  // Iterate through all types, getting the type definition for each, ensuring
  // that any type not directly referenced by a field will get created.
  schemaIntrospection.types.forEach(
    typeIntrospection => getNamedType(typeIntrospection.name)
  );

  // Get the root Query and Mutation types.
  var queryType = getType(schemaIntrospection.queryType);
  var mutationType = schemaIntrospection.mutationType ?
    getType(schemaIntrospection.mutationType) :
    null;

  // Then produce and return a Schema with these types.
  var schema = new GraphQLSchema({
    query: (queryType: any),
    mutation: (mutationType: any)
  });

  // The schema is lazy by default, getting the type map will resolve any
  // deferred functions, ensuring that any errors are presented before this
  // function exits.
  schema.getTypeMap();

  return schema;
}
