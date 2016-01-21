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
import {
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective
} from './directives';
import { __Schema } from './introspection';
import find from '../jsutils/find';
import invariant from '../jsutils/invariant';
import { isEqualType, isTypeSubTypeOf } from '../utilities/typeComparators';


/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 *
 * Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       query: MyAppQueryRootType
 *       mutation: MyAppMutationRootType
 *     });
 *
 */
export class GraphQLSchema {
  _queryType: GraphQLObjectType;
  _mutationType: ?GraphQLObjectType;
  _subscriptionType: ?GraphQLObjectType;
  _directives: Array<GraphQLDirective>;
  _typeMap: TypeMap;

  constructor(config: GraphQLSchemaConfig) {
    invariant(
      typeof config === 'object',
      'Must provide configuration object.'
    );

    invariant(
      config.query instanceof GraphQLObjectType,
      `Schema query must be Object Type but got: ${config.query}.`
    );
    this._queryType = config.query;

    invariant(
      !config.mutation || config.mutation instanceof GraphQLObjectType,
      `Schema mutation must be Object Type if provided but ` +
      `got: ${config.mutation}.`
    );
    this._mutationType = config.mutation;

    invariant(
      !config.subscription || config.subscription instanceof GraphQLObjectType,
      `Schema subscription must be Object Type if provided but ` +
      `got: ${config.subscription}.`
    );
    this._subscriptionType = config.subscription;

    invariant(
      !config.directives ||
      Array.isArray(config.directives) && config.directives.every(
        directive => directive instanceof GraphQLDirective
      ),
      `Schema directives must be Array<GraphQLDirective> if provided but ` +
      `got: ${config.directives}.`
    );
    // Provide `@include() and `@skip()` directives by default.
    this._directives = config.directives || [
      GraphQLIncludeDirective,
      GraphQLSkipDirective
    ];

    // Build type map now to detect any errors within this schema.
    this._typeMap = [
      this.getQueryType(),
      this.getMutationType(),
      this.getSubscriptionType(),
      __Schema
    ].reduce(typeMapReducer, {});

    // Enforce correct interface implementations
    Object.keys(this._typeMap).forEach(typeName => {
      const type = this._typeMap[typeName];
      if (type instanceof GraphQLObjectType) {
        type.getInterfaces().forEach(
          iface => assertObjectImplementsInterface(type, iface)
        );
      }
    });
  }

  getQueryType(): GraphQLObjectType {
    return this._queryType;
  }

  getMutationType(): ?GraphQLObjectType {
    return this._mutationType;
  }

  getSubscriptionType(): ?GraphQLObjectType {
    return this._subscriptionType;
  }

  getTypeMap(): TypeMap {
    return this._typeMap;
  }

  getType(name: string): ?GraphQLType {
    return this.getTypeMap()[name];
  }

  getDirectives(): Array<GraphQLDirective> {
    return this._directives;
  }

  getDirective(name: string): ?GraphQLDirective {
    return find(this.getDirectives(), directive => directive.name === name);
  }
}

type TypeMap = { [typeName: string]: GraphQLType }

type GraphQLSchemaConfig = {
  query: GraphQLObjectType;
  mutation?: ?GraphQLObjectType;
  subscription?: ?GraphQLObjectType;
  directives?: ?Array<GraphQLDirective>;
}

function typeMapReducer(map: TypeMap, type: ?GraphQLType): TypeMap {
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

  let reducedMap = map;

  if (type instanceof GraphQLUnionType ||
      type instanceof GraphQLInterfaceType) {
    reducedMap = type.getPossibleTypes().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof GraphQLObjectType) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType ||
      type instanceof GraphQLInputObjectType) {
    const fieldMap = type.getFields();
    Object.keys(fieldMap).forEach(fieldName => {
      const field = fieldMap[fieldName];

      if (field.args) {
        const fieldArgTypes = field.args.map(arg => arg.type);
        reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      }
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  return reducedMap;
}

function assertObjectImplementsInterface(
  object: GraphQLObjectType,
  iface: GraphQLInterfaceType
): void {
  const objectFieldMap = object.getFields();
  const ifaceFieldMap = iface.getFields();

  // Assert each interface field is implemented.
  Object.keys(ifaceFieldMap).forEach(fieldName => {
    const objectField = objectFieldMap[fieldName];
    const ifaceField = ifaceFieldMap[fieldName];

    // Assert interface field exists on object.
    invariant(
      objectField,
      `"${iface}" expects field "${fieldName}" but "${object}" does not ` +
      `provide it.`
    );

    // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)
    invariant(
      isTypeSubTypeOf(objectField.type, ifaceField.type),
      `${iface}.${fieldName} expects type "${ifaceField.type}" but ` +
      `${object}.${fieldName} provides type "${objectField.type}".`
    );

    // Assert each interface field arg is implemented.
    ifaceField.args.forEach(ifaceArg => {
      const argName = ifaceArg.name;
      const objectArg = find(objectField.args, arg => arg.name === argName);

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

    // Assert additional arguments must not be required.
    objectField.args.forEach(objectArg => {
      const argName = objectArg.name;
      const ifaceArg = find(ifaceField.args, arg => arg.name === argName);
      if (!ifaceArg) {
        invariant(
          !(objectArg.type instanceof GraphQLNonNull),
          `${object}.${fieldName}(${argName}:) is of required type ` +
          `"${objectArg.type}" but is not also provided by the ` +
          `interface ${iface}.${fieldName}.`
        );
      }
    });
  });
}
