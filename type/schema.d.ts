/** @category Schema */
import type { Maybe } from "../jsutils/Maybe.js";
import type { ObjMap } from "../jsutils/ObjMap.js";
import type { GraphQLError } from "../error/GraphQLError.js";
import type { SchemaDefinitionNode, SchemaExtensionNode } from "../language/ast.js";
import { OperationTypeNode } from "../language/ast.js";
import type { GraphQLAbstractType, GraphQLCompositeType, GraphQLField, GraphQLInterfaceType, GraphQLNamedType, GraphQLObjectType } from "./definition.js";
import type { GraphQLDirective } from "./directives.js";
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
export declare function isSchema(schema: unknown): schema is GraphQLSchema;
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
export declare function assertSchema(schema: unknown): GraphQLSchema;
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
/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 * @example
 * ```ts
 * import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
 *
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
 * import {
 *   GraphQLInterfaceType,
 *   GraphQLObjectType,
 *   GraphQLSchema,
 *   GraphQLString,
 * } from 'graphql';
 *
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
 * import {
 *   DirectiveLocation,
 *   GraphQLDirective,
 *   GraphQLObjectType,
 *   GraphQLSchema,
 *   GraphQLString,
 *   specifiedDirectives,
 * } from 'graphql';
 *
 * const MyAppSchema = new GraphQLSchema({
 *   query: new GraphQLObjectType({
 *     name: 'Query',
 *     fields: { greeting: { type: GraphQLString } },
 *   }),
 *   directives: specifiedDirectives.concat([
 *     new GraphQLDirective({
 *       name: 'custom',
 *       locations: [DirectiveLocation.FIELD],
 *     }),
 *   ]),
 * });
 * ```
 */
export declare class GraphQLSchema {
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
    private _queryType;
    private _mutationType;
    private _subscriptionType;
    private _directives;
    private _typeMap;
    private _subTypeMap;
    private _implementationsMap;
    /**
     * Creates a GraphQLSchema instance.
     * @param config - Configuration describing this object.
     * @example
     * ```ts
     * // Create a schema with the required query root.
     * import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql/type';
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
     *   extensionASTNodes: [schemaDocument.definitions[1]],
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
    constructor(config: Readonly<GraphQLSchemaConfig>);
    /**
     * Returns the value used by `Object.prototype.toString`.
     * @returns The built-in string tag for this object.
     */
    get [Symbol.toStringTag](): string;
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
    getQueryType(): Maybe<GraphQLObjectType>;
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
    getMutationType(): Maybe<GraphQLObjectType>;
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
    getSubscriptionType(): Maybe<GraphQLObjectType>;
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
    getRootType(operation: OperationTypeNode): Maybe<GraphQLObjectType>;
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
    getTypeMap(): TypeMap;
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
    getType(name: string): GraphQLNamedType | undefined;
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
    getPossibleTypes(abstractType: GraphQLAbstractType): ReadonlyArray<GraphQLObjectType>;
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
    };
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
    isSubType(abstractType: GraphQLAbstractType, maybeSubType: GraphQLObjectType | GraphQLInterfaceType): boolean;
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
     * schema.getDirectives().map((directive) => directive.name); // => ['upper', 'include', 'skip', 'deprecated', 'specifiedBy', 'oneOf']
     * ```
     */
    getDirectives(): ReadonlyArray<GraphQLDirective>;
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
    getDirective(name: string): Maybe<GraphQLDirective>;
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
    getField(parentType: GraphQLCompositeType, fieldName: string): GraphQLField<unknown, unknown> | undefined;
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
    toConfig(): GraphQLSchemaNormalizedConfig;
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
    /** Additional named types to include in the schema. */
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
export {};
