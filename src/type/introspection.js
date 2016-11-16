/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import isInvalid from '../jsutils/isInvalid';
import { astFromValue } from '../utilities/astFromValue';
import { print } from '../language/printer';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from './definition';
import { GraphQLString, GraphQLBoolean } from './scalars';
import { DirectiveLocation } from './directives';
import type { GraphQLField } from './definition';


export const __Schema = new GraphQLObjectType({
  name: '__Schema',
  description:
    'A GraphQL Schema defines the capabilities of a GraphQL server. It ' +
    'exposes all available types and directives on the server, as well as ' +
    'the entry points for query, mutation, and subscription operations.',
  fields: () => ({
    types: {
      description: 'A list of all types supported by this server.',
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__Type))),
      resolve(schema) {
        const typeMap = schema.getTypeMap();
        return Object.keys(typeMap).map(key => typeMap[key]);
      }
    },
    queryType: {
      description: 'The type that query operations will be rooted at.',
      type: new GraphQLNonNull(__Type),
      resolve: schema => schema.getQueryType()
    },
    mutationType: {
      description: 'If this server supports mutation, the type that ' +
                   'mutation operations will be rooted at.',
      type: __Type,
      resolve: schema => schema.getMutationType()
    },
    subscriptionType: {
      description: 'If this server support subscription, the type that ' +
                   'subscription operations will be rooted at.',
      type: __Type,
      resolve: schema => schema.getSubscriptionType()
    },
    directives: {
      description: 'A list of all directives supported by this server.',
      type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__Directive))),
      resolve: schema => schema.getDirectives(),
    }
  })
});

export const __Directive = new GraphQLObjectType({
  name: '__Directive',
  description:
    'A Directive provides a way to describe alternate runtime execution and ' +
    'type validation behavior in a GraphQL document.' +
    '\n\nIn some cases, you need to provide options to alter GraphQL\'s ' +
    'execution behavior in ways field arguments will not suffice, such as ' +
    'conditionally including or skipping a field. Directives provide this by ' +
    'describing additional information to the executor.',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    locations: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(
        __DirectiveLocation
      )))
    },
    args: {
      type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__InputValue))),
      resolve: directive => directive.args || []
    },
    // NOTE: the following three fields are deprecated and are no longer part
    // of the GraphQL specification.
    onOperation: {
      deprecationReason: 'Use `locations`.',
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: d =>
        d.locations.indexOf(DirectiveLocation.QUERY) !== -1 ||
        d.locations.indexOf(DirectiveLocation.MUTATION) !== -1 ||
        d.locations.indexOf(DirectiveLocation.SUBSCRIPTION) !== -1
    },
    onFragment: {
      deprecationReason: 'Use `locations`.',
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: d =>
        d.locations.indexOf(DirectiveLocation.FRAGMENT_SPREAD) !== -1 ||
        d.locations.indexOf(DirectiveLocation.INLINE_FRAGMENT) !== -1 ||
        d.locations.indexOf(DirectiveLocation.FRAGMENT_DEFINITION) !== -1
    },
    onField: {
      deprecationReason: 'Use `locations`.',
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: d => d.locations.indexOf(DirectiveLocation.FIELD) !== -1
    },
  }),
});

