/** @category Schema */

import { inspect } from '../jsutils/inspect.ts';
import { instanceOf } from '../jsutils/instanceOf.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import { toObjMapWithSymbols } from '../jsutils/toObjMap.ts';

import type { GraphQLError } from '../error/GraphQLError.ts';

import type {
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../language/ast.ts';
import { OperationTypeNode } from '../language/ast.ts';

import type {
  GraphQLAbstractType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLType,
} from './definition.ts';
import {
  getNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from './definition.ts';
import type { GraphQLDirective } from './directives.ts';
import { isDirective, specifiedDirectives } from './directives.ts';
import {
  __Schema,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from './introspection.ts';

/**
 * Test if the given value is a GraphQL schema.
 * @param schema - Value to inspect.
 * @returns True when the value is a GraphQLSchema.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { GraphQLString, isSchema } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 *
 * isSchema(schema); // => true
 * isSchema(GraphQLString); // => false
 * ```
 */
export function isSchema(schema: unknown): schema is GraphQLSchema {
  return instanceOf(schema, schemaSymbol, GraphQLSchema);
}

/**
 * Returns the value as a GraphQLSchema, or throws if it is not a schema.
 * @param schema - GraphQL schema to use.
 * @returns The value typed as a GraphQLSchema.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertSchema, GraphQLString } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 *
 * assertSchema(schema); // => schema
 * assertSchema(GraphQLString); // throws an error
 * ```
 */
export function assertSchema(schema: unknown): GraphQLSchema {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }
  return schema;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLSchemaExtensions {
  [attributeName: string | symbol]: unknown;
}

/** @private */
const schemaSymbol: unique symbol = Symbol('Schema');

/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 * @example
 * ```ts
 * const MyAppQueryRootType = new GraphQLObjectType({
 *   name: 'Query',
 *   fields: {
 *     greeting: { type: GraphQLString },
 *   },
 * });
 *
 * const MyAppMutationRootType = new GraphQLObjectType({
 *   name: 'Mutation',
 *   fields: {
 *     setGreeting: { type: GraphQLString },
 *   },
 * });
 *
 * const MyAppSchema = new GraphQLSchema({
 *   query: MyAppQueryRootType,
 *   mutation: MyAppMutationRootType,
 * });
 * ```
 * @example
 * When the schema is constructed, by default only the types that are reachable
 * by traversing the root types are included, other types must be explicitly
 * referenced.
 *
 * ```ts
 * const characterInterface = new GraphQLInterfaceType({
 *   name: 'Character',
 *   fields: {
 *     name: { type: GraphQLString },
 *   },
 * });
 *
 * const humanType = new GraphQLObjectType({
 *   name: 'Human',
 *   interfaces: [characterInterface],
 *   fields: {
 *     name: { type: GraphQLString },
 *   },
 * });
 *
 * const droidType = new GraphQLObjectType({
 *   name: 'Droid',
 *   interfaces: [characterInterface],
 *   fields: {
 *     name: { type: GraphQLString },
 *   },
 * });
 *
 * const schema = new GraphQLSchema({
 *   query: new GraphQLObjectType({
 *     name: 'Query',
 *     fields: {
 *       hero: { type: characterInterface },
 *     },
 *   }),
 *   // Since this schema references only the `Character` interface it's
 *   // necessary to explicitly list the types that implement it if
 *   // you want them to be included in the final schema.
 *   types: [humanType, droidType],
 * });
 * ```
 * @example
 * If an array of `directives` are provided to GraphQLSchema, that will be the
 * exact list of directives represented and allowed. If `directives` is not
 * provided then a default set of the specified directives (e.g. `@include` and
 * `@skip`) will be used. If you wish to provide *additional* directives to
 * these specified directives, you must explicitly declare them.
 *
 * ```ts
 * const MyAppSchema = new GraphQLSchema({
 *   query: MyAppQueryRootType,
 *   directives: specifiedDirectives.concat([myCustomDirective]),
 * });
 * ```
 */
export class GraphQLSchema {
  /**
   * Internal runtime marker used to identify GraphQLSchema instances.
   * @private
   */
  readonly __kind: typeof schemaSymbol = schemaSymbol;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLSchemaExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<SchemaDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<SchemaExtensionNode>;

  /** Whether this schema instance skips validation checks. */
  assumeValid: boolean;
  /**
   * Cached schema validation errors, if validation has already run.
   * @private
   */
  __validationErrors: Maybe<ReadonlyArray<GraphQLError>>;

  private _queryType: Maybe<GraphQLObjectType>;
  private _mutationType: Maybe<GraphQLObjectType>;
  private _subscriptionType: Maybe<GraphQLObjectType>;
  private _directives: ReadonlyArray<GraphQLDirective>;
  private _typeMap: TypeMap;
  private _subTypeMap: Map<
    GraphQLAbstractType,
    Set<GraphQLObjectType | GraphQLInterfaceType>
  >;

  private _implementationsMap: ObjMap<{
    objects: Array<GraphQLObjectType>;
    interfaces: Array<GraphQLInterfaceType>;
  }>;

  /**
   * Creates a GraphQLSchema instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * // Create a schema with the required query root.
   * import {
   *   GraphQLObjectType,
   *   GraphQLSchema,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({
   *   name: 'Query',
   *   fields: {
   *     greeting: {
   *       type: GraphQLString,
   *       resolve: () => 'Hello',
   *     },
   *   },
   * });
   *
   * const schema = new GraphQLSchema({
   *   description: 'The application schema.',
   *   query: Query,
   * });
   *
   * schema.getQueryType(); // => Query
   * schema.description; // => 'The application schema.'
   * ```
   * @example
   * ```ts
   * // This variant configures every schema option, including directives and extensions.
   * import { DirectiveLocation, parse } from 'graphql/language';
   * import {
   *   GraphQLBoolean,
   *   GraphQLDirective,
   *   GraphQLObjectType,
   *   GraphQLSchema,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({
   *   name: 'Query',
   *   fields: { greeting: { type: GraphQLString } },
   * });
   * const Mutation = new GraphQLObjectType({
   *   name: 'Mutation',
   *   fields: { setGreeting: { type: GraphQLString } },
   * });
   * const Subscription = new GraphQLObjectType({
   *   name: 'Subscription',
   *   fields: { greetingChanged: { type: GraphQLString } },
   * });
   * const AuditEvent = new GraphQLObjectType({
   *   name: 'AuditEvent',
   *   fields: { message: { type: GraphQLString } },
   * });
   * const authDirective = new GraphQLDirective({
   *   name: 'auth',
   *   locations: [DirectiveLocation.FIELD_DEFINITION],
   *   args: { required: { type: GraphQLBoolean } },
   * });
   * const schemaDocument = parse(`
   *   schema {
   *     query: Query
   *     mutation: Mutation
   *     subscription: Subscription
   *   }
   *
   *   extend schema @auth
   * `);
   *
   * const schema = new GraphQLSchema({
   *   description: 'Operations exposed by the application.',
   *   query: Query,
   *   mutation: Mutation,
   *   subscription: Subscription,
   *   types: [AuditEvent],
   *   directives: [authDirective],
   *   extensions: { owner: 'platform' },
   *   astNode: schemaDocument.definitions[0],
   *   extensionASTNodes: [ schemaDocument.definitions[1] ],
   *   assumeValid: true,
   * });
   *
   * schema.getMutationType(); // => Mutation
   * schema.getSubscriptionType(); // => Subscription
   * schema.getType('AuditEvent'); // => AuditEvent
   * schema.getDirective('auth'); // => authDirective
   * schema.extensions; // => { owner: 'platform' }
   * ```
   */
  constructor(config: Readonly<GraphQLSchemaConfig>) {
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    this.assumeValid = config.assumeValid ?? false;
    // Used as a cache for validateSchema().
    this.__validationErrors = config.assumeValid === true ? [] : undefined;

    this.description = config.description;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives ?? specifiedDirectives;

    // To preserve order of user-provided types, we add first to add them to
    // the set of "collected" types, so `collectReferencedTypes` ignore them.
    const allReferencedTypes = new Set<GraphQLNamedType>(config.types);
    if (config.types != null) {
      for (const type of config.types) {
        // When we ready to process this type, we remove it from "collected" types
        // and then add it together with all dependent types in the correct position.
        allReferencedTypes.delete(type);
        collectReferencedTypes(type, allReferencedTypes);
      }
    }

    if (this._queryType != null) {
      collectReferencedTypes(this._queryType, allReferencedTypes);
    }
    if (this._mutationType != null) {
      collectReferencedTypes(this._mutationType, allReferencedTypes);
    }
    if (this._subscriptionType != null) {
      collectReferencedTypes(this._subscriptionType, allReferencedTypes);
    }

    for (const directive of this._directives) {
      // Directives are not validated until validateSchema() is called.
      if (isDirective(directive)) {
        for (const arg of directive.args) {
          collectReferencedTypes(arg.type, allReferencedTypes);
        }
      }
    }
    collectReferencedTypes(__Schema, allReferencedTypes);

    // Storing the resulting map for reference by the schema.
    this._typeMap = Object.create(null);
    this._subTypeMap = new Map();
    // Keep track of all implementations by interface name.
    this._implementationsMap = Object.create(null);

    for (const namedType of allReferencedTypes) {
      if (namedType == null) {
        continue;
      }

      const typeName = namedType.name;
      if (this._typeMap[typeName] !== undefined) {
        throw new Error(
          `Schema must contain uniquely named types but contains multiple types named "${typeName}".`,
        );
      }
      this._typeMap[typeName] = namedType;

      if (isInterfaceType(namedType)) {
        // Store implementations by interface.
        for (const iface of namedType.getInterfaces()) {
          if (isInterfaceType(iface)) {
            let implementations = this._implementationsMap[iface.name];
            implementations ??= this._implementationsMap[iface.name] = {
              objects: [],
              interfaces: [],
            };

            implementations.interfaces.push(namedType);
          }
        }
      } else if (isObjectType(namedType)) {
        // Store implementations by objects.
        for (const iface of namedType.getInterfaces()) {
          if (isInterfaceType(iface)) {
            let implementations = this._implementationsMap[iface.name];
            implementations ??= this._implementationsMap[iface.name] = {
              objects: [],
              interfaces: [],
            };

            implementations.objects.push(namedType);
          }
        }
      }
    }
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLSchema';
  }

  /**
   * Returns the root object type for query operations.
   * @returns The query root type, if this schema defines one.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   *
   * schema.getQueryType()?.name; // => 'Query'
   * ```
   */
  getQueryType(): Maybe<GraphQLObjectType> {
    return this._queryType;
  }

  /**
   * Returns the root object type for mutation operations.
   * @returns The mutation root type, if this schema defines one.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   *
   *   type Mutation {
   *     setGreeting(value: String!): String
   *   }
   * `);
   *
   * schema.getMutationType()?.name; // => 'Mutation'
   * ```
   */
  getMutationType(): Maybe<GraphQLObjectType> {
    return this._mutationType;
  }

  /**
   * Returns the root object type for subscription operations.
   * @returns The subscription root type, if this schema defines one.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   *
   *   type Subscription {
   *     greetings: String
   *   }
   * `);
   *
   * schema.getSubscriptionType()?.name; // => 'Subscription'
   * ```
   */
  getSubscriptionType(): Maybe<GraphQLObjectType> {
    return this._subscriptionType;
  }

  /**
   * Returns the root object type for the requested operation kind.
   * @param operation - Operation kind to resolve.
   * @returns The root object type for the operation kind, if this schema defines one.
   * @example
   * ```ts
   * import { OperationTypeNode } from 'graphql/language';
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   *
   *   type Mutation {
   *     setGreeting(value: String!): String
   *   }
   * `);
   *
   * schema.getRootType(OperationTypeNode.QUERY)?.name; // => 'Query'
   * schema.getRootType(OperationTypeNode.MUTATION)?.name; // => 'Mutation'
   * schema.getRootType(OperationTypeNode.SUBSCRIPTION); // => undefined
   * ```
   */
  getRootType(operation: OperationTypeNode): Maybe<GraphQLObjectType> {
    switch (operation) {
      case OperationTypeNode.QUERY:
        return this.getQueryType();
      case OperationTypeNode.MUTATION:
        return this.getMutationType();
      case OperationTypeNode.SUBSCRIPTION:
        return this.getSubscriptionType();
    }
  }

  /**
   * Returns all named types known to this schema.
   * @returns A map of schema types keyed by type name.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type User {
   *     name: String
   *   }
   *
   *   type Query {
   *     viewer: User
   *   }
   * `);
   *
   * const typeMap = schema.getTypeMap();
   *
   * typeMap.User.name; // => 'User'
   * typeMap.Query.name; // => 'Query'
   * typeMap.String.name; // => 'String'
   * ```
   */
  getTypeMap(): TypeMap {
    return this._typeMap;
  }

  /**
   * Returns the named type with the provided name.
   * @param name - The GraphQL name to look up.
   * @returns The named schema type, if one exists.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type User {
   *     name: String
   *   }
   *
   *   type Query {
   *     viewer: User
   *   }
   * `);
   *
   * schema.getType('User')?.toString(); // => 'User'
   * schema.getType('Missing'); // => undefined
   * ```
   */
  getType(name: string): GraphQLNamedType | undefined {
    return this.getTypeMap()[name];
  }

  /**
   * Returns object types that may be returned for an abstract type.
   * @param abstractType - Interface or union type to inspect.
   * @returns Object types that may satisfy the abstract type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInterfaceType, assertUnionType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Node {
   *     id: ID!
   *   }
   *
   *   type User implements Node {
   *     id: ID!
   *   }
   *
   *   type Organization implements Node {
   *     id: ID!
   *   }
   *
   *   union SearchResult = User | Organization
   *
   *   type Query {
   *     node: Node
   *     search: [SearchResult]
   *   }
   * `);
   *
   * const Node = assertInterfaceType(schema.getType('Node'));
   * const SearchResult = assertUnionType(schema.getType('SearchResult'));
   *
   * schema.getPossibleTypes(Node).map((type) => type.name); // => ['User', 'Organization']
   * schema.getPossibleTypes(SearchResult).map((type) => type.name); // => ['User', 'Organization']
   * ```
   */
  getPossibleTypes(
    abstractType: GraphQLAbstractType,
  ): ReadonlyArray<GraphQLObjectType> {
    return isUnionType(abstractType)
      ? abstractType.getTypes()
      : this.getImplementations(abstractType).objects;
  }

  /**
   * Returns objects and interfaces that implement an interface type.
   * @param interfaceType - Interface type to inspect.
   * @returns Object and interface implementations of the interface.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInterfaceType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Resource {
   *     url: String!
   *   }
   *
   *   interface Image implements Resource {
   *     url: String!
   *     width: Int
   *   }
   *
   *   type Photo implements Resource & Image {
   *     url: String!
   *     width: Int
   *   }
   *
   *   type Query {
   *     resource: Resource
   *   }
   * `);
   *
   * const Resource = assertInterfaceType(schema.getType('Resource'));
   * const implementations = schema.getImplementations(Resource);
   *
   * implementations.interfaces.map((type) => type.name); // => ['Image']
   * implementations.objects.map((type) => type.name); // => ['Photo']
   * ```
   */
  getImplementations(interfaceType: GraphQLInterfaceType): {
    objects: ReadonlyArray<GraphQLObjectType>;
    interfaces: ReadonlyArray<GraphQLInterfaceType>;
  } {
    const implementations = this._implementationsMap[interfaceType.name];
    return implementations ?? { objects: [], interfaces: [] };
  }

  /**
   * Returns whether one type is a possible runtime subtype of an abstract type.
   * @param abstractType - Interface or union type to inspect.
   * @param maybeSubType - Object or interface type to test as a possible subtype.
   * @returns True when the subtype may satisfy the abstract type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInterfaceType, assertObjectType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Node {
   *     id: ID!
   *   }
   *
   *   type User implements Node {
   *     id: ID!
   *   }
   *
   *   type Review {
   *     body: String
   *   }
   *
   *   type Query {
   *     node: Node
   *     review: Review
   *   }
   * `);
   *
   * const Node = assertInterfaceType(schema.getType('Node'));
   * const User = assertObjectType(schema.getType('User'));
   * const Review = assertObjectType(schema.getType('Review'));
   *
   * schema.isSubType(Node, User); // => true
   * schema.isSubType(Node, Review); // => false
   * ```
   */
  isSubType(
    abstractType: GraphQLAbstractType,
    maybeSubType: GraphQLObjectType | GraphQLInterfaceType,
  ): boolean {
    let set = this._subTypeMap.get(abstractType);
    if (set === undefined) {
      if (isUnionType(abstractType)) {
        set = new Set<GraphQLObjectType>(abstractType.getTypes());
      } else {
        const implementations = this.getImplementations(abstractType);
        set = new Set<GraphQLObjectType | GraphQLInterfaceType>([
          ...implementations.objects,
          ...implementations.interfaces,
        ]);
      }

      this._subTypeMap.set(abstractType, set);
    }
    return set.has(maybeSubType);
  }

  /**
   * Returns directives available in this schema.
   * @returns Directives available in this schema.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   directive @upper on FIELD_DEFINITION
   *
   *   type Query {
   *     greeting: String @upper
   *   }
   * `);
   *
   * schema.getDirectives().map((directive) => directive.name); // => ['include', 'skip', 'deprecated', 'specifiedBy', 'oneOf', 'upper']
   * ```
   */
  getDirectives(): ReadonlyArray<GraphQLDirective> {
    return this._directives;
  }

  /**
   * Returns the current directive definition.
   * @param name - The GraphQL name to look up.
   * @returns The current directive definition, if known.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   directive @upper on FIELD_DEFINITION
   *
   *   type Query {
   *     greeting: String @upper
   *   }
   * `);
   *
   * schema.getDirective('upper')?.name; // => 'upper'
   * schema.getDirective('missing'); // => undefined
   * ```
   */
  getDirective(name: string): Maybe<GraphQLDirective> {
    return this.getDirectives().find((directive) => directive.name === name);
  }

  /**
   * This method looks up the field on the given type definition.
   * It has special casing for the three introspection fields, `__schema`,
   * `__type` and `__typename`.
   *
   * `__typename` is special because it can always be queried as a field, even
   * in situations where no other fields are allowed, like on a Union.
   *
   * `__schema` and `__type` could get automatically added to the query type,
   * but that would require mutating type definitions, which would cause issues.
   * @param parentType - Composite type to look up the field on.
   * @param fieldName - Field name to look up.
   * @returns The field definition, including supported introspection fields.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const queryType = schema.getQueryType();
   *
   * schema.getField(queryType, 'greeting')?.name; // => 'greeting'
   * schema.getField(queryType, '__typename')?.name; // => '__typename'
   * schema.getField(queryType, 'missing'); // => undefined
   * ```
   */
  getField(
    parentType: GraphQLCompositeType,
    fieldName: string,
  ): GraphQLField<unknown, unknown> | undefined {
    switch (fieldName) {
      case SchemaMetaFieldDef.name:
        return this.getQueryType() === parentType
          ? SchemaMetaFieldDef
          : undefined;
      case TypeMetaFieldDef.name:
        return this.getQueryType() === parentType
          ? TypeMetaFieldDef
          : undefined;
      case TypeNameMetaFieldDef.name:
        return TypeNameMetaFieldDef;
    }

    // this function is part "hot" path inside executor and check presence
    // of 'getFields' is faster than to use `!isUnionType`
    if ('getFields' in parentType) {
      return parentType.getFields()[fieldName];
    }
    return undefined;
  }

  /**
   * Returns a normalized configuration object for this object.
   *
   * The returned config preserves the original `assumeValid` flag so the schema
   * can be recreated with the same validation behavior.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { GraphQLSchema } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   *
   * const config = schema.toConfig();
   * const schemaCopy = new GraphQLSchema(config);
   *
   * config.query?.name; // => 'Query'
   * schemaCopy.getQueryType()?.name; // => 'Query'
   * ```
   */
  toConfig(): GraphQLSchemaNormalizedConfig {
    return {
      description: this.description,
      query: this.getQueryType(),
      mutation: this.getMutationType(),
      subscription: this.getSubscriptionType(),
      types: Object.values(this.getTypeMap()),
      directives: this.getDirectives(),
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      assumeValid: this.assumeValid,
    };
  }
}

type TypeMap = ObjMap<GraphQLNamedType>;

/** @internal */
export interface GraphQLSchemaValidationOptions {
  /**
   * When building a schema from a GraphQL service's introspection result, it
   * might be safe to assume the schema is valid. Set to true to assume the
   * produced schema is valid.
   *
   * Default: false
   *
   * @internal
   */
  assumeValid?: boolean | undefined;
}

/** Configuration used to construct a GraphQLSchema. */
export interface GraphQLSchemaConfig extends GraphQLSchemaValidationOptions {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Root object type for query operations. */
  query?: Maybe<GraphQLObjectType>;
  /** Root object type for mutation operations. */
  mutation?: Maybe<GraphQLObjectType>;
  /** Root object type for subscription operations. */
  subscription?: Maybe<GraphQLObjectType>;
  /** Object types that belong to this union type. */
  types?: Maybe<ReadonlyArray<GraphQLNamedType>>;
  /** Directives available in this schema or applied to this AST node. */
  directives?: Maybe<ReadonlyArray<GraphQLDirective>>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLSchemaExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<SchemaDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<SchemaExtensionNode>>;
}

/** @internal */
export interface GraphQLSchemaNormalizedConfig extends GraphQLSchemaConfig {
  description: Maybe<string>;
  types: ReadonlyArray<GraphQLNamedType>;
  directives: ReadonlyArray<GraphQLDirective>;
  extensions: Readonly<GraphQLSchemaExtensions>;
  extensionASTNodes: ReadonlyArray<SchemaExtensionNode>;
  assumeValid: boolean;
}

function collectReferencedTypes(
  type: GraphQLType,
  typeSet: Set<GraphQLNamedType>,
): Set<GraphQLNamedType> {
  const namedType = getNamedType(type);

  if (!typeSet.has(namedType)) {
    typeSet.add(namedType);
    if (isUnionType(namedType)) {
      for (const memberType of namedType.getTypes()) {
        collectReferencedTypes(memberType, typeSet);
      }
    } else if (isObjectType(namedType) || isInterfaceType(namedType)) {
      for (const interfaceType of namedType.getInterfaces()) {
        collectReferencedTypes(interfaceType, typeSet);
      }

      for (const field of Object.values(namedType.getFields())) {
        collectReferencedTypes(field.type, typeSet);
        for (const arg of field.args) {
          collectReferencedTypes(arg.type, typeSet);
        }
      }
    } else if (isInputObjectType(namedType)) {
      for (const field of Object.values(namedType.getFields())) {
        collectReferencedTypes(field.type, typeSet);
      }
    }
  }

  return typeSet;
}
