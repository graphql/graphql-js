/** @category Execution */

import { inspect } from '../jsutils/inspect.ts';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import { isPromise, isPromiseLike } from '../jsutils/isPromise.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

import { ensureGraphQLError } from '../error/ensureGraphQLError.ts';
import { GraphQLError } from '../error/GraphQLError.ts';
import { locatedError } from '../error/locatedError.ts';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { isSubscriptionOperationDefinitionNode } from '../language/predicates.ts';

import { GraphQLDisableErrorPropagationDirective } from '../type/directives.ts';
import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/index.ts';
import { assertValidSchema } from '../type/index.ts';

import { buildResolveInfo } from './buildResolveInfo.ts';
import { cancellablePromise } from './cancellablePromise.ts';
import type { FieldDetailsList, FragmentDetails } from './collectFields.ts';
import { collectFields } from './collectFields.ts';
import { createSharedExecutionContext } from './createSharedExecutionContext.ts';
import type {
  ExecutionArgs,
  ValidatedExecutionArgs,
  ValidatedSubscriptionArgs,
} from './ExecutionArgs.ts';
import type { ExecutionResult } from './Executor.ts';
import { Executor } from './Executor.ts';
import { ExecutorThrowingOnIncremental } from './ExecutorThrowingOnIncremental.ts';
import { getVariableSignature } from './getVariableSignature.ts';
import type { ExperimentalIncrementalExecutionResults } from './incremental/IncrementalExecutor.ts';
import { IncrementalExecutor } from './incremental/IncrementalExecutor.ts';
import { mapAsyncIterable } from './mapAsyncIterable.ts';
import { getArgumentValues, getVariableValues } from './values.ts';

const UNEXPECTED_EXPERIMENTAL_DIRECTIVES =
  'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.';

/** Function used to execute a validated root selection set for a subscription event. */
export type RootSelectionSetExecutor = (
  validatedExecutionArgs: ValidatedSubscriptionArgs,
) => PromiseOrValue<ExecutionResult>;

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
 * });
 *
 * result; // => { data: { greeting: 'Hello, Ada!' } }
 * ```
 */
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  if (args.schema.getDirective('defer') || args.schema.getDirective('stream')) {
    throw new Error(UNEXPECTED_EXPERIMENTAL_DIRECTIVES);
  }

  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return executeRootSelectionSet(validatedExecutionArgs);
}

/**
 * Implements the "Executing requests" section of the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
 *
 * This function returns either a single ExecutionResult, or an
 * ExperimentalIncrementalExecutionResults object containing an `initialResult`
 * and a stream of `subsequentResults`.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
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
 * });
 *
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 * @category Incremental Execution
 */
export function experimentalExecuteIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return experimentalExecuteRootSelectionSet(validatedExecutionArgs);
}

/** @internal */
export function executeIgnoringIncremental(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return executeRootSelectionSetIgnoringIncremental(validatedExecutionArgs);
}

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
 * @param validatedExecutionArgs - Validated execution arguments.
 * @returns Execution result for the operation root selection set.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { executeRootSelectionSet, validateExecutionArgs } from 'graphql/execution';
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
 * const result = await executeRootSelectionSet(validatedArgs);
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 */
export function executeRootSelectionSet(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  return new ExecutorThrowingOnIncremental(
    validatedExecutionArgs,
  ).executeRootSelectionSet();
}

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
 * const result = await experimentalExecuteRootSelectionSet(validatedArgs);
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 * @category Incremental Execution
 */
export function experimentalExecuteRootSelectionSet(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  return new IncrementalExecutor(
    validatedExecutionArgs,
  ).executeRootSelectionSet();
}

/** @internal */
export function executeRootSelectionSetIgnoringIncremental(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  return new Executor(validatedExecutionArgs).executeRootSelectionSet();
}

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
 * });
 *
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = experimentalExecuteIncrementally(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || 'initialResult' in result) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

/**
 * Executes a subscription operation once for a single source event.
 * @param validatedExecutionArgs - Validated subscription execution arguments.
 * @returns Execution result for the subscription event.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { executeSubscriptionEvent, validateSubscriptionArgs } from 'graphql/execution';
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
 * const result = await executeSubscriptionEvent(validatedArgs);
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 */
export function executeSubscriptionEvent(
  validatedExecutionArgs: ValidatedSubscriptionArgs,
): PromiseOrValue<ExecutionResult> {
  return new ExecutorThrowingOnIncremental(
    validatedExecutionArgs,
  ).executeRootSelectionSet(false);
}

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise that resolves to either an AsyncIterator (if successful)
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
export function subscribe(
  args: ExecutionArgs,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateSubscriptionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  const resultOrStream = createSourceEventStream(validatedExecutionArgs);

  if (isPromise(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      isAsyncIterable(resolvedResultOrStream)
        ? mapSourceToResponseEvent(
            validatedExecutionArgs,
            resolvedResultOrStream,
          )
        : resolvedResultOrStream,
    );
  }

  return isAsyncIterable(resultOrStream)
    ? mapSourceToResponseEvent(validatedExecutionArgs, resultOrStream)
    : resultOrStream;
}

/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream for a
 * previously validated subscription request.
 *
 * Returns a Promise that resolves to either an AsyncIterable (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the validated
 * execution arguments are invalid, or if the resolved event stream is not an
 * async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription
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
 * @param validatedExecutionArgs - Validated subscription execution arguments.
 * @returns A source event stream, or an execution result containing errors.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { createSourceEventStream, validateSubscriptionArgs } from 'graphql/execution';
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
export function createSourceEventStream(
  validatedExecutionArgs: ValidatedSubscriptionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  if (!('operation' in validatedExecutionArgs)) {
    throw new GraphQLError(
      'Passing ExecutionArgs to createSourceEventStream() was removed in graphql-js@17.0.0; call validateSubscriptionArgs() first and pass the result instead, or use subscribe() for the full subscription pipeline.',
    );
  }

  try {
    const eventStream = executeSubscription(validatedExecutionArgs);
    if (isPromise(eventStream)) {
      return eventStream.then(undefined, (error: unknown) => ({
        errors: [ensureGraphQLError(error)],
      }));
    }

    return eventStream;
  } catch (error) {
    return { errors: [ensureGraphQLError(error)] };
  }
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * TODO: consider no longer exporting this function
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
 *   fieldResolver: (source, _args, contextValue, info) => {
 *     contextValue.locale; // => 'en'
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
 * validatedArgs.operation.name?.value; // => 'Viewer'
 * validatedArgs.hideSuggestions; // => true
 * ```
 */
