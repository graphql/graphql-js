// @flow strict

import find from '../polyfills/find';
import objectValues from '../polyfills/objectValues';

import inspect from '../jsutils/inspect';
import toObjMap from '../jsutils/toObjMap';
import devAssert from '../jsutils/devAssert';
import instanceOf from '../jsutils/instanceOf';
import isObjectLike from '../jsutils/isObjectLike';
import defineToStringTag from '../jsutils/defineToStringTag';
import {
  type ObjMap,
  type ReadOnlyObjMap,
  type ReadOnlyObjMapLike,
} from '../jsutils/ObjMap';

import { type GraphQLError } from '../error/GraphQLError';
import {
  type SchemaDefinitionNode,
  type SchemaExtensionNode,
} from '../language/ast';

import { __Schema } from './introspection';
import {
  GraphQLDirective,
  isDirective,
  specifiedDirectives,
} from './directives';
import {
  type GraphQLType,
  type GraphQLNamedType,
  type GraphQLAbstractType,
  type GraphQLObjectType,
  type GraphQLInterfaceType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isInputObjectType,
  getNamedType,
} from './definition';

/**
 * Test if the given value is a GraphQL schema.
 */
declare function isSchema(schema: mixed): boolean %checks(schema instanceof
  GraphQLSchema);
// eslint-disable-next-line no-redeclare
export function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema);
}

export function assertSchema(schema: mixed): GraphQLSchema {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }
  return schema;
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
 * Note: When the schema is constructed, by default only the types that are
 * reachable by traversing the root types are included, other types must be
 * explicitly referenced.
 *
 * Example:
 *
 *     const characterInterface = new GraphQLInterfaceType({
 *       name: 'Character',
 *       ...
 *     });
 *
 *     const humanType = new GraphQLObjectType({
 *       name: 'Human',
 *       interfaces: [characterInterface],
 *       ...
 *     });
 *
 *     const droidType = new GraphQLObjectType({
 *       name: 'Droid',
 *       interfaces: [characterInterface],
 *       ...
 *     });
 *
 *     const schema = new GraphQLSchema({
 *       query: new GraphQLObjectType({
 *         name: 'Query',
 *         fields: {
 *           hero: { type: characterInterface, ... },
 *         }
 *       }),
 *       ...
 *       // Since this schema references only the `Character` interface it's
 *       // necessary to explicitly list the types that implement it if
 *       // you want them to be included in the final schema.
 *       types: [humanType, droidType],
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
  extensions: ?ReadOnlyObjMap<mixed>;
  astNode: ?SchemaDefinitionNode;
  extensionASTNodes: ?$ReadOnlyArray<SchemaExtensionNode>;

  _queryType: ?GraphQLObjectType;
  _mutationType: ?GraphQLObjectType;
  _subscriptionType: ?GraphQLObjectType;
  _directives: $ReadOnlyArray<GraphQLDirective>;
  _typeMap: TypeMap;
  _implementations: ObjMap<InterfaceImplementations>;
  _subTypeMap: ObjMap<ObjMap<boolean>>;
  // Used as a cache for validateSchema().
  __validationErrors: ?$ReadOnlyArray<GraphQLError>;

  constructor(config: $ReadOnly<GraphQLSchemaConfig>): void {
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      this.__validationErrors = undefined;

      // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.
      devAssert(isObjectLike(config), 'Must provide configuration object.');
      devAssert(
        !config.types || Array.isArray(config.types),
        `"types" must be Array if provided but got: ${inspect(config.types)}.`,
      );
      devAssert(
        !config.directives || Array.isArray(config.directives),
        '"directives" must be Array if provided but got: ' +
          `${inspect(config.directives)}.`,
      );
    }

    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;

    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives || specifiedDirectives;

    // Build type map now to detect any errors within this schema.
    const initialTypes: Array<?GraphQLNamedType> = [
      this._queryType,
      this._mutationType,
      this._subscriptionType,
      __Schema,
    ].concat(config.types);

    // Keep track of all types referenced within the schema.
    let typeMap: TypeMap = Object.create(null);

    // First by deeply visiting all initial types.
    typeMap = initialTypes.reduce(typeMapReducer, typeMap);

    // Then by deeply visiting all directive types.
    typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap);

    // Storing the resulting map for reference by the schema.
    this._typeMap = typeMap;

    this._subTypeMap = Object.create(null);

    // Keep track of all implementations by interface name.
    this._implementations = collectImplementations(objectValues(typeMap));
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
    return isUnionType(abstractType)
      ? abstractType.getTypes()
      : this.getImplementations(abstractType).objects;
  }

  getImplementations(
    interfaceType: GraphQLInterfaceType,
  ): InterfaceImplementations {
    return this._implementations[interfaceType.name];
  }

  // @deprecated: use isSubType instead - will be removed in v16.
  isPossibleType(
    abstractType: GraphQLAbstractType,
    possibleType: GraphQLObjectType,
  ): boolean {
    /* istanbul ignore next */
    return this.isSubType(abstractType, possibleType);
  }

  isSubType(
    abstractType: GraphQLAbstractType,
    maybeSubType: GraphQLObjectType | GraphQLInterfaceType,
  ): boolean {
    let map = this._subTypeMap[abstractType.name];
    if (map === undefined) {
      map = Object.create(null);

      if (isUnionType(abstractType)) {
        for (const type of abstractType.getTypes()) {
          map[type.name] = true;
        }
      } else {
        const implementations = this.getImplementations(abstractType);
        for (const type of implementations.objects) {
          map[type.name] = true;
        }
        for (const type of implementations.interfaces) {
          map[type.name] = true;
        }
      }

      this._subTypeMap[abstractType.name] = map;
    }
    return map[maybeSubType.name] !== undefined;
  }

  getDirectives(): $ReadOnlyArray<GraphQLDirective> {
    return this._directives;
  }

  getDirective(name: string): ?GraphQLDirective {
    return find(this.getDirectives(), directive => directive.name === name);
  }

  toConfig(): GraphQLSchemaNormalizedConfig {
    return {
      query: this.getQueryType(),
      mutation: this.getMutationType(),
      subscription: this.getSubscriptionType(),
      types: objectValues(this.getTypeMap()),
      directives: this.getDirectives().slice(),
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      assumeValid: this.__validationErrors !== undefined,
    };
  }
}

