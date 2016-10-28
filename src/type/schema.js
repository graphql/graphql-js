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
import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLAbstractType
} from './definition';
import { GraphQLDirective, specifiedDirectives } from './directives';
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
 *       query: MyAppQueryRootType,
 *       mutation: MyAppMutationRootType,
 *     })
 *
 * Note: If an array of `directives` are provided to GraphQLSchema, that will be
 * the exact list of directives represented and allowed. If `directives` is not
 * provided then a default set of the specified directives (e.g. @include and
 * @skip) will be used. If you wish to provide *additional* directives to these
 * specified directives, you must explicitly declare them. Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       ...
 *       directives: specifiedDirectives.concat([ myCustomDirective ]),
 *     })
 *
 */
export class GraphQLSchema {
  _queryType: GraphQLObjectType;
  _mutationType: ?GraphQLObjectType;
  _subscriptionType: ?GraphQLObjectType;
  _directives: Array<GraphQLDirective>;
  _typeMap: TypeMap;
  _implementations: { [interfaceName: string]: Array<GraphQLObjectType> };
  _possibleTypeMap: ?{
    [abstractName: string]: { [possibleName: string]: boolean }
  };

  constructor(config: GraphQLSchemaConfig) {
    invariant(
      typeof config === 'object',
      'Must provide configuration object.'
    );

    invariant(
      config.query instanceof GraphQLObjectType,
      `Schema query must be Object Type but got: ${
        String(config.query)}.`
    );
    this._queryType = config.query;

    invariant(
      !config.mutation || config.mutation instanceof GraphQLObjectType,
      `Schema mutation must be Object Type if provided but got: ${
        String(config.mutation)}.`
    );
    this._mutationType = config.mutation;

    invariant(
      !config.subscription || config.subscription instanceof GraphQLObjectType,
      `Schema subscription must be Object Type if provided but got: ${
        String(config.subscription)}.`
    );
    this._subscriptionType = config.subscription;

    invariant(
      !config.types || Array.isArray(config.types),
      `Schema types must be Array if provided but got: ${String(config.types)}.`
    );

    invariant(
      !config.directives ||
      Array.isArray(config.directives) && config.directives.every(
        directive => directive instanceof GraphQLDirective
      ),
      `Schema directives must be Array<GraphQLDirective> if provided but got: ${
        String(config.directives)}.`
    );
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives || specifiedDirectives;

    // Build type map now to detect any errors within this schema.
    let initialTypes: Array<?GraphQLNamedType> = [
      this.getQueryType(),
      this.getMutationType(),
      this.getSubscriptionType(),
      __Schema
    ];

    const types = config.types;
    if (types) {
      initialTypes = initialTypes.concat(types);
    }

    this._typeMap = initialTypes.reduce(
      typeMapReducer,
      (Object.create(null): TypeMap)
    );

    // Keep track of all implementations by interface name.
    this._implementations = Object.create(null);
    Object.keys(this._typeMap).forEach(typeName => {
      const type = this._typeMap[typeName];
      if (type instanceof GraphQLObjectType) {
        type.getInterfaces().forEach(iface => {
          const impls = this._implementations[iface.name];
          if (impls) {
            impls.push(type);
          } else {
            this._implementations[iface.name] = [ type ];
          }
        });
      }
    });

    // Enforce correct interface implementations.
    Object.keys(this._typeMap).forEach(typeName => {
      const type = this._typeMap[typeName];
      if (type instanceof GraphQLObjectType) {
        type.getInterfaces().forEach(
          iface => assertObjectImplementsInterface(this, type, iface)
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

  getType(name: string): ?GraphQLNamedType {
    return this.getTypeMap()[name];
  }

  getPossibleTypes(
    abstractType: GraphQLAbstractType
  ): Array<GraphQLObjectType> {
    if (abstractType instanceof GraphQLUnionType) {
      return abstractType.getTypes();
    }
    invariant(abstractType instanceof GraphQLInterfaceType);
    return this._implementations[abstractType.name];
  }

  isPossibleType(
    abstractType: GraphQLAbstractType,
    possibleType: GraphQLObjectType
  ): boolean {
    let possibleTypeMap = this._possibleTypeMap;
    if (!possibleTypeMap) {
      this._possibleTypeMap = possibleTypeMap = Object.create(null);
    }

    if (!possibleTypeMap[abstractType.name]) {
      const possibleTypes = this.getPossibleTypes(abstractType);
      invariant(
        Array.isArray(possibleTypes),
        `Could not find possible implementing types for ${abstractType.name} ` +
        'in schema. Check that schema.types is defined and is an array of ' +
        'all possible types in the schema.'
      );
      possibleTypeMap[abstractType.name] =
        possibleTypes.reduce(
          (map, type) => ((map[type.name] = true), map),
          Object.create(null)
        );
    }

    return Boolean(possibleTypeMap[abstractType.name][possibleType.name]);
  }

  getDirectives(): Array<GraphQLDirective> {
    return this._directives;
  }

  getDirective(name: string): ?GraphQLDirective {
    return find(this.getDirectives(), directive => directive.name === name);
  }
}

type TypeMap = { [typeName: string]: GraphQLNamedType };

type GraphQLSchemaConfig = {
  query: GraphQLObjectType;
  mutation?: ?GraphQLObjectType;
  subscription?: ?GraphQLObjectType;
  types?: ?Array<GraphQLNamedType>;
  directives?: ?Array<GraphQLDirective>;
};

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
      'Schema must contain unique named types but contains multiple ' +
      `types named "${type.name}".`
    );
    return map;
  }
  map[type.name] = type;

  let reducedMap = map;

  if (type instanceof GraphQLUnionType) {
    reducedMap = type.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof GraphQLObjectType) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType) {
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

  if (type instanceof GraphQLInputObjectType) {
    const fieldMap = type.getFields();
    Object.keys(fieldMap).forEach(fieldName => {
      const field = fieldMap[fieldName];
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  return reducedMap;
}

function assertObjectImplementsInterface(
  schema: GraphQLSchema,
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
      `"${iface.name}" expects field "${fieldName}" but "${object.name}" ` +
      'does not provide it.'
    );

    // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)
    invariant(
      isTypeSubTypeOf(schema, objectField.type, ifaceField.type),
      `${iface.name}.${fieldName} expects type "${String(ifaceField.type)}" ` +
      'but ' +
      `${object.name}.${fieldName} provides type "${String(objectField.type)}".`
    );

    // Assert each interface field arg is implemented.
    ifaceField.args.forEach(ifaceArg => {
      const argName = ifaceArg.name;
      const objectArg = find(objectField.args, arg => arg.name === argName);

      // Assert interface field arg exists on object field.
      invariant(
        objectArg,
        `${iface.name}.${fieldName} expects argument "${argName}" but ` +
        `${object.name}.${fieldName} does not provide it.`
      );

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      invariant(
        isEqualType(ifaceArg.type, objectArg.type),
        `${iface.name}.${fieldName}(${argName}:) expects type ` +
        `"${String(ifaceArg.type)}" but ` +
        `${object.name}.${fieldName}(${argName}:) provides type ` +
        `"${String(objectArg.type)}".`
      );
    });

    // Assert additional arguments must not be required.
    objectField.args.forEach(objectArg => {
      const argName = objectArg.name;
      const ifaceArg = find(ifaceField.args, arg => arg.name === argName);
      if (!ifaceArg) {
        invariant(
          !(objectArg.type instanceof GraphQLNonNull),
          `${object.name}.${fieldName}(${argName}:) is of required type ` +
          `"${String(objectArg.type)}" but is not also provided by the ` +
          `interface ${iface.name}.${fieldName}.`
        );
      }
    });
  });
}
