import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import type { GraphQLFormattedError } from '../error/GraphQLError.js';
import { GraphQLError } from '../error/GraphQLError.js';
import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';
import type {
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from '../type/definition.js';
import type { GraphQLSchema } from '../type/schema.js';
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
export interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: {
    [variable: string]: unknown;
  };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  errors: Array<GraphQLError>;
  subsequentPayloads: Set<AsyncPayloadRecord>;
}
/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 *   - `incremental` is a list of the results from defer/stream directives.
 */
export interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}
export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}
export interface ExperimentalIncrementalExecutionResults<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TData, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TData, TExtensions>,
    void,
    void
  >;
}
export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface SubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface FormattedSubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
  label?: string;
}
export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
  label?: string;
}
export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
export declare type IncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;
export declare type FormattedIncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TData, TExtensions>;
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
 * function, it will throw or resolve to an object containing an error instead.
 * Use `experimentalExecuteIncrementally` if you want to support incremental
 * delivery.
 */
export declare function execute(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult>;
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
export declare function experimentalExecuteIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
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
export declare function buildExecutionContext(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ExecutionContext;
/**
 * TODO: consider no longer exporting this function
 * @internal
 */
export declare function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNodes: ReadonlyArray<FieldNode>,
  parentType: GraphQLObjectType,
  path: Path,
): GraphQLResolveInfo;
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
export declare const defaultFieldResolver: GraphQLFieldResolver<
  unknown,
  unknown
>;
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
 * function, each `InitialIncrementalExecutionResult` and
 * `SubsequentIncrementalExecutionResult` in the result stream will be replaced
 * with an `ExecutionResult` with a single error stating that defer/stream is
 * not supported.  Use `experimentalSubscribeIncrementally` if you want to
 * support incremental delivery.
 *
 * Accepts an object with named arguments.
 */
export declare function subscribe(
  args: ExecutionArgs,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
>;
/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
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
 * yields a stream of result representing the response stream.
 *
 * Each result may be an ExecutionResult with no `hasNext` (if executing the
 * event did not use `@defer` or `@stream`), or an
 * `InitialIncrementalExecutionResult` or `SubsequentIncrementalExecutionResult`
 * (if executing the event used `@defer` or `@stream`). In the case of
 * incremental execution results, each event produces a single
 * `InitialIncrementalExecutionResult` followed by one or more
 * `SubsequentIncrementalExecutionResult`s; all but the last have `hasNext: true`,
 * and the last has `hasNext: false`. There is no interleaving between results
 * generated from the same original event.
 *
 * Accepts an object with named arguments.
 */
export declare function experimentalSubscribeIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<
  | AsyncGenerator<
      | ExecutionResult
      | InitialIncrementalExecutionResult
      | SubsequentIncrementalExecutionResult,
      void,
      void
    >
  | ExecutionResult
>;
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
export declare function createSourceEventStream(
  args: ExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult>;
declare class DeferredFragmentRecord {
  type: 'defer';
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  promise: Promise<void>;
  data: ObjMap<unknown> | null;
  parentContext: AsyncPayloadRecord | undefined;
  isCompleted: boolean;
  _exeContext: ExecutionContext;
  _resolve?: (arg: PromiseOrValue<ObjMap<unknown> | null>) => void;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    parentContext: AsyncPayloadRecord | undefined;
    exeContext: ExecutionContext;
  });
  addData(data: PromiseOrValue<ObjMap<unknown> | null>): void;
}
declare class StreamRecord {
  type: 'stream';
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  items: Array<unknown> | null;
  promise: Promise<void>;
  parentContext: AsyncPayloadRecord | undefined;
  iterator: AsyncIterator<unknown> | undefined;
  isCompletedIterator?: boolean;
  isCompleted: boolean;
  _exeContext: ExecutionContext;
  _resolve?: (arg: PromiseOrValue<Array<unknown> | null>) => void;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    iterator?: AsyncIterator<unknown>;
    parentContext: AsyncPayloadRecord | undefined;
    exeContext: ExecutionContext;
  });
  addItems(items: PromiseOrValue<Array<unknown> | null>): void;
  setIsCompletedIterator(): void;
}
declare type AsyncPayloadRecord = DeferredFragmentRecord | StreamRecord;
export {};