// Conditionally apply `[Symbol.toStringTag]` if `Symbol`s are supported
defineToStringTag(GraphQLSchema);

type TypeMap = ObjMap<GraphQLNamedType>;

type InterfaceImplementations = {|
  objects: $ReadOnlyArray<GraphQLObjectType>,
  interfaces: $ReadOnlyArray<GraphQLInterfaceType>,
|};

export type GraphQLSchemaValidationOptions = {|
  /**
   * When building a schema from a GraphQL service's introspection result, it
   * might be safe to assume the schema is valid. Set to true to assume the
   * produced schema is valid.
   *
   * Default: false
   */
  assumeValid?: boolean,
|};

export type GraphQLSchemaConfig = {|
  query?: ?GraphQLObjectType,
  mutation?: ?GraphQLObjectType,
  subscription?: ?GraphQLObjectType,
  types?: ?Array<GraphQLNamedType>,
  directives?: ?Array<GraphQLDirective>,
  extensions?: ?ReadOnlyObjMapLike<mixed>,
  astNode?: ?SchemaDefinitionNode,
  extensionASTNodes?: ?$ReadOnlyArray<SchemaExtensionNode>,
  ...GraphQLSchemaValidationOptions,
|};

/**
 * @internal
 */
export type GraphQLSchemaNormalizedConfig = {|
  ...GraphQLSchemaConfig,
  types: Array<GraphQLNamedType>,
  directives: Array<GraphQLDirective>,
  extensions: ?ReadOnlyObjMap<mixed>,
  extensionASTNodes: ?$ReadOnlyArray<SchemaExtensionNode>,
  assumeValid: boolean,
|};

function collectImplementations(
  types: $ReadOnlyArray<GraphQLNamedType>,
): ObjMap<InterfaceImplementations> {
  const implementationsMap = Object.create(null);

  for (const type of types) {
    if (isInterfaceType(type)) {
      if (implementationsMap[type.name] === undefined) {
        implementationsMap[type.name] = { objects: [], interfaces: [] };
      }

      // Store implementations by interface.
      for (const iface of type.getInterfaces()) {
        if (isInterfaceType(iface)) {
          const implementations = implementationsMap[iface.name];
          if (implementations === undefined) {
            implementationsMap[iface.name] = {
              objects: [],
              interfaces: [type],
            };
          } else {
            implementations.interfaces.push(type);
          }
        }
      }
    } else if (isObjectType(type)) {
      // Store implementations by objects.
      for (const iface of type.getInterfaces()) {
        if (isInterfaceType(iface)) {
          const implementations = implementationsMap[iface.name];
          if (implementations === undefined) {
            implementationsMap[iface.name] = {
              objects: [type],
              interfaces: [],
            };
          } else {
            implementations.objects.push(type);
          }
        }
      }
    }
  }

  return implementationsMap;
}

function typeMapReducer(map: TypeMap, type: ?GraphQLType): TypeMap {
  if (!type) {
    return map;
  }

  const namedType = getNamedType(type);
  const seenType = map[namedType.name];
  if (seenType) {
    if (seenType !== namedType) {
      throw new Error(
        `Schema must contain uniquely named types but contains multiple types named "${namedType.name}".`,
      );
    }
    return map;
  }
  map[namedType.name] = namedType;

  let reducedMap = map;

  if (isUnionType(namedType)) {
    reducedMap = namedType.getTypes().reduce(typeMapReducer, reducedMap);
  } else if (isObjectType(namedType) || isInterfaceType(namedType)) {
    reducedMap = namedType.getInterfaces().reduce(typeMapReducer, reducedMap);

    for (const field of objectValues(namedType.getFields())) {
      const fieldArgTypes = field.args.map(arg => arg.type);
      reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      reducedMap = typeMapReducer(reducedMap, field.type);
    }
  } else if (isInputObjectType(namedType)) {
    for (const field of objectValues(namedType.getFields())) {
      reducedMap = typeMapReducer(reducedMap, field.type);
    }
  }

  return reducedMap;
}

function typeMapDirectiveReducer(
  map: TypeMap,
  directive: ?GraphQLDirective,
): TypeMap {
  // Directives are not validated until validateSchema() is called.
  if (!isDirective(directive)) {
    return map;
  }
  return directive.args.reduce(
    (_map, arg) => typeMapReducer(_map, arg.type),
    map,
  );
}
