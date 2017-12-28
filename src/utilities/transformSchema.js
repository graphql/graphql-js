/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ObjMap } from '../jsutils/ObjMap';
import keyValMap from '../jsutils/keyValMap';
import objectValues from '../jsutils/objectValues';
import invariant from '../jsutils/invariant';
import type { GraphQLSchemaConfig } from '../type/schema';
import { GraphQLSchema } from '../type/schema';
import { isSpecifiedScalarType } from '../type/scalars';
import { isIntrospectionType } from '../type/introspection';
import type { GraphQLDirectiveConfig } from '../type/directives';
import { GraphQLDirective } from '../type/directives';
import { GraphQLList, GraphQLNonNull } from '../type/wrappers';
import type {
  GraphQLNamedType,
  GraphQLScalarTypeConfig,
  GraphQLObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLUnionTypeConfig,
  GraphQLEnumTypeConfig,
  GraphQLInputObjectTypeConfig,
} from '../type/definition';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
} from '../type/definition';

type ExactSchemaConfig = $Exact<GraphQLSchemaConfig> & {
  types: Array<*>,
  directives: Array<*>,
};

type ExactDirectiveConfig = $Exact<GraphQLDirectiveConfig> & {
  args: ObjMap<*>,
};

type ExactScalarTypeConfig = $Exact<GraphQLScalarTypeConfig<*, *>>;

type ExactObjectTypeConfig = $Exact<GraphQLObjectTypeConfig<*, *>> & {
  fields: () => ObjMap<*>,
  interfaces: () => Array<*>,
  extensionASTNodes: $ReadOnlyArray<*>,
};

type ExactInterfaceTypeConfig = $Exact<GraphQLInterfaceTypeConfig<*, *>> & {
  fields: () => ObjMap<*>,
  extensionASTNodes: $ReadOnlyArray<*>,
};

type ExactUnionTypeConfig = $Exact<GraphQLUnionTypeConfig<*, *>> & {
  types: () => Array<*>,
};

type ExactEnumTypeConfig = $Exact<GraphQLEnumTypeConfig>;

type ExactInputObjectTypeConfig = $Exact<GraphQLInputObjectTypeConfig> & {
  fields: () => ObjMap<*>,
};

type TypeTransformer = {
  Schema?: (config: ExactSchemaConfig) => GraphQLSchema,
  Directive?: (config: ExactDirectiveConfig) => GraphQLDirective,
  ScalarType?: (config: ExactScalarTypeConfig) => GraphQLScalarType,
  ObjectType?: (config: ExactObjectTypeConfig) => GraphQLObjectType,
  InterfaceType?: (config: ExactInterfaceTypeConfig) => GraphQLInterfaceType,
  UnionType?: (config: ExactUnionTypeConfig) => GraphQLUnionType,
  EnumType?: (config: ExactEnumTypeConfig) => GraphQLEnumType,
  InputObjectType?: (
    config: ExactInputObjectTypeConfig,
  ) => GraphQLInputObjectType,
};