export const __DirectiveLocation = new GraphQLEnumType({
  name: '__DirectiveLocation',
  description:
    'A Directive can be adjacent to many parts of the GraphQL language, a ' +
    '__DirectiveLocation describes one such possible adjacencies.',
  values: {
    QUERY: {
      value: DirectiveLocation.QUERY,
      description: 'Location adjacent to a query operation.'
    },
    MUTATION: {
      value: DirectiveLocation.MUTATION,
      description: 'Location adjacent to a mutation operation.'
    },
    SUBSCRIPTION: {
      value: DirectiveLocation.SUBSCRIPTION,
      description: 'Location adjacent to a subscription operation.'
    },
    FIELD: {
      value: DirectiveLocation.FIELD,
      description: 'Location adjacent to a field.'
    },
    FRAGMENT_DEFINITION: {
      value: DirectiveLocation.FRAGMENT_DEFINITION,
      description: 'Location adjacent to a fragment definition.'
    },
    FRAGMENT_SPREAD: {
      value: DirectiveLocation.FRAGMENT_SPREAD,
      description: 'Location adjacent to a fragment spread.'
    },
    INLINE_FRAGMENT: {
      value: DirectiveLocation.INLINE_FRAGMENT,
      description: 'Location adjacent to an inline fragment.'
    },
    SCHEMA: {
      value: DirectiveLocation.SCHEMA,
      description: 'Location adjacent to a schema definition.'
    },
    SCALAR: {
      value: DirectiveLocation.SCALAR,
      description: 'Location adjacent to a scalar definition.'
    },
    OBJECT: {
      value: DirectiveLocation.OBJECT,
      description: 'Location adjacent to an object type definition.'
    },
    FIELD_DEFINITION: {
      value: DirectiveLocation.FIELD_DEFINITION,
      description: 'Location adjacent to a field definition.'
    },
    ARGUMENT_DEFINITION: {
      value: DirectiveLocation.ARGUMENT_DEFINITION,
      description: 'Location adjacent to an argument definition.'
    },
    INTERFACE: {
      value: DirectiveLocation.INTERFACE,
      description: 'Location adjacent to an interface definition.'
    },
    UNION: {
      value: DirectiveLocation.UNION,
      description: 'Location adjacent to a union definition.'
    },
    ENUM: {
      value: DirectiveLocation.ENUM,
      description: 'Location adjacent to an enum definition.'
    },
    ENUM_VALUE: {
      value: DirectiveLocation.ENUM_VALUE,
      description: 'Location adjacent to an enum value definition.'
    },
    INPUT_OBJECT: {
      value: DirectiveLocation.INPUT_OBJECT,
      description: 'Location adjacent to an input object type definition.'
    },
    INPUT_FIELD_DEFINITION: {
      value: DirectiveLocation.INPUT_FIELD_DEFINITION,
      description: 'Location adjacent to an input object field definition.'
    },
  }
});

export const __Type = new GraphQLObjectType({
  name: '__Type',
  description:
    'The fundamental unit of any GraphQL Schema is the type. There are ' +
    'many kinds of types in GraphQL as represented by the `__TypeKind` enum.' +
    '\n\nDepending on the kind of a type, certain fields describe ' +
    'information about that type. Scalar types provide no information ' +
    'beyond a name and description, while Enum types provide their values. ' +
    'Object and Interface types provide the fields they describe. Abstract ' +
    'types, Union and Interface, provide the Object types possible ' +
    'at runtime. List and NonNull types compose other types.',
  fields: () => ({
    kind: {
      type: new GraphQLNonNull(__TypeKind),
      resolve(type) {
        if (type instanceof GraphQLScalarType) {
          return TypeKind.SCALAR;
        } else if (type instanceof GraphQLObjectType) {
          return TypeKind.OBJECT;
        } else if (type instanceof GraphQLInterfaceType) {
          return TypeKind.INTERFACE;
        } else if (type instanceof GraphQLUnionType) {
          return TypeKind.UNION;
        } else if (type instanceof GraphQLEnumType) {
          return TypeKind.ENUM;
        } else if (type instanceof GraphQLInputObjectType) {
          return TypeKind.INPUT_OBJECT;
        } else if (type instanceof GraphQLList) {
          return TypeKind.LIST;
        } else if (type instanceof GraphQLNonNull) {
          return TypeKind.NON_NULL;
        }
        throw new Error('Unknown kind of type: ' + type);
      }
    },
    name: { type: GraphQLString },
    description: { type: GraphQLString },
    fields: {
      type: new GraphQLList(new GraphQLNonNull(__Field)),
      args: {
        includeDeprecated: { type: GraphQLBoolean, defaultValue: false }
      },
      resolve(type, { includeDeprecated }) {
        if (type instanceof GraphQLObjectType ||
            type instanceof GraphQLInterfaceType) {
          const fieldMap = type.getFields();
          let fields =
            Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
          if (!includeDeprecated) {
            fields = fields.filter(field => !field.deprecationReason);
          }
          return fields;
        }
        return null;
      }
    },
    interfaces: {
      type: new GraphQLList(new GraphQLNonNull(__Type)),
      resolve(type) {
        if (type instanceof GraphQLObjectType) {
          return type.getInterfaces();
        }
      }
    },
    possibleTypes: {
      type: new GraphQLList(new GraphQLNonNull(__Type)),
      resolve(type, args, context, { schema }) {
        if (type instanceof GraphQLInterfaceType ||
            type instanceof GraphQLUnionType) {
          return schema.getPossibleTypes(type);
        }
      }
    },
    enumValues: {
      type: new GraphQLList(new GraphQLNonNull(__EnumValue)),
      args: {
        includeDeprecated: { type: GraphQLBoolean, defaultValue: false }
      },
      resolve(type, { includeDeprecated }) {
        if (type instanceof GraphQLEnumType) {
          let values = type.getValues();
          if (!includeDeprecated) {
            values = values.filter(value => !value.deprecationReason);
          }
          return values;
        }
      }
    },
    inputFields: {
      type: new GraphQLList(new GraphQLNonNull(__InputValue)),
      resolve(type) {
        if (type instanceof GraphQLInputObjectType) {
          const fieldMap = type.getFields();
          return Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
        }
      }
    },
    ofType: { type: __Type }
  })
});

