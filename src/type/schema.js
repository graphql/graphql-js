/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {
  isObjectType,
  isInterfaceType,
  isUnionType,
  isInputObjectType,
  isWrappingType,
} from './definition';
import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLAbstractType,
  GraphQLObjectType,
  GraphQLInterfaceType,
} from './definition';
import type { SchemaDefinitionNode } from '../language/ast';
import { GraphQLDirective, specifiedDirectives } from './directives';
import type { GraphQLError } from '../error/GraphQLError';
import { __Schema } from './introspection';
import find from '../jsutils/find';
import instanceOf from '../jsutils/instanceOf';
import invariant from '../jsutils/invariant';
import type { ObjMap } from '../jsutils/ObjMap';

/**
 * Test if the given value is a GraphQL schema.
 */
declare function isSchema(schema: mixed): boolean %checks(schema instanceof
  GraphQLSchema);
// eslint-disable-next-line no-redeclare
export function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema);
}

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
  astNode: ?SchemaDefinitionNode;
  _queryType: ?GraphQLObjectType;
  _mutationType: ?GraphQLObjectType;
  _subscriptionType: ?GraphQLObjectType;
  _directives: $ReadOnlyArray<GraphQLDirective>;
  _typeMap: TypeMap;
  _implementations: ObjMap<Array<GraphQLObjectType>>;
  _possibleTypeMap: ?ObjMap<ObjMap<boolean>>;
  // Used as a cache for validateSchema().
  __validationErrors: ?$ReadOnlyArray<GraphQLError>;

  constructor(config: GraphQLSchemaConfig): void {
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.
      invariant(
        typeof config === 'object',
        'Must provide configuration object.',
      );
      invariant(
        !config.types || Array.isArray(config.types),
        `"types" must be Array if provided but got: ${String(config.types)}.`,
      );
      invariant(
        !config.directives || Array.isArray(config.directives),
        '"directives" must be Array if provided but got: ' +
          `${String(config.directives)}.`,
      );
    }

    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives || specifiedDirectives;
    this.astNode = config.astNode;

    // Build type map now to detect any errors within this schema.
    let initialTypes: Array<?GraphQLNamedType> = [
      this.getQueryType(),
      this.getMutationType(),
      this.getSubscriptionType(),
      __Schema,
    ];

    const types = config.types;
    if (types) {
      initialTypes = initialTypes.concat(types);
    }

    this._typeMap = initialTypes.reduce(
      typeMapReducer,
      (Object.create(null): TypeMap),
    );

    // Keep track of all implementations by interface name.
    this._implementations = Object.create(null);
    Object.keys(this._typeMap).forEach(typeName => {
      const type = this._typeMap[typeName];
      if (isObjectType(type)) {
        type.getInterfaces().forEach(iface => {
          const impls = this._implementations[iface.name];
          if (impls) {
            impls.push(type);
          } else {
            this._implementations[iface.name] = [type];
          }
        });
      }
    });
  }

  getQueryType(): ?GraphQLObjectType {
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
    abstractType: GraphQLAbstractType,
  ): $ReadOnlyArray<GraphQLObjectType> {
    if (isUnionType(abstractType)) {
      return abstractType.getTypes();
    }
    return this._implementations[(abstractType: GraphQLInterfaceType).name];
  }

  isPossibleType(
    abstractType: GraphQLAbstractType,
    possibleType: GraphQLObjectType,
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
          'all possible types in the schema.',
      );
      possibleTypeMap[abstractType.name] = possibleTypes.reduce(
        (map, type) => ((map[type.name] = true), map),
        Object.create(null),
      );
    }

    return Boolean(possibleTypeMap[abstractType.name][possibleType.name]);
  }

  getDirectives(): $ReadOnlyArray<GraphQLDirective> {
    return this._directives;
  }

  getDirective(name: string): ?GraphQLDirective {
    return find(this.getDirectives(), directive => directive.name === name);
  }
}

type TypeMap = ObjMap<GraphQLNamedType>;

type GraphQLSchemaConfig = {
  query?: ?GraphQLObjectType,
  mutation?: ?GraphQLObjectType,
  subscription?: ?GraphQLObjectType,
  types?: ?Array<GraphQLNamedType>,
  directives?: ?Array<GraphQLDirective>,
  astNode?: ?SchemaDefinitionNode,
  assumeValid?: boolean,
};

function typeMapReducer(map: TypeMap, type: ?GraphQLType): TypeMap {
  if (!type) {
    return map;
  }
  if (isWrappingType(type)) {
    return typeMapReducer(map, type.ofType);
  }
  if (map[type.name]) {
    invariant(
      map[type.name] === type,
      'Schema must contain unique named types but contains multiple ' +
        `types named "${type.name}".`,
    );
    return map;
  }
  map[type.name] = type;

  let reducedMap = map;

  if (isUnionType(type)) {
    reducedMap = type.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if (isObjectType(type)) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (isObjectType(type) || isInterfaceType(type)) {
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

  if (isInputObjectType(type)) {
    const fieldMap = type.getFields();
    Object.keys(fieldMap).forEach(fieldName => {
      const field = fieldMap[fieldName];
      reducedMap = typeMapReducer(reducedMap, field.type);
    });
  }

  return reducedMap;
}
