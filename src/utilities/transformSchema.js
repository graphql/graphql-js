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
  allowedLegacyNames: Array<*>,
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

/**
 * Note: This class is not a part of public API and is a subject to changes
 * in the future.
 */
export class SchemaTransformer {
  _schema: GraphQLSchema;
  _transformer: TypeTransformer;
  _cache: ObjMap<GraphQLNamedType>;

  constructor(schema: GraphQLSchema, transformer: TypeTransformer) {
    this._schema = schema;
    this._transformer = transformer;
    this._cache = Object.create(null);
  }

  transformSchema(): GraphQLSchema {
    const oldTypes = objectValues(this._schema.getTypeMap());
    const oldDirectives = this._schema.getDirectives();
    const transformMaybeType = maybeType =>
      maybeType && this._transformNamedType(maybeType);
    const schemaConfig = {
      types: oldTypes.map(type => this._transformNamedType(type)),
      directives: oldDirectives.map(directive =>
        this._transformDirective(directive),
      ),
      query: transformMaybeType(this._schema.getQueryType()),
      mutation: transformMaybeType(this._schema.getMutationType()),
      subscription: transformMaybeType(this._schema.getSubscriptionType()),
      astNode: this._schema.astNode,
      allowedLegacyNames: (this._schema.__allowedLegacyNames || []).slice(),
    };
    return this._transformer.Schema
      ? this._transformer.Schema(schemaConfig)
      : new GraphQLSchema(schemaConfig);
  }

  transformType(name: string): ?GraphQLNamedType {
    const type = this._schema.getTypeMap()[name];
    return type && this._transformNamedType(type);
  }

  _transformDirective(directive: GraphQLDirective): GraphQLDirective {
    const config = {
      name: directive.name,
      description: directive.description,
      locations: directive.locations,
      args: this._transformArgs(directive.args),
      astNode: directive.astNode,
    };
    return this._transformer.Directive
      ? this._transformer.Directive(config)
      : new GraphQLDirective(config);
  }

  _transformArgs(args: *): * {
    return keyValMap(
      args,
      arg => arg.name,
      arg => ({
        ...arg,
        type: this._transformType(arg.type),
      }),
    );
  }

  _transformFields(fieldsMap: *): * {
    return () =>
      mapValues(fieldsMap, field => ({
        type: this._transformType(field.type),
        args: this._transformArgs(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        description: field.description,
        astNode: field.astNode,
      }));
  }

  _transformInputFields(fieldsMap: *): * {
    return () =>
      mapValues(fieldsMap, field => ({
        type: this.transformType(field.type),
        defaultValue: field.defaultValue,
        description: field.description,
        astNode: field.astNode,
      }));
  }

  _transformType(type: *): * {
    if (isListType(type)) {
      return new GraphQLList(this._transformType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(this._transformType(type.ofType));
    }
    return this._transformNamedType(type);
  }

  _transformTypes<T: GraphQLNamedType>(arr: Array<T>): () => Array<T> {
    return () => arr.map(type => this._transformNamedType(type));
  }

  _transformNamedType<T: GraphQLNamedType>(type: T): T {
    if (isSpecifiedScalarType(type) || isIntrospectionType(type)) {
      return type;
    }

    let newType = this._cache[type.name];
    if (!newType) {
      newType = this._transformNamedTypeImpl(type);
      this._cache[type.name] = newType;
    }
    invariant(type.constructor === newType.constructor);
    invariant(type.name === newType.name);
    return ((newType: any): T);
  }

  _transformNamedTypeImpl(type: *): * {
    if (isScalarType(type)) {
      const config = {
        name: type.name,
        description: type.description,
        astNode: type.astNode,
        serialize: type._scalarConfig.serialize,
        parseValue: type._scalarConfig.parseValue,
        parseLiteral: type._scalarConfig.parseLiteral,
      };
      return this._transformer.ScalarType
        ? this._transformer.ScalarType(config)
        : new GraphQLScalarType(config);
    } else if (isObjectType(type)) {
      const config: ExactObjectTypeConfig = {
        name: type.name,
        interfaces: this._transformTypes(type.getInterfaces()),
        fields: this._transformFields(type.getFields()),
        isTypeOf: type.isTypeOf,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes || [],
      };
      return this._transformer.ObjectType
        ? this._transformer.ObjectType(config)
        : new GraphQLObjectType(config);
    } else if (isInterfaceType(type)) {
      const config = {
        name: type.name,
        fields: this._transformFields(type.getFields()),
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
        extensionASTNodes: type.extensionASTNodes || [],
      };
      return this._transformer.InterfaceType
        ? this._transformer.InterfaceType(config)
        : new GraphQLInterfaceType(config);
    } else if (isUnionType(type)) {
      const config = {
        name: type.name,
        types: this._transformTypes(type.getTypes()),
        resolveType: type.resolveType,
        description: type.description,
        astNode: type.astNode,
      };
      return this._transformer.UnionType
        ? this._transformer.UnionType(config)
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
      return this._transformer.EnumType
        ? this._transformer.EnumType(config)
        : new GraphQLEnumType(config);
    } else if (isInputObjectType(type)) {
      const config = {
        name: type.name,
        fields: this._transformInputFields(type.getFields()),
        description: type.description,
        astNode: type.astNode,
      };
      return this._transformer.InputObjectType
        ? this._transformer.InputObjectType(config)
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
