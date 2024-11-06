import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { GraphQLError } from '../error/GraphQLError.js';
import type { DocumentNode, FieldNode, FragmentDefinitionNode, OperationDefinitionNode } from '../language/ast.js';
import type { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLResolveInfo, GraphQLTypeResolver } from '../type/definition.js';
import type { GraphQLSchema } from '../type/schema.js';
import { AbortSignalListener } from './AbortSignalListener.js';
import type { FieldDetailsList, FragmentDetails } from './collectFields.js';
import type { CancellableStreamRecord, ExecutionResult, ExperimentalIncrementalExecutionResults } from './types.js';
import type { VariableValues } from './values.js';
/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g `a`
 * 2) fragment "spreads" e.g. `...c`
 * 3) inline fragment "spreads" e.g. `...on Type { a }`
 */
/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export interface ValidatedExecutionArgs {
    schema: GraphQLSchema;
    fragmentDefinitions: ObjMap<FragmentDefinitionNode>;
    fragments: ObjMap<FragmentDetails>;
    rootValue: unknown;
    contextValue: unknown;
    operation: OperationDefinitionNode;
    variableValues: VariableValues;
    fieldResolver: GraphQLFieldResolver<any, any>;
    typeResolver: GraphQLTypeResolver<any, any>;
    subscribeFieldResolver: GraphQLFieldResolver<any, any>;
    perEventExecutor: (validatedExecutionArgs: ValidatedExecutionArgs) => PromiseOrValue<ExecutionResult>;
    enableEarlyExecution: boolean;
    hideSuggestions: boolean;
    abortSignal: AbortSignal | undefined;
}
export interface ExecutionContext {
    validatedExecutionArgs: ValidatedExecutionArgs;
    errors: Array<GraphQLError> | undefined;
    abortSignalListener: AbortSignalListener | undefined;
    completed: boolean;
    cancellableStreams: Set<CancellableStreamRecord> | undefined;
}
export interface ExecutionArgs {
    schema: GraphQLSchema;
    document: DocumentNode;
    rootValue?: unknown;
    contextValue?: unknown;
    variableValues?: Maybe<{
        readonly [variable: string]: unknown;
    }>;
    operationName?: Maybe<string>;
    fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
    typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
    subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
    perEventExecutor?: Maybe<(validatedExecutionArgs: ValidatedExecutionArgs) => PromiseOrValue<ExecutionResult>>;
    enableEarlyExecution?: Maybe<boolean>;
    hideSuggestions?: Maybe<boolean>;
    abortSignal?: Maybe<AbortSignal>;
}
export interface StreamUsage {
    label: string | undefined;
    initialCount: number;
    fieldDetailsList: FieldDetailsList;
}
/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, it will throw or return a rejected promise.
 * Use `experimentalExecuteIncrementally` if you want to support incremental
 * delivery.
 */
export declare function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult>;
/**
 * Implements the "Executing requests" section of the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
 *
 * This function returns a Promise of an ExperimentalIncrementalExecutionResults
 * object. This object either consists of a single ExecutionResult, or an
 * object containing an `initialResult` and a stream of `subsequentResults`.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export declare function experimentalExecuteIncrementally(args: ExecutionArgs): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
/**
 * Implements the "Executing operations" section of the spec.
 *
 * Returns a Promise that will eventually resolve to the data described by
 * The "Response" section of the GraphQL specification.
 *
 * If errors are encountered while executing a GraphQL field, only that
 * field and its descendants will be omitted, and sibling fields will still
 * be executed. An execution which encounters errors will still result in a
 * resolved Promise.
 *
 * Errors from sub-fields of a NonNull type may propagate to the top level,
 * at which point we still log the error and null the parent field, which
 * in this case is the entire response.
 */
export declare function executeQueryOrMutationOrSubscriptionEvent(validatedExecutionArgs: ValidatedExecutionArgs): PromiseOrValue<ExecutionResult>;
export declare function experimentalExecuteQueryOrMutationOrSubscriptionEvent(validatedExecutionArgs: ValidatedExecutionArgs): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export declare function executeSync(args: ExecutionArgs): ExecutionResult;
/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * TODO: consider no longer exporting this function
 * @internal
 */
export declare function validateExecutionArgs(args: ExecutionArgs): ReadonlyArray<GraphQLError> | ValidatedExecutionArgs;
/**
 * TODO: consider no longer exporting this function
 * @internal
 */
export declare function buildResolveInfo(validatedExecutionArgs: ValidatedExecutionArgs, fieldDef: GraphQLField<unknown, unknown>, fieldNodes: ReadonlyArray<FieldNode>, parentType: GraphQLObjectType, path: Path): GraphQLResolveInfo;
/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export declare const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown>;
/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export declare const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown>;
/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with descriptive
 * errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription resolver
 * logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, a field error will be raised at the location of the `@defer` or
 * `@stream` directive.
 *
 * Accepts an object with named arguments.
 */
export declare function subscribe(args: ExecutionArgs): PromiseOrValue<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult>;
export declare function executeSubscriptionEvent(validatedExecutionArgs: ValidatedExecutionArgs): PromiseOrValue<ExecutionResult>;
/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream.
 *
 * Returns a Promise which resolves to either an AsyncIterable (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to the AsyncIterable for the
 * event stream returned by the resolver.
 *
 * A Source Event Stream represents a sequence of events, each of which triggers
 * a GraphQL execution for that event.
 *
 * This may be useful when hosting the stateful subscription service in a
 * different process or machine than the stateless GraphQL execution engine,
 * or otherwise separating these two steps. For more on this, see the
 * "Supporting Subscriptions at Scale" information in the GraphQL specification.
 */
export declare function createSourceEventStream(args: ExecutionArgs): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult>;
