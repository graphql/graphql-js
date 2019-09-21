// @flow strict

import objectValues from '../polyfills/objectValues';

import inspect from '../jsutils/inspect';
import devAssert from '../jsutils/devAssert';
import keyValMap from '../jsutils/keyValMap';
import isObjectLike from '../jsutils/isObjectLike';

import { parseValue } from '../language/parser';

import { GraphQLDirective } from '../type/directives';
import { specifiedScalarTypes } from '../type/scalars';
import { introspectionTypes, TypeKind } from '../type/introspection';
import {
  GraphQLSchema,
  type GraphQLSchemaValidationOptions,
} from '../type/schema';
import {
  assertInterfaceType,
  assertNullableType,
  assertObjectType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  type GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLList,
  type GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLScalarType,
  type GraphQLType,
  GraphQLUnionType,
  isInputType,
  isOutputType,
} from '../type/definition';

import { valueFromAST } from './valueFromAST';
import {
  type IntrospectionEnumType,
  type IntrospectionInputObjectType,
  type IntrospectionInputTypeRef,
  type IntrospectionInterfaceType,
  type IntrospectionNamedTypeRef,
  type IntrospectionObjectType,
  type IntrospectionOutputTypeRef,
  type IntrospectionQuery,
  type IntrospectionScalarType,
  type IntrospectionType,
  type IntrospectionTypeRef,
  type IntrospectionUnionType,
} from './getIntrospectionQuery';

type Options = {|
  ...GraphQLSchemaValidationOptions,
|};

/**
 * Build a GraphQLSchema for use by client tools.
 *
 * Given the result of a client running the introspection query, creates and
 * returns a GraphQLSchema instance which can be then used with all graphql-js
 * tools, but cannot be used to execute a query, as introspection does not
 * represent the "resolver", "parse" or "serialize" functions or any other
 * server-internal mechanisms.
 *
 * This function expects a complete introspection result. Don't forget to check
 * the "errors" field of a server response before calling this function.
 */
