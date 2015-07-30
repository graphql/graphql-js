/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull
} from './definition';
import type { GraphQLType } from './definition';
import { GraphQLIncludeDirective, GraphQLSkipDirective } from './directives';
import type { GraphQLDirective } from './directives';
import { __Schema } from './introspection';
import find from '../utils/find';


/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 *
 * Example:
 *
 *     var MyAppSchema = new GraphQLSchema({
 *       query: MyAppQueryRootType
 *       mutation: MyAppMutationRootType
 *     });
 *
 */
export class GraphQLSchema {
  _schemaConfig: GraphQLSchemaConfig;
  _typeMap: TypeMap;
  _directives: Array<GraphQLDirective>;

  constructor(config: GraphQLSchemaConfig) {
    this._schemaConfig = config;
  }

  getQueryType(): GraphQLObjectType {
    return this._schemaConfig.query;
  }

  getMutationType(): ?GraphQLObjectType {
    return this._schemaConfig.mutation;
  }

  getTypeMap(): TypeMap {
    return this._typeMap || (this._typeMap = [
      this.getQueryType(),
      this.getMutationType(),
      __Schema
    ].reduce(typeMapReducer, {}));
  }

  getType(name: string): ?GraphQLType {
    return this.getTypeMap()[name];
  }

  getDirectives(): Array<GraphQLDirective> {
    return this._directives || (this._directives = [
      GraphQLIncludeDirective,
      GraphQLSkipDirective
    ]);
  }

  getDirective(name: string): ?GraphQLDirective {
    return find(this.getDirectives(), directive => directive.name === name);
  }
}

type TypeMap = { [typeName: string]: GraphQLType }

type GraphQLSchemaConfig = {
  query: GraphQLObjectType;
  mutation?: ?GraphQLObjectType;
}

function typeMapReducer(map: TypeMap, type: ?GraphQLType): TypeMap {
  if (type instanceof GraphQLList || type instanceof GraphQLNonNull) {
    return typeMapReducer(map, type.ofType);
  }
  if (!type || map[type.name]) {
    return map;
  }
  map[type.name] = type;

  var reducedMap = map;

  if (type instanceof GraphQLUnionType ||
      type instanceof GraphQLInterfaceType) {
    reducedMap = type.getPossibleTypes().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof GraphQLObjectType) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType) {
    var fieldMap = type.getFields();
    Object.keys(fieldMap).forEach(fieldName => {
      var field = fieldMap[fieldName];
      if (!field.args) {
        console.log(field.name + ' has no args?');
      }
      var fieldArgTypes = field.args.map(arg => arg.type);
      reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  return reducedMap;
}