export function validateExecutionArgs(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ValidatedExecutionArgs {
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues: rawVariableValues,
    operationName,
    fieldResolver,
    typeResolver,
    subscribeFieldResolver,
    abortSignal: externalAbortSignal,
    enableEarlyExecution,
    hooks,
    options,
  } = args;

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  let operation: OperationDefinitionNode | undefined;
  const fragmentDefinitions: ObjMap<FragmentDefinitionNode> =
    Object.create(null);
  const fragments: ObjMap<FragmentDetails> = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError(
                'Must provide operation name if query contains multiple operations.',
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION: {
        fragmentDefinitions[definition.name.value] = definition;
        let variableSignatures;
        if (definition.variableDefinitions) {
          variableSignatures = Object.create(null);
          for (const varDef of definition.variableDefinitions) {
            const signature = getVariableSignature(schema, varDef);
            variableSignatures[signature.name] = signature;
          }
        }
        fragments[definition.name.value] = { definition, variableSignatures };
        break;
      }
      default:
      // ignore non-executable definitions
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }

  const variableDefinitions = operation.variableDefinitions ?? [];
  const hideSuggestions = args.hideSuggestions ?? false;

  const variableValuesOrErrors = getVariableValues(
    schema,
    variableDefinitions,
    rawVariableValues ?? {},
    {
      maxErrors: options?.maxCoercionErrors ?? 50,
      hideSuggestions,
    },
  );

  if (variableValuesOrErrors.errors) {
    return variableValuesOrErrors.errors;
  }

  const errorPropagation = !operation.directives?.find(
    (directive) =>
      directive.name.value === GraphQLDisableErrorPropagationDirective.name,
  );

  return {
    schema,
    fragmentDefinitions,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: variableValuesOrErrors.variableValues,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    hideSuggestions,
    errorPropagation,
    externalAbortSignal: externalAbortSignal ?? undefined,
    enableEarlyExecution: enableEarlyExecution === true,
    hooks: hooks ?? undefined,
  };
}