export function buildClientSchema(
  introspection: IntrospectionQuery,
  options?: Options,
): GraphQLSchema {
  devAssert(
    isObjectLike(introspection) && isObjectLike(introspection.__schema),
    `Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ${inspect(
      introspection,
    )}.`,
  );

  // Get the schema from the introspection result.
  const schemaIntrospection = introspection.__schema;

  // Iterate through all types, getting the type definition for each.
  const typeMap = keyValMap(
    schemaIntrospection.types,
    typeIntrospection => typeIntrospection.name,
    typeIntrospection => buildType(typeIntrospection),
  );

  // Include standard types only if they are used.
  for (const stdType of [...specifiedScalarTypes, ...introspectionTypes]) {
    if (typeMap[stdType.name]) {
      typeMap[stdType.name] = stdType;
    }
  }

  // Get the root Query, Mutation, and Subscription types.
  const queryType = schemaIntrospection.queryType
    ? getObjectType(schemaIntrospection.queryType)
    : null;

  const mutationType = schemaIntrospection.mutationType
    ? getObjectType(schemaIntrospection.mutationType)
    : null;

  const subscriptionType = schemaIntrospection.subscriptionType
    ? getObjectType(schemaIntrospection.subscriptionType)
    : null;

  // Get the directives supported by Introspection, assuming empty-set if
  // directives were not queried for.
  const directives = schemaIntrospection.directives
    ? schemaIntrospection.directives.map(buildDirective)
    : [];

  // Then produce and return a Schema with these types.
  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: objectValues(typeMap),
    directives,
    assumeValid: options && options.assumeValid,
  });

  // Given a type reference in introspection, return the GraphQLType instance.
  // preferring cached instances before building new instances.
  function getType(typeRef: IntrospectionTypeRef): GraphQLType {
    if (typeRef.kind === TypeKind.LIST) {
      const itemRef = typeRef.ofType;
      if (!itemRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return GraphQLList(getType(itemRef));
    }
    if (typeRef.kind === TypeKind.NON_NULL) {
      const nullableRef = typeRef.ofType;
      if (!nullableRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      const nullableType = getType(nullableRef);
      return GraphQLNonNull(assertNullableType(nullableType));
    }
    if (!typeRef.name) {
      throw new Error(`Unknown type reference: ${inspect(typeRef)}.`);
    }
    return getNamedType(typeRef.name);
  }

  function getNamedType(typeName: string): GraphQLNamedType {
    const type = typeMap[typeName];
    if (!type) {
      throw new Error(
        `Invalid or incomplete schema, unknown type: ${typeName}. Ensure that a full introspection query is used in order to build a client schema.`,
      );
    }

    return type;
  }

  function getInputType(typeRef: IntrospectionInputTypeRef): GraphQLInputType {
    const type = getType(typeRef);
    if (isInputType(type)) {
      return type;
    }
    const typeStr = inspect(type);
    throw new Error(
      `Introspection must provide input type for arguments, but received: ${typeStr}.`,
    );
  }

  function getOutputType(
    typeRef: IntrospectionOutputTypeRef,
  ): GraphQLOutputType {
    const type = getType(typeRef);
    if (isOutputType(type)) {
      return type;
    }
    const typeStr = inspect(type);
    throw new Error(
      `Introspection must provide output type for fields, but received: ${typeStr}.`,
    );
  }

  function getObjectType(
    typeRef: IntrospectionNamedTypeRef<IntrospectionObjectType>,
  ): GraphQLObjectType {
    const type = getType(typeRef);
    return assertObjectType(type);
  }

  function getInterfaceType(
    typeRef: IntrospectionTypeRef,
  ): GraphQLInterfaceType {
    const type = getType(typeRef);
    return assertInterfaceType(type);
  }

  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function buildType(type: IntrospectionType): GraphQLNamedType {
    if (type && type.name && type.kind) {
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
      }
    }
    const typeStr = inspect(type);
    throw new Error(
      `Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: ${typeStr}.`,
    );
  }

  function buildScalarDef(
    scalarIntrospection: IntrospectionScalarType,
  ): GraphQLScalarType {
    return new GraphQLScalarType({
      name: scalarIntrospection.name,
      description: scalarIntrospection.description,
    });
  }

  function buildObjectDef(
    objectIntrospection: IntrospectionObjectType,
  ): GraphQLObjectType {
    if (!objectIntrospection.interfaces) {
      const objectIntrospectionStr = inspect(objectIntrospection);
      throw new Error(
        `Introspection result missing interfaces: ${objectIntrospectionStr}.`,
      );
    }
    return new GraphQLObjectType({
      name: objectIntrospection.name,
      description: objectIntrospection.description,
      interfaces: () => objectIntrospection.interfaces.map(getInterfaceType),
      fields: () => buildFieldDefMap(objectIntrospection),
    });
  }

  function buildInterfaceDef(
    interfaceIntrospection: IntrospectionInterfaceType,
  ): GraphQLInterfaceType {
    return new GraphQLInterfaceType({
      name: interfaceIntrospection.name,
      description: interfaceIntrospection.description,
      fields: () => buildFieldDefMap(interfaceIntrospection),
    });
  }

  function buildUnionDef(
    unionIntrospection: IntrospectionUnionType,
  ): GraphQLUnionType {
    if (!unionIntrospection.possibleTypes) {
      const unionIntrospectionStr = inspect(unionIntrospection);
      throw new Error(
        `Introspection result missing possibleTypes: ${unionIntrospectionStr}.`,
      );
    }
    return new GraphQLUnionType({
      name: unionIntrospection.name,
      description: unionIntrospection.description,
      types: () => unionIntrospection.possibleTypes.map(getObjectType),
    });
  }

  function buildEnumDef(
    enumIntrospection: IntrospectionEnumType,
  ): GraphQLEnumType {
    if (!enumIntrospection.enumValues) {
      const enumIntrospectionStr = inspect(enumIntrospection);
      throw new Error(
        `Introspection result missing enumValues: ${enumIntrospectionStr}.`,
      );
    }
    return new GraphQLEnumType({
      name: enumIntrospection.name,
      description: enumIntrospection.description,
      values: keyValMap(
        enumIntrospection.enumValues,
        valueIntrospection => valueIntrospection.name,
        valueIntrospection => ({
          description: valueIntrospection.description,
          deprecationReason: valueIntrospection.deprecationReason,
        }),
      ),
    });
  }

  function buildInputObjectDef(
    inputObjectIntrospection: IntrospectionInputObjectType,
  ): GraphQLInputObjectType {
    if (!inputObjectIntrospection.inputFields) {
      const inputObjectIntrospectionStr = inspect(inputObjectIntrospection);
      throw new Error(
        `Introspection result missing inputFields: ${inputObjectIntrospectionStr}.`,
      );
    }
    return new GraphQLInputObjectType({
      name: inputObjectIntrospection.name,
      description: inputObjectIntrospection.description,
      fields: () => buildInputValueDefMap(inputObjectIntrospection.inputFields),
    });
  }

  function buildFieldDefMap(typeIntrospection) {
    if (!typeIntrospection.fields) {
      throw new Error(
        `Introspection result missing fields: ${inspect(typeIntrospection)}.`,
      );
    }
    return keyValMap(
      typeIntrospection.fields,
      fieldIntrospection => fieldIntrospection.name,
      fieldIntrospection => {
        if (!fieldIntrospection.args) {
          const fieldIntrospectionStr = inspect(fieldIntrospection);
          throw new Error(
            `Introspection result missing field args: ${fieldIntrospectionStr}.`,
          );
        }
        return {
          description: fieldIntrospection.description,
          deprecationReason: fieldIntrospection.deprecationReason,
          type: getOutputType(fieldIntrospection.type),
          args: buildInputValueDefMap(fieldIntrospection.args),
        };
      },
    );
  }

  function buildInputValueDefMap(inputValueIntrospections) {
    return keyValMap(
      inputValueIntrospections,
      inputValue => inputValue.name,
      buildInputValue,
    );
  }

  function buildInputValue(inputValueIntrospection) {
    const type = getInputType(inputValueIntrospection.type);
    const defaultValue =
      inputValueIntrospection.defaultValue != null
        ? valueFromAST(parseValue(inputValueIntrospection.defaultValue), type)
        : undefined;
    return {
      description: inputValueIntrospection.description,
      type,
      defaultValue,
    };
  }

  function buildDirective(directiveIntrospection) {
    const directiveIntrospectionStr = inspect(directiveIntrospection);
    if (!directiveIntrospection.args) {
      throw new Error(
        `Introspection result missing directive args: ${directiveIntrospectionStr}.`,
      );
    }
    if (!directiveIntrospection.locations) {
      throw new Error(
        `Introspection result missing directive locations: ${directiveIntrospectionStr}.`,
      );
    }
    return new GraphQLDirective({
      name: directiveIntrospection.name,
      description: directiveIntrospection.description,
      locations: directiveIntrospection.locations.slice(),
      args: buildInputValueDefMap(directiveIntrospection.args),
    });
  }
}
