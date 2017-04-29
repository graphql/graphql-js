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
import { parseValue } from '../language/parser';
import { GraphQLSchema } from '../type/schema';

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
} from '../type/definition';

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

import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID
} from '../type/scalars';

import { DirectiveLocation, GraphQLDirective } from '../type/directives';

import { TypeKind } from '../type/introspection';

import type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLNamedType,
} from '../type/definition';

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
 * represent the "resolver", "parse" or "serialize" functions or any other
 * server-internal mechanisms.
 */
export function buildClientSchema(
  introspection: IntrospectionQuery
): GraphQLSchema {

  // Get the schema from the introspection result.
  const schemaIntrospection = introspection.__schema;

  // Converts the list of types into a keyMap based on the type names.
  const typeIntrospectionMap = keyMap(
    schemaIntrospection.types,
    type => type.name
  );

  // A cache to use to store the actual GraphQLType definition objects by name.
  // Initialize to the GraphQL built in scalars. All functions below are inline
  // so that this type def cache is within the scope of the closure.
  const typeDefCache = {
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

  // Given a type reference in introspection, return the GraphQLType instance.
  // preferring cached instances before building new instances.
  function getType(typeRef: IntrospectionTypeRef): GraphQLType {
    if (typeRef.kind === TypeKind.LIST) {
      const itemRef = ((typeRef: any): IntrospectionListTypeRef).ofType;
      if (!itemRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return new GraphQLList(getType(itemRef));
    }
    if (typeRef.kind === TypeKind.NON_NULL) {
      const nullableRef = ((typeRef: any): IntrospectionNonNullTypeRef).ofType;
      if (!nullableRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      const nullableType = getType(nullableRef);
      invariant(
        !(nullableType instanceof GraphQLNonNull),
        'No nesting nonnull.'
      );
      return new GraphQLNonNull(nullableType);
    }
    return getNamedType(typeRef.name);
  }

  function getNamedType(typeName: string): GraphQLNamedType {
    if (typeDefCache[typeName]) {
      return typeDefCache[typeName];
    }
    const typeIntrospection = typeIntrospectionMap[typeName];
    if (!typeIntrospection) {
      throw new Error(
        `Invalid or incomplete schema, unknown type: ${typeName}. Ensure ` +
        'that a full introspection query is used in order to build a ' +
        'client schema.'
      );
    }
    const typeDef = buildType(typeIntrospection);
    typeDefCache[typeName] = typeDef;
    return typeDef;
  }

  function getInputType(typeRef: IntrospectionTypeRef): GraphQLInputType {
    const type = getType(typeRef);
    invariant(
      isInputType(type),
      'Introspection must provide input type for arguments.'
    );
    return type;
  }

  function getOutputType(typeRef: IntrospectionTypeRef): GraphQLOutputType {
    const type = getType(typeRef);
    invariant(
      isOutputType(type),
      'Introspection must provide output type for fields.'
    );
    return type;
  }

  function getObjectType(typeRef: IntrospectionTypeRef): GraphQLObjectType {
    const type = getType(typeRef);
    invariant(
      type instanceof GraphQLObjectType,
      'Introspection must provide object type for possibleTypes.'
    );
    return type;
  }

  function getInterfaceType(
    typeRef: IntrospectionTypeRef
  ): GraphQLInterfaceType {
    const type = getType(typeRef);
    invariant(
      type instanceof GraphQLInterfaceType,
      'Introspection must provide interface type for interfaces.'
    );
    return type;
  }


  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function buildType(type: IntrospectionType): GraphQLNamedType {
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
          'that a full introspection query is used in order to build a ' +
          'client schema.'
        );
    }
  }

  function buildScalarDef(
    scalarIntrospection: IntrospectionScalarType
  ): GraphQLScalarType {
    return new GraphQLScalarType({
      name: scalarIntrospection.name,
      description: scalarIntrospection.description,
      serialize: id => id,
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: () => false,
      parseLiteral: () => false,
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
      resolveType: cannotExecuteClientSchema,
    });
  }

  function buildUnionDef(
    unionIntrospection: IntrospectionUnionType
  ): GraphQLUnionType {
    return new GraphQLUnionType({
      name: unionIntrospection.name,
      description: unionIntrospection.description,
      types: unionIntrospection.possibleTypes.map(getObjectType),
      resolveType: cannotExecuteClientSchema,
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
          deprecationReason: valueIntrospection.deprecationReason,
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

  function buildFieldDefMap(typeIntrospection) {
    return keyValMap(
      typeIntrospection.fields,
      fieldIntrospection => fieldIntrospection.name,
      fieldIntrospection => ({
        description: fieldIntrospection.description,
        deprecationReason: fieldIntrospection.deprecationReason,
        type: getOutputType(fieldIntrospection.type),
        args: buildInputValueDefMap(fieldIntrospection.args),
      })
    );
  }

  function buildInputValueDefMap(inputValueIntrospections) {
    return keyValMap(
      inputValueIntrospections,
      inputValue => inputValue.name,
      buildInputValue
    );
  }

  function buildInputValue(inputValueIntrospection) {
    const type = getInputType(inputValueIntrospection.type);
    const defaultValue = inputValueIntrospection.defaultValue ?
      valueFromAST(parseValue(inputValueIntrospection.defaultValue), type) :
      undefined;
    return {
      name: inputValueIntrospection.name,
      description: inputValueIntrospection.description,
      type,
      defaultValue,
    };
  }

  function buildDirective(directiveIntrospection) {
    // Support deprecated `on****` fields for building `locations`, as this
    // is used by GraphiQL which may need to support outdated servers.
    const locations = directiveIntrospection.locations ?
      directiveIntrospection.locations.slice() :
      [].concat(
        !directiveIntrospection.onField ? [] : [
          DirectiveLocation.FIELD,
        ],
        !directiveIntrospection.onOperation ? [] : [
          DirectiveLocation.QUERY,
          DirectiveLocation.MUTATION,
          DirectiveLocation.SUBSCRIPTION,
        ],
        !directiveIntrospection.onFragment ? [] : [
          DirectiveLocation.FRAGMENT_DEFINITION,
          DirectiveLocation.FRAGMENT_SPREAD,
          DirectiveLocation.INLINE_FRAGMENT,
        ]
      );
    return new GraphQLDirective({
      name: directiveIntrospection.name,
      description: directiveIntrospection.description,
      locations,
      args: buildInputValueDefMap(directiveIntrospection.args),
    });
  }

  // Iterate through all types, getting the type definition for each, ensuring
  // that any type not directly referenced by a field will get created.
  const types = schemaIntrospection.types.map(
    typeIntrospection => getNamedType(typeIntrospection.name)
  );

  // Get the root Query, Mutation, and Subscription types.
  const queryType = getObjectType(schemaIntrospection.queryType);

  const mutationType = schemaIntrospection.mutationType ?
    getObjectType(schemaIntrospection.mutationType) :
    null;

  const subscriptionType = schemaIntrospection.subscriptionType ?
    getObjectType(schemaIntrospection.subscriptionType) :
    null;

  // Get the directives supported by Introspection, assuming empty-set if
  // directives were not queried for.
  const directives = schemaIntrospection.directives ?
    schemaIntrospection.directives.map(buildDirective) :
    [];

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types,
    directives,
  });
}

function cannotExecuteClientSchema() {
  throw new Error(
    'Client Schema cannot use Interface or Union types for execution.'
  );
}
