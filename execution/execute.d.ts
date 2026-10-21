/** @category Execution */
import type { PromiseOrValue } from "../jsutils/PromiseOrValue.js";
import { GraphQLError } from "../error/GraphQLError.js";
import type { GraphQLFieldResolver, GraphQLTypeResolver } from "../type/index.js";
import type { ExecutionArgs, ValidatedExecutionArgs, ValidatedSubscriptionArgs } from "./ExecutionArgs.js";
import type { ExecutionResult } from "./Executor.js";
import type { ExperimentalIncrementalExecutionResults } from "./incremental/IncrementalExecutor.js";
/** Function used to execute a validated root selection set for a subscription event. */
export type RootSelectionSetExecutor = (validatedExecutionArgs: ValidatedSubscriptionArgs) => PromiseOrValue<ExecutionResult>;
/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the schema is invalid, an error will be thrown immediately. GraphQL
 * request errors, including missing operations and variable coercion errors,
 * are returned in an errors-only ExecutionResult.
 *
 * Field errors are collected into the response instead of rejecting the
 * returned promise. Only the field that produced the error and its descendants
 * are omitted; sibling fields continue to execute. Errors from fields of
 * non-null type may propagate to the nearest nullable parent, which can be the
 * entire response data.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * Use `experimentalExecuteIncrementally` to execute operations with
 * incremental delivery enabled.
 * @param args - The arguments used to perform the operation.
 * @returns A completed execution result, or a promise resolving to one when execution is asynchronous.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { execute } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting(name: String!): String
 *   }
 * `);
 *
 * const result = await execute({
 *   schema,
 *   document: parse('query ($name: String!) { greeting(name: $name) }'),
 *   rootValue: {
 *     greeting: ({ name }) => `Hello, ${name}!`,
 *   },
 *   variableValues: { name: 'Ada' },
 * }); // => { data: { greeting: 'Hello, Ada!' } }
 * ```
 */
export declare function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult>;
/**
 * Implements the "Executing requests" section of the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
 *
 * This function returns either a single ExecutionResult, or an
 * ExperimentalIncrementalExecutionResults object containing an `initialResult`
 * and a stream of `subsequentResults`.
 *
 * If the schema is invalid, an error will be thrown immediately. GraphQL
 * request errors, including missing operations and variable coercion errors,
 * are returned in an errors-only ExecutionResult.
 * @param args - Execution arguments for the GraphQL operation.
 * @returns A single execution result or incremental execution results.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { experimentalExecuteIncrementally } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 *
 * const result = await experimentalExecuteIncrementally({
 *   schema,
 *   document: parse('{ greeting }'),
 *   rootValue: { greeting: 'Hello' },
 * }); // => { data: { greeting: 'Hello' } }
 * ```
 * @category Incremental Execution
 */
export declare function experimentalExecuteIncrementally(args: ExecutionArgs): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
/** @internal */
export declare function executeIgnoringIncremental(args: ExecutionArgs): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
/**
 * Implements the "Executing operations" section of the spec.
 *
 * Returns either a synchronous ExecutionResult, or a Promise for an
 * ExecutionResult, described by the "Response" section of the GraphQL
 * specification.
 *
 * If errors are encountered while executing a GraphQL field, only that field
 * and its descendants will be omitted, and sibling fields will still be
 * executed. These field errors are collected into the returned result instead
 * of being thrown or rejecting the returned promise.
 *
 * Errors from sub-fields of a NonNull type may propagate to the top level, at
 * which point we still collect the error and null the parent field, which in
 * this case is the entire response.
 * @param validatedExecutionArgs - Validated execution arguments.
 * @returns Execution result for the operation root selection set.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   executeRootSelectionSet,
 *   validateExecutionArgs,
 * } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 * const validatedArgs = validateExecutionArgs({
 *   schema,
 *   document: parse('{ greeting }'),
 *   rootValue: { greeting: 'Hello' },
 * });
 *
 * assert('schema' in validatedArgs);
 *
 * const result = await executeRootSelectionSet(validatedArgs); // => { data: { greeting: 'Hello' } }
 * ```
 */
export declare function executeRootSelectionSet(validatedExecutionArgs: ValidatedExecutionArgs): PromiseOrValue<ExecutionResult>;
/**
 * Executes the operation root selection set with incremental delivery enabled.
 * @param validatedExecutionArgs - Validated execution arguments.
 * @returns A single execution result or incremental execution results.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   experimentalExecuteRootSelectionSet,
 *   validateExecutionArgs,
 * } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 * const validatedArgs = validateExecutionArgs({
 *   schema,
 *   document: parse('{ greeting }'),
 *   rootValue: { greeting: 'Hello' },
 * });
 *
 * assert('schema' in validatedArgs);
 *
 * const result = await experimentalExecuteRootSelectionSet(validatedArgs); // => { data: { greeting: 'Hello' } }
 * ```
 * @category Incremental Execution
 */
