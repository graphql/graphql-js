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
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull
} from './definition';
import type { GraphQLType } from './definition';
import { GraphQLIncludeDirective, GraphQLSkipDirective } from './directives';
import type { GraphQLDirective } from './directives';
import { __Schema } from './introspection';
import find from '../jsutils/find';
import invariant from '../jsutils/invariant';


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
    invariant(
      typeof config === 'object',
      'Must provide configuration object.'
    );
    invariant(
      config.query instanceof GraphQLObjectType,
      `Schema query must be Object Type but got: ${config.query}.`
    );
    invariant(
      !config.mutation || config.mutation instanceof GraphQLObjectType,
      `Schema mutation must be Object Type if provided but ` +
      `got: ${config.mutation}.`
    );
    invariant(
      !config.types || Array.isArray(config.types),
      `Schema types must be Array if provided but ` +
      `got: ${config.types}.`
    );
    this._schemaConfig = config;

    var possibleTypeMap = [
      this.getQueryType(),
      this.getMutationType()
    ].reduce(possibleTypeMapReducer, {});

    possibleTypeMap = (config.types || [])
      .reduce(possibleTypeMapReducer, possibleTypeMap);

    // Build type map now to detect any errors within this schema.
    this._typeMap = [
      this.getQueryType(),
      this.getMutationType(),
      __Schema
    ].reduce(makeTypeMapReducer(possibleTypeMap), {});

    // Enforce correct interface implementations
    Object.keys(this._typeMap).forEach(typeName => {
      var type = this._typeMap[typeName];
      if (type instanceof GraphQLObjectType) {
        type.getInterfaces().forEach(
          iface => assertObjectImplementsInterface(type, iface)
        );
      }
    });
  }

  getQueryType(): GraphQLObjectType {
    return this._schemaConfig.query;
  }

  getMutationType(): ?GraphQLObjectType {
    return this._schemaConfig.mutation;
  }

  getTypeMap(): TypeMap {
    return this._typeMap;
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
type GraphQLObjectOrUnionType = GraphQLObjectType | GraphQLUnionType;

type GraphQLSchemaConfig = {
  query: GraphQLObjectType;
  mutation?: ?GraphQLObjectType;
  types?: Array<GraphQLObjectOrUnionType>
}

function possibleTypeMapReducer(
  map: TypeMap,
  type: ?GraphQLObjectOrUnionType
): TypeMap {
  if (!type) {
    return map;
  }
  if (type instanceof GraphQLUnionType) {
    return type.getPossibleTypes().reduce(possibleTypeMapReducer, map);
  }
  invariant(
    type instanceof GraphQLObjectType,
    `Schema types must be GraphQLObject or GraphQLUnion types,` +
    `found ${type}.`
  );
  return attachInterfaces(map, type);
}

function attachInterfaces(
  map: TypeMap,
  type: GraphQLObjectType
): TypeMap {
  type.getInterfaces().forEach(iface => {
    if (!iface.isPossibleType(type)) {
      iface._implementations.push(type);
      iface._possibleTypes = null;
    }
  });
  invariant(
    !map[type.name] || map[type.name] === type,
    `Schema must contain unique named types but contains multiple ` +
    `types named "${type}".`
  );
  map[type.name] = type;
  return map;
}

function makeTypeMapReducer(possibleTypes: TypeMap) {
  return function typeMapReducer(map: TypeMap, type: ?GraphQLType): TypeMap {
    if (!type) {
      return map;
    }
    if (type instanceof GraphQLList || type instanceof GraphQLNonNull) {
      return typeMapReducer(map, type.ofType);
    }
    if (map[type.name]) {
      invariant(
        map[type.name] === type,
        `Schema must contain unique named types but contains multiple ` +
        `types named "${type}".`
      );
      return map;
    }
    map[type.name] = type;

    var reducedMap = map;

    if (type instanceof GraphQLUnionType ||
        type instanceof GraphQLInterfaceType) {
      reducedMap = type.getPossibleTypes().reduce(typeMapReducer, reducedMap);
    }

    if (type instanceof GraphQLObjectType) {
      if (type.getInterfaces().length > 0) {
        invariant(
          possibleTypes[type.name],
          `Schema must define all Object or Union types implementing ` +
          `Interfaces, missing: ${type.name}`
        );
      }
      reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
    }

    if (type instanceof GraphQLObjectType ||
        type instanceof GraphQLInterfaceType ||
        type instanceof GraphQLInputObjectType) {
      var fieldMap = type.getFields();
      Object.keys(fieldMap).forEach(fieldName => {
        var field = fieldMap[fieldName];

        if (field.args) {
          var fieldArgTypes = field.args.map(arg => arg.type);
          reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
        }
        reducedMap = typeMapReducer(reducedMap, field.type);
      });
    }

    return reducedMap;
  };
}


function assertObjectImplementsInterface(
  object: GraphQLObjectType,
  iface: GraphQLInterfaceType
): void {
  var objectFieldMap = object.getFields();
  var ifaceFieldMap = iface.getFields();

  // Assert each interface field is implemented.
  Object.keys(ifaceFieldMap).forEach(fieldName => {
    var objectField = objectFieldMap[fieldName];
    var ifaceField = ifaceFieldMap[fieldName];

    // Assert interface field exists on object.
    invariant(
      objectField,
      `"${iface}" expects field "${fieldName}" but "${object}" does not ` +
      `provide it.`
    );

    // Assert interface field type matches object field type. (invariant)
    invariant(
      isEqualType(ifaceField.type, objectField.type),
      `${iface}.${fieldName} expects type "${ifaceField.type}" but ` +
      `${object}.${fieldName} provides type "${objectField.type}".`
    );

    // Assert each interface field arg is implemented.
    ifaceField.args.forEach(ifaceArg => {
      var argName = ifaceArg.name;
      var objectArg = find(objectField.args, arg => arg.name === argName);

      // Assert interface field arg exists on object field.
      invariant(
        objectArg,
        `${iface}.${fieldName} expects argument "${argName}" but ` +
        `${object}.${fieldName} does not provide it.`
      );

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      invariant(
        isEqualType(ifaceArg.type, objectArg.type),
        `${iface}.${fieldName}(${argName}:) expects type "${ifaceArg.type}" ` +
        `but ${object}.${fieldName}(${argName}:) provides ` +
        `type "${objectArg.type}".`
      );
    });

    // Assert argument set invariance.
    objectField.args.forEach(objectArg => {
      var argName = objectArg.name;
      var ifaceArg = find(ifaceField.args, arg => arg.name === argName);
      invariant(
        ifaceArg,
        `${iface}.${fieldName} does not define argument "${argName}" but ` +
        `${object}.${fieldName} provides it.`
      );
    });
  });
}

function isEqualType(typeA: GraphQLType, typeB: GraphQLType): boolean {
  if (typeA instanceof GraphQLNonNull && typeB instanceof GraphQLNonNull) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }
  if (typeA instanceof GraphQLList && typeB instanceof GraphQLList) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }
  return typeA === typeB;
}
