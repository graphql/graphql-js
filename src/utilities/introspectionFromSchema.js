/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

'use strict';

import { print } from '../language/printer';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../type/definition';
import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLNamedType,
  GraphQLType,
  GraphQLOutputType,
} from '../type/definition';
import { GraphQLDirective } from '../type/directives';
import { TypeKind } from '../type/introspection';
import type { GraphQLSchema } from '../type/schema';
import { astFromValue } from './astFromValue';
import type {
  IntrospectionDirective,
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionNamedTypeRef,
  IntrospectionSchema,
  IntrospectionType,
  IntrospectionInputType,
  IntrospectionOutputType,
  IntrospectionInputTypeRef,
  IntrospectionOutputTypeRef,
} from './introspectionQuery';

import invariant from 'invariant';

/**
 * Build an IntrospectionSchema from a GraphQLSchema
 *
 * IntrospectionSchema is useful for utilities that care about type and field
 * relationships, but do not need to traverse through those relationships.
 *
 * This is the inverse of buildClientSchema. The primary use case is outside
 * of the server context, for instance when doing schema comparisons.
 *
 * This is a synchronous equivalent of:
 *  const {__schema} = await graphql(schema, introspectionQuery);
 */
export function introspectionFromSchema(
  schema: GraphQLSchema,
): IntrospectionSchema {
  function getType(type: GraphQLType): IntrospectionType {
    if (type instanceof GraphQLObjectType) {
      const fieldMap = type.getFields();
      return {
        kind: TypeKind.OBJECT,
        name: type.name,
        description: type.description || null,
        fields: Object.keys(fieldMap)
          .map(k => fieldMap[k])
          .map(getField),
        interfaces: type.getInterfaces().map(iface => {
          return { kind: TypeKind.INTERFACE, name: iface.name };
        }),
      };
    } else if (type instanceof GraphQLInterfaceType) {
      const fieldMap = type.getFields();
      return {
        kind: TypeKind.INTERFACE,
        name: type.name,
        description: type.description || null,
        fields: Object.keys(fieldMap)
          .map(k => fieldMap[k])
          .map(getField),
        possibleTypes: schema
          .getPossibleTypes(type)
          .map(possibleType => objectTypeRef(possibleType.name)),
      };
    } else if (type instanceof GraphQLUnionType) {
      return {
        kind: TypeKind.UNION,
        name: type.name,
        description: type.description || null,
        possibleTypes: schema
          .getPossibleTypes(type)
          .map(possibleType => objectTypeRef(possibleType.name)),
      };
    } else if (type instanceof GraphQLScalarType) {
      return {
        kind: TypeKind.SCALAR,
        name: type.name,
        description: type.description || null,
      };
    } else if (type instanceof GraphQLEnumType) {
      return {
        kind: TypeKind.ENUM,
        name: type.name,
        description: type.description || null,
        enumValues: type.getValues().map(enumValue => {
          return {
            name: enumValue.name,
            description: enumValue.description || null,
            isDeprecated:
              enumValue.isDeprecated !== undefined && enumValue.isDeprecated,
            deprecationReason: enumValue.deprecationReason || null,
          };
        }),
      };
    } else if (type instanceof GraphQLInputObjectType) {
      const fieldMap = type.getFields();
      return {
        kind: TypeKind.INPUT_OBJECT,
        name: type.name,
        description: type.description || null,
        inputFields: Object.keys(fieldMap)
          .map(k => fieldMap[k])
          .map(getInputValue),
      };
    }
    throw new Error(`No known type for ${type.toString()}`);
  }

  function getDirective(directive: GraphQLDirective): IntrospectionDirective {
    return {
      name: directive.name,
      description: directive.description || null,
      locations: directive.locations,
      args: directive.args.map(getInputValue),
    };
  }

  function getField(field: GraphQLField<*, *>): IntrospectionField {
    return {
      name: field.name,
      description: field.description || null,
      args: field.args.map(getInputValue),
      type: outputTypeRef(field.type),
      isDeprecated: field.isDeprecated !== undefined && field.isDeprecated,
      deprecationReason: field.deprecationReason || null,
    };
  }

  function getInputValue(argument: GraphQLArgument): IntrospectionInputValue {
    let defaultValue = null;
    const argDefault = argument.defaultValue;
    if (argDefault !== undefined) {
      defaultValue = print(astFromValue(argDefault, argument.type));
    }

    return {
      name: argument.name,
      description: argument.description || null,
      type: inputTypeRef(argument.type),
      defaultValue,
    };
  }

  const mutation = schema.getMutationType();
  const subscription = schema.getSubscriptionType();

  const typeMap = schema.getTypeMap();
  return {
    queryType: objectTypeRef(schema.getQueryType().name),
    mutationType: mutation ? objectTypeRef(mutation.name) : null,
    subscriptionType: subscription ? objectTypeRef(subscription.name) : null,
    directives: schema.getDirectives().map(getDirective),
    types: Object.keys(typeMap)
      .map(k => typeMap[k])
      .map(getType),
  };
}

function outputTypeRef(type: GraphQLOutputType): IntrospectionOutputTypeRef {
  if (type instanceof GraphQLList) {
    return { kind: TypeKind.LIST, ofType: outputTypeRef(type.ofType) };
  }
  if (type instanceof GraphQLNonNull) {
    const childTypeRef = outputTypeRef(type.ofType);
    invariant(
      childTypeRef.kind !== TypeKind.NON_NULL,
      'Found a NonNull type of a NonNull',
    );
    return { kind: TypeKind.NON_NULL, ofType: childTypeRef };
  }
  const namedRef: IntrospectionNamedTypeRef<IntrospectionOutputType> = {
    kind: introspectionOutputKind(type),
    name: type.name,
  };
  return namedRef;
}

function inputTypeRef(type: GraphQLType): IntrospectionInputTypeRef {
  if (type instanceof GraphQLList) {
    return { kind: TypeKind.LIST, ofType: inputTypeRef(type.ofType) };
  }
  if (type instanceof GraphQLNonNull) {
    const childTypeRef = inputTypeRef(type.ofType);
    invariant(
      childTypeRef.kind !== TypeKind.NON_NULL,
      `Found a NonNull type of a NonNull: ${type.toString()}`,
    );
    return { kind: TypeKind.NON_NULL, ofType: childTypeRef };
  }
  const namedRef: IntrospectionNamedTypeRef<IntrospectionInputType> = {
    kind: introspectionInputKind(type),
    name: type.name,
  };
  return namedRef;
}

function objectTypeRef(name: string) {
  return { kind: TypeKind.OBJECT, name };
}

function introspectionOutputKind(type: GraphQLNamedType) {
  if (type instanceof GraphQLObjectType) {
    return TypeKind.OBJECT;
  } else if (type instanceof GraphQLInterfaceType) {
    return TypeKind.INTERFACE;
  } else if (type instanceof GraphQLUnionType) {
    return TypeKind.UNION;
  } else if (type instanceof GraphQLScalarType) {
    return TypeKind.SCALAR;
  } else if (type instanceof GraphQLEnumType) {
    return TypeKind.ENUM;
  }
  throw new Error(`No known output type for ${type.toString()}`);
}

function introspectionInputKind(type: GraphQLNamedType) {
  if (type instanceof GraphQLScalarType) {
    return TypeKind.SCALAR;
  } else if (type instanceof GraphQLEnumType) {
    return TypeKind.ENUM;
  } else if (type instanceof GraphQLInputObjectType) {
    return TypeKind.INPUT_OBJECT;
  }
  throw new Error(`No known type for ${type.toString()}`);
}