export const __Field = new GraphQLObjectType({
  name: '__Field',
  description:
    'Object and Interface types are described by a list of Fields, each of ' +
    'which has a name, potentially a list of arguments, and a return type.',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    args: {
      type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__InputValue))),
      resolve: field => field.args || []
    },
    type: { type: new GraphQLNonNull(__Type) },
    isDeprecated: { type: new GraphQLNonNull(GraphQLBoolean) },
    deprecationReason: {
      type: GraphQLString,
    }
  })
});

export const __InputValue = new GraphQLObjectType({
  name: '__InputValue',
  description:
    'Arguments provided to Fields or Directives and the input fields of an ' +
    'InputObject are represented as Input Values which describe their type ' +
    'and optionally a default value.',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    type: { type: new GraphQLNonNull(__Type) },
    defaultValue: {
      type: GraphQLString,
      description:
        'A GraphQL-formatted string representing the default value for this ' +
        'input value.',
      resolve: inputVal => isInvalid(inputVal.defaultValue) ?
        null :
        print(astFromValue(inputVal.defaultValue, inputVal.type))
    }
  })
});

export const __EnumValue = new GraphQLObjectType({
  name: '__EnumValue',
  description:
    'One possible value for a given Enum. Enum values are unique values, not ' +
    'a placeholder for a string or numeric value. However an Enum value is ' +
    'returned in a JSON response as a string.',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    isDeprecated: { type: new GraphQLNonNull(GraphQLBoolean) },
    deprecationReason: {
      type: GraphQLString,
    }
  })
});

export const TypeKind = {
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  INPUT_OBJECT: 'INPUT_OBJECT',
  LIST: 'LIST',
  NON_NULL: 'NON_NULL',
};

export const __TypeKind = new GraphQLEnumType({
  name: '__TypeKind',
  description: 'An enum describing what kind of type a given `__Type` is.',
  values: {
    SCALAR: {
      value: TypeKind.SCALAR,
      description: 'Indicates this type is a scalar.'
    },
    OBJECT: {
      value: TypeKind.OBJECT,
      description: 'Indicates this type is an object. ' +
                   '`fields` and `interfaces` are valid fields.'
    },
    INTERFACE: {
      value: TypeKind.INTERFACE,
      description: 'Indicates this type is an interface. ' +
                   '`fields` and `possibleTypes` are valid fields.'
    },
    UNION: {
      value: TypeKind.UNION,
      description: 'Indicates this type is a union. ' +
                   '`possibleTypes` is a valid field.'
    },
    ENUM: {
      value: TypeKind.ENUM,
      description: 'Indicates this type is an enum. ' +
                   '`enumValues` is a valid field.'
    },
    INPUT_OBJECT: {
      value: TypeKind.INPUT_OBJECT,
      description: 'Indicates this type is an input object. ' +
                   '`inputFields` is a valid field.'
    },
    LIST: {
      value: TypeKind.LIST,
      description: 'Indicates this type is a list. ' +
                   '`ofType` is a valid field.'
    },
    NON_NULL: {
      value: TypeKind.NON_NULL,
      description: 'Indicates this type is a non-null. ' +
                   '`ofType` is a valid field.'
    },
  }
});

/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */

export const SchemaMetaFieldDef: GraphQLField<*, *> = {
  name: '__schema',
  type: new GraphQLNonNull(__Schema),
  description: 'Access the current type schema of this server.',
  args: [],
  resolve: (source, args, context, { schema }) => schema
};

export const TypeMetaFieldDef: GraphQLField<*, *> = {
  name: '__type',
  type: __Type,
  description: 'Request the type information of a single type.',
  args: [
    { name: 'name', type: new GraphQLNonNull(GraphQLString) }
  ],
  resolve: (source, { name }, context, { schema }) =>
    schema.getType(name)
};

export const TypeNameMetaFieldDef: GraphQLField<*, *> = {
  name: '__typename',
  type: new GraphQLNonNull(GraphQLString),
  description: 'The name of the current Object type at runtime.',
  args: [],
  resolve: (source, args, context, { parentType }) => parentType.name
};