/**
 * Validates execution arguments for a subscription operation.
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
export function validateSubscriptionArgs(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ValidatedSubscriptionArgs {
  const validatedExecutionArgs = validateExecutionArgs(args);
  if (!('schema' in validatedExecutionArgs)) {
    return validatedExecutionArgs;
  }
  assertSubscriptionExecutionArgs(validatedExecutionArgs);
  return validatedExecutionArgs;
}

function assertSubscriptionExecutionArgs(
  validatedExecutionArgs: ValidatedExecutionArgs,
): asserts validatedExecutionArgs is ValidatedSubscriptionArgs {
  if (
    !isSubscriptionOperationDefinitionNode(validatedExecutionArgs.operation)
  ) {
    throw new GraphQLError('Expected subscription operation.');
  }
}

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
export const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
    // First, look for `__typename`.
    if (isObjectLike(value) && typeof value.__typename === 'string') {
      return value.__typename;
    }

    // Otherwise, test each possible type.
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults: Array<PromiseLike<boolean>> = [];

    try {
      for (let i = 0; i < possibleTypes.length; i++) {
        const type = possibleTypes[i];

        if (type.isTypeOf) {
          const isTypeOfResult = type.isTypeOf(value, contextValue, info);

          if (isPromiseLike(isTypeOfResult)) {
            promisedIsTypeOfResults[i] = isTypeOfResult;
          } else if (isTypeOfResult) {
            if (promisedIsTypeOfResults.length) {
              info.getAsyncHelpers().track(promisedIsTypeOfResults);
            }
            return type.name;
          }
        }
      }
    } catch (error) {
      if (promisedIsTypeOfResults.length) {
        info.getAsyncHelpers().track(promisedIsTypeOfResults);
      }
      throw error;
    }

    if (promisedIsTypeOfResults.length) {
      return info
        .getAsyncHelpers()
        .promiseAll(promisedIsTypeOfResults)
        .then((isTypeOfResults) => {
          for (let i = 0; i < isTypeOfResults.length; i++) {
            if (isTypeOfResults[i]) {
              return possibleTypes[i].name;
            }
          }
        });
    }
  };

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return source[info.fieldName](args, contextValue, info);
      }
      return property;
    }
  };

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
 * import { mapSourceToResponseEvent, validateSubscriptionArgs } from 'graphql/execution';
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
export function mapSourceToResponseEvent(
  validatedExecutionArgs: ValidatedSubscriptionArgs,
  sourceEventStream: AsyncIterable<unknown>,
  rootSelectionSetExecutor: RootSelectionSetExecutor = executeSubscriptionEvent,
): AsyncGenerator<ExecutionResult, void, void> {
  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  function mapFn(payload: unknown): PromiseOrValue<ExecutionResult> {
    const perEventExecutionArgs: ValidatedSubscriptionArgs = {
      ...validatedExecutionArgs,
      rootValue: payload,
    };
    return rootSelectionSetExecutor(perEventExecutionArgs);
  }

  const externalAbortSignal = validatedExecutionArgs.externalAbortSignal;
  if (externalAbortSignal) {
    const generator = mapAsyncIterable(sourceEventStream, mapFn);
    return {
      ...generator,
      next: () => cancellablePromise(generator.next(), externalAbortSignal),
    };
  }
  return mapAsyncIterable(sourceEventStream, mapFn);
}

function executeSubscription(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown>> {
  const {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues,
    hideSuggestions,
    externalAbortSignal,
  } = validatedExecutionArgs;

  const rootType = schema.getSubscriptionType();
  if (rootType == null) {
    throw new GraphQLError(
      'Schema is not configured to execute subscription operation.',
      { nodes: operation },
    );
  }

  const { groupedFieldSet } = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation.selectionSet,
    hideSuggestions,
  );

  const firstRootField = groupedFieldSet.entries().next().value as [
    string,
    FieldDetailsList,
  ];
  const [responseName, fieldDetailsList] = firstRootField;
  const firstFieldDetails = fieldDetailsList[0];
  const firstNode = firstFieldDetails.node;
  const fieldName = firstNode.name.value;
  const fieldDef = schema.getField(rootType, fieldName);

  const fieldNodes = fieldDetailsList.map((fieldDetails) => fieldDetails.node);
  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: fieldNodes },
    );
  }

  const sharedExecutionContext =
    createSharedExecutionContext(externalAbortSignal);
  const path = addPath(undefined, responseName, rootType.name);
  const info = buildResolveInfo(
    validatedExecutionArgs,
    fieldDef,
    fieldNodes,
    rootType,
    path,
    sharedExecutionContext.getAbortSignal,
    sharedExecutionContext.getAsyncHelpers,
  );

  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = getArgumentValues(
      fieldDef,
      firstNode,
      variableValues,
      firstFieldDetails.fragmentVariableValues,
      hideSuggestions,
    );

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const resolveFn =
      fieldDef.subscribe ?? validatedExecutionArgs.subscribeFieldResolver;

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const result = resolveFn(rootValue, args, contextValue, info);

    if (isPromiseLike(result)) {
      const promisedResult = Promise.resolve(result);
      const promise = externalAbortSignal
        ? cancellablePromise(promisedResult, externalAbortSignal)
        : promisedResult;
      return promise
        .then(assertEventStream)
        .then(undefined, (error: unknown) => {
          throw locatedError(
            error,
            toNodes(fieldDetailsList),
            pathToArray(path),
          );
        });
    }
    return assertEventStream(result);
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
  }
}

function assertEventStream(result: unknown): AsyncIterable<unknown> {
  if (result instanceof Error) {
    throw result;
  }

  // Assert field returned an event stream, otherwise yield an error.
  if (!isAsyncIterable(result)) {
    throw new GraphQLError(
      'Subscription field must return Async Iterable. ' +
        `Received: ${inspect(result)}.`,
    );
  }

  return result;
}

function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