export function transformSchema(
  schema: GraphQLSchema,
  transformer: TypeTransformer,
): GraphQLSchema {
  const cache: ObjMap<GraphQLNamedType> = Object.create(null);
  const transformMaybeType = maybeType =>
    maybeType && transformNamedType(maybeType);
  const schemaConfig = {
    types: objectValues(schema.getTypeMap()).map(transformNamedType),
    directives: schema.getDirectives().map(transformDirective),
    query: transformMaybeType(schema.getQueryType()),
    mutation: transformMaybeType(schema.getMutationType()),
    subscription: transformMaybeType(schema.getSubscriptionType()),
    astNode: schema.astNode,
  };
  return transformer.Schema
    ? transformer.Schema(schemaConfig)
    : new GraphQLSchema(schemaConfig);

  function transformDirective(directive) {
    const config = {
      name: directive.name,
      description: directive.description,
      locations: directive.locations,
      args: transformArgs(directive.args),
      astNode: directive.astNode,
    };
    return transformer.Directive
      ? transformer.Directive(config)
      : new GraphQLDirective(config);
  }

  function transformArgs(args) {
    return keyValMap(
      args,
      arg => arg.name,
      arg => ({
        ...arg,
        type: transformType(arg.type),
      }),
    );
  }

  function transformFields(fieldsMap) {
    return () =>
      mapValues(fieldsMap, field => ({
        type: transformType(field.type),
        args: transformArgs(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        description: field.description,
        astNode: field.astNode,
      }));
  }

  function transformInputFields(fieldsMap) {
    return () =>
      mapValues(fieldsMap, field => ({
        type: transformType(field.type),
        defaultValue: field.defaultValue,
        description: field.description,
        astNode: field.astNode,
      }));
  }

  function transformType(type) {
    if (isListType(type)) {
      return new GraphQLList(transformType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(transformType(type.ofType));
    }
    return transformNamedType(type);
  }

  function transformTypes<T: GraphQLNamedType>(arr: Array<T>): () => Array<T> {
    return () => arr.map(transformNamedType);
  }

  function transformNamedType<T: GraphQLNamedType>(type: T): T {
    if (isSpecifiedScalarType(type) || isIntrospectionType(type)) {
      return type;
    }

    let newType = cache[type.name];
    if (!newType) {
      newType = transformNamedTypeImpl(type);
      cache[type.name] = newType;
    }
    invariant(type.constructor === newType.constructor);
    invariant(type.name === newType.name);
    return ((newType: any): T);
  }

  function transformNamedTypeImpl(type) {
    if (isScalarType(type)) {
      const config = {
        name: type.name,
        description: type.description,
        astNode: type.astNode,
        serialize: type._scalarConfig.serialize,
        parseValue: type._scalarConfig.parseValue,
        parseLiteral: type._scalarConfig.parseLiteral,
      };
      return transformer.ScalarType
        ? transformer.ScalarType(config)
        : new GraphQLScalarType(config);
    } else if (isObjectType(type)) {
      const config = {
        name: type.name,
        interfaces: transformTypes(type.getInterfaces()),
        fields: transformFields(type.getFields()),
        isTypeOf: type.isTypeOf,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes || [],
      };
      return transformer.ObjectType
        ? transformer.ObjectType(config)
        : new GraphQLObjectType(config);
    } else if (isInterfaceType(type)) {
      const config = {
        name: type.name,
        fields: transformFields(type.getFields()),
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes || [],
      };
      return transformer.InterfaceType
        ? transformer.InterfaceType(config)
        : new GraphQLInterfaceType(config);
    } else if (isUnionType(type)) {
      const config = {
        name: type.name,
        types: transformTypes(type.getTypes()),
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
      };
      return transformer.UnionType
        ? transformer.UnionType(config)
        : new GraphQLUnionType(config);
    } else if (isEnumType(type)) {
      const config = {
        name: type.name,
        values: keyValMap(
          type.getValues(),
          val => val.name,
          val => ({
            value: val.value,
            deprecationReason: val.deprecationReason,
            description: val.description,
            astNode: val.astNode,
          }),
        ),
        description: type.description,
        astNode: type.astNode,
      };
      return transformer.EnumType
        ? transformer.EnumType(config)
        : new GraphQLEnumType(config);
    } else if (isInputObjectType(type)) {
      const config = {
        name: type.name,
        fields: transformInputFields(type.getFields()),
        description: type.description,
        astNode: type.astNode,
      };
      return transformer.InputObjectType
        ? transformer.InputObjectType(config)
        : new GraphQLInputObjectType(config);
    }
    throw new Error(`Unknown type: "${type}"`);
  }
}

function mapValues<T, R>(obj: ObjMap<T>, valFn: T => R): ObjMap<R> {
  const newObj = Object.create(null);
  for (const name of Object.keys(obj)) {
    newObj[name] = valFn(obj[name]);
  }
  return newObj;
}