export declare function experimentalExecuteRootSelectionSet(validatedExecutionArgs: ValidatedExecutionArgs): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
/** @internal */
export declare function executeRootSelectionSetIgnoringIncremental(validatedExecutionArgs: ValidatedExecutionArgs): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 * @param args - The arguments used to perform the operation.
 * @returns Completed execution output for a synchronous operation.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { executeSync } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 *
 * const result = executeSync({
 *   schema,
 *   document: parse('{ greeting }'),
 *   rootValue: { greeting: 'Hello' },
 * }); // => { data: { greeting: 'Hello' } }
 * ```
 */
export declare function executeSync(args: ExecutionArgs): ExecutionResult;
/**
 * Executes a subscription operation once for a single source event.
 *
 * Field errors are collected into the returned result instead of being thrown
 * or rejecting the returned promise.
 * @param validatedExecutionArgs - Validated subscription execution arguments.
 * @returns Execution result for the subscription event.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   executeSubscriptionEvent,
 *   validateSubscriptionArgs,
 * } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting: String
 *   }
 * `);
 * const validatedArgs = validateSubscriptionArgs({
 *   schema,
 *   document: parse('subscription { greeting }'),
 *   rootValue: { greeting: 'Hello' },
 * });
 *
 * assert('schema' in validatedArgs);
 *
 * const result = await executeSubscriptionEvent(validatedArgs); // => { data: { greeting: 'Hello' } }
 * ```
 */
export declare function executeSubscriptionEvent(validatedExecutionArgs: ValidatedSubscriptionArgs): PromiseOrValue<ExecutionResult>;
/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns either an AsyncGenerator (if successful), an ExecutionResult (error),
 * or a Promise for one of those results. The call will throw immediately if
 * the schema is invalid or the selected operation is not a subscription.
 *
 * GraphQL request errors, including missing operations and variable coercion
 * errors, return or resolve to a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data.
 *
 * If the source stream could not be created due to faulty subscription resolver
 * logic, a non-async-iterable resolver result, or a system error, the
 * function will return or resolve to a single ExecutionResult containing
 * `errors` and no `data`.
 *
 * If the operation succeeded, the function returns or resolves to an
 * AsyncGenerator, which yields a stream of ExecutionResults representing the
 * response stream.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, a field error will be raised at the location of the `@defer` or
 * `@stream` directive.
 *
 * Accepts an object with named arguments.
 * @param args - Execution arguments for the subscription operation.
 * @returns A response stream for a valid subscription, or an execution result containing errors.
 * @example
 * ```ts
 * // Use a same-named rootValue function to provide the source event stream.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { subscribe } from 'graphql/execution';
 *
 * async function* greetings() {
 *   yield { greeting: 'Hello' };
 *   yield { greeting: 'Bonjour' };
 * }
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting: String
 *   }
 * `);
 *
 * const result = await subscribe({
 *   schema,
 *   document: parse('subscription { greeting }'),
 *   rootValue: { greeting: () => greetings() },
 * });
 *
 * assert('next' in result);
 *
 * const firstPayload = await result.next();
 * firstPayload.value; // => { data: { greeting: 'Hello' } }
 * ```
 * @example
 * ```ts
 * // This variant supplies events through a custom subscribeFieldResolver.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { subscribe } from 'graphql/execution';
 *
 * async function* defaultGreetings() {
 *   yield { greeting: 'Hello' };
 * }
 *
 * async function* frenchGreetings() {
 *   yield { greeting: 'Bonjour' };
 * }
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting(locale: String): String
 *   }
 * `);
 *
 * const result = await subscribe({
 *   schema,
 *   document: parse(
 *     'subscription Greeting($locale: String) { greeting(locale: $locale) }',
 *   ),
 *   rootValue: {
 *     greeting: (args, contextValue) => {
 *       const locale = args.locale ?? contextValue.defaultLocale;
 *       return locale === 'fr' ? frenchGreetings() : defaultGreetings();
 *     },
 *   },
 *   contextValue: { defaultLocale: 'fr' },
 *   variableValues: { locale: 'fr' },
 *   operationName: 'Greeting',
 *   subscribeFieldResolver: (rootValue, args, contextValue, info) => {
 *     args.locale; // => 'fr'
 *     return rootValue[info.fieldName](args, contextValue);
 *   },
 * });
 *
 * assert('next' in result);
 *
 * const firstPayload = await result.next();
 * firstPayload.value; // => { data: { greeting: 'Bonjour' } }
 * ```
 */
export declare function subscribe(args: ExecutionArgs): PromiseOrValue<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult>;
/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream for a
 * previously validated subscription request.
 *
 * Returns either an AsyncIterable (if successful), an ExecutionResult (error),
 * or a Promise for one of those results. The call will throw immediately if
 * it is not passed validated execution arguments.
 *
 * If the validated arguments do not result in a compliant subscription, a
 * GraphQL Response (ExecutionResult) with descriptive errors and no data will
 * be returned.
 *
 * If the source stream could not be created due to faulty subscription
 * resolver logic or a system error, the function will return or
 * resolve to a single ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the function returns or resolves to the
 * AsyncIterable for the event stream returned by the resolver.
 *
 * A Source Event Stream represents a sequence of events, each of which triggers
 * a GraphQL execution for that event.
 *
 * This may be useful when hosting the stateful subscription service in a
 * different process or machine than the stateless GraphQL execution engine,
 * or otherwise separating these two steps. For more on this, see the
 * "Supporting Subscriptions at Scale" information in the GraphQL specification.
 * @param validatedExecutionArgs - Validated subscription execution arguments.
 * @returns A source event stream, or an execution result containing errors.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   createSourceEventStream,
 *   validateSubscriptionArgs,
 * } from 'graphql/execution';
 *
 * async function* greetings() {
 *   yield { greeting: 'Hello' };
 * }
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting: String
 *   }
 * `);
 * const validatedArgs = validateSubscriptionArgs({
 *   schema,
 *   document: parse('subscription { greeting }'),
 *   rootValue: { greeting: () => greetings() },
 * });
 *
 * assert('schema' in validatedArgs);
 *
 * const stream = await createSourceEventStream(validatedArgs);
 * Symbol.asyncIterator in stream; // => true
 * ```
 */
export declare function createSourceEventStream(validatedExecutionArgs: ValidatedSubscriptionArgs): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult>;
/**
 * Validates the arguments passed to execute, subscribe, and their lower-level
 * helpers.
 *
 * Throws if the schema is invalid. GraphQL request errors, including variable
 * coercion errors, are returned as a GraphQLError array.
 * @param args - Execution arguments to validate.
 * @returns Validated execution arguments, or validation errors.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { validateExecutionArgs } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   interface Named {
 *     name: String!
 *   }
 *
 *   type User implements Named {
 *     name: String!
 *   }
 *
 *   type Query {
 *     viewer: Named
 *   }
 * `);
 * const abortController = new AbortController();
 * const validatedArgs = validateExecutionArgs({
 *   schema,
 *   document: parse('query Viewer { viewer { __typename name } }'),
 *   rootValue: { viewer: { kind: 'user', name: 'Ada' } },
 *   contextValue: { locale: 'en' },
 *   operationName: 'Viewer',
 *   fieldResolver: (source, _args, _contextValue, info) => {
 *     return source[info.fieldName];
 *   },
 *   typeResolver: (value) => {
 *     return value.kind === 'user' ? 'User' : undefined;
 *   },
 *   hideSuggestions: true,
 *   abortSignal: abortController.signal,
 *   enableEarlyExecution: true,
 *   hooks: {
 *     asyncWorkFinished: () => {},
 *   },
 *   options: { maxCoercionErrors: 1 },
 * });
 *
 * assert('operation' in validatedArgs);
 *
 * validatedArgs.contextValue.locale; // => 'en'
 * validatedArgs.operation.name?.value; // => 'Viewer'
 * validatedArgs.hideSuggestions; // => true
 * ```
 */
export declare function validateExecutionArgs(args: ExecutionArgs): ReadonlyArray<GraphQLError> | ValidatedExecutionArgs;
/**
 * Validates execution arguments for a subscription operation.
 *
 * Throws if the schema is invalid or the selected operation is not a
 * subscription. GraphQL request errors, including variable coercion errors, are
 * returned as a GraphQLError array.
 * @param args - Execution arguments to validate.
 * @returns Validated subscription execution arguments, or validation errors.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { validateSubscriptionArgs } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting: String
 *   }
 * `);
 * const validatedArgs = validateSubscriptionArgs({
 *   schema,
 *   document: parse('subscription { greeting }'),
 * });
 *
 * assert('operation' in validatedArgs);
 *
 * validatedArgs.operation.operation; // => 'subscription'
 * ```
 */
export declare function validateSubscriptionArgs(args: ExecutionArgs): ReadonlyArray<GraphQLError> | ValidatedSubscriptionArgs;
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
 * Implements the "MapSourceToResponseEvent" algorithm described in the
 * GraphQL specification, mapping each event from a subscription source event
 * stream to an ExecutionResult in the response stream.
 * @param validatedExecutionArgs - Validated subscription execution arguments.
 * @param sourceEventStream - Source event stream returned by the subscription resolver.
 * @param rootSelectionSetExecutor - Function used to execute each source event.
 * @returns A response stream of execution results.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   mapSourceToResponseEvent,
 *   validateSubscriptionArgs,
 * } from 'graphql/execution';
 *
 * async function* events() {
 *   yield { greeting: 'Hello' };
 * }
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting: String
 *   }
 * `);
 * const validatedArgs = validateSubscriptionArgs({
 *   schema,
 *   document: parse('subscription { greeting }'),
 * });
 *
 * assert('schema' in validatedArgs);
 *
 * const responseStream = mapSourceToResponseEvent(validatedArgs, events());
 * const firstPayload = await responseStream.next();
 *
 * firstPayload.value; // => { data: { greeting: 'Hello' } }
 * ```
 */
export declare function mapSourceToResponseEvent(validatedExecutionArgs: ValidatedSubscriptionArgs, sourceEventStream: AsyncIterable<unknown>, rootSelectionSetExecutor?: RootSelectionSetExecutor): AsyncGenerator<ExecutionResult, void, void>;
