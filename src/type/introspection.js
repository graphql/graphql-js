/* @flow weak */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import isNullish from '../jsutils/isNullish';
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
import type { GraphQLFieldDefinition } from './definition';


export var __Schema = new GraphQLObjectType({
  name: '__Schema',
  description: 'A GraphQL Schema defines the capabilities of a GraphQL ' +
               'server. It exposes all available types and directives on ' +
               'the server, as well as the entry points for query and ' +
               'mutation operations.',
  fields: () => ({
    types: {
      description: 'A list of all types supported by this server.',
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__Type))),
      resolve(schema) {
        var typeMap = schema.getTypeMap();
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
    directives: {
      description: 'A list of all directives supported by this server.',
      type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__Directive))),
      resolve: schema => schema.getDirectives(),
    }
  })
});

var __Directive = new GraphQLObjectType({
  name: '__Directive',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    args: {
      type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__InputValue))),
      resolve: directive => directive.args || []
    },
    onOperation: { type: new GraphQLNonNull(GraphQLBoolean) },
    onFragment: { type: new GraphQLNonNull(GraphQLBoolean) },
    onField: { type: new GraphQLNonNull(GraphQLBoolean) },
  }),
});

var __Type = new GraphQLObjectType({
  name: '__Type',
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
          var fieldMap = type.getFields();
          var fields =
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
      resolve(type) {
        if (type instanceof GraphQLInterfaceType ||
            type instanceof GraphQLUnionType) {
          return type.getPossibleTypes();
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
          var valueMap = type.getValues();
          var values =
            Object.keys(valueMap).map(valueName => valueMap[valueName]);
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
          var fieldMap = type.getFields();
          return Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
        }
      }
    },
    ofType: { type: __Type }
  })
});

var __Field = new GraphQLObjectType({
  name: '__Field',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    args: {
      type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__InputValue))),
      resolve: field => field.args || []
    },
    type: { type: new GraphQLNonNull(__Type) },
    isDeprecated: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: field => !isNullish(field.deprecationReason),
    },
    deprecationReason: {
      type: GraphQLString,
    }
  })
});

var __InputValue = new GraphQLObjectType({
  name: '__InputValue',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    type: { type: new GraphQLNonNull(__Type) },
    defaultValue: {
      type: GraphQLString,
      resolve: inputVal => inputVal.defaultValue == null ?
        null :
        print(astFromValue(inputVal.defaultValue, inputVal))
    }
  })
});

var __EnumValue = new GraphQLObjectType({
  name: '__EnumValue',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    isDeprecated: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: enumValue => !isNullish(enumValue.deprecationReason),
    },
    deprecationReason: {
      type: GraphQLString,
    }
  }
});

export var TypeKind = {
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  INPUT_OBJECT: 'INPUT_OBJECT',
  LIST: 'LIST',
  NON_NULL: 'NON_NULL',
};

var __TypeKind = new GraphQLEnumType({
  name: '__TypeKind',
  description: 'An enum describing what kind of type a given __Type is',
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
 * Note that these are GraphQLFieldDefinition and not GraphQLFieldConfig,
 * so the format for args is different.
 */

export var SchemaMetaFieldDef: GraphQLFieldDefinition = {
  name: '__schema',
  type: new GraphQLNonNull(__Schema),
  description: 'Access the current type schema of this server.',
  args: [],
  resolve: (
    source,
    args,
    root,
    fieldAST,
    fieldType,
    parentType,
    schema
  ) => schema
};

export var TypeMetaFieldDef: GraphQLFieldDefinition = {
  name: '__type',
  type: __Type,
  description: 'Request the type information of a single type.',
  args: [
    { name: 'name', type: new GraphQLNonNull(GraphQLString) }
  ],
  resolve: (
    source,
    { name },
    root,
    fieldAST,
    fieldType,
    parentType,
    schema
  ) => schema.getType(name)
};

export var TypeNameMetaFieldDef: GraphQLFieldDefinition = {
  name: '__typename',
  type: new GraphQLNonNull(GraphQLString),
  description: 'The name of the current Object type at runtime.',
  args: [],
  resolve: (
    source,
    args,
    root,
    fieldAST,
    fieldType,
    parentType
  ) => parentType.name
};
