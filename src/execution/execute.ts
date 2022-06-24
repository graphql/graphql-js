import { isPromise } from '../jsutils/isPromise';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError';

import type { DocumentNode } from '../language/ast';
import { OperationTypeNode } from '../language/ast';

import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

import type { ExecutionContext } from './compiledDocument';
import { buildExecutionContext } from './compiledDocument';
import { GraphQLCompiledSchema } from './compiledSchema';
import { GraphQLExecution } from './execution';
import { getVariableValues } from './values';

// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `extensions` is reserved for adding non-standard properties.
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

export interface ExecutionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
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
 */
export function execute(
  args: ExecutionArgs,
): PromiseOrValue<
  ExecutionResult | AsyncGenerator<ExecutionResult, void, void>
> {
  return prepareContextAndRunFn(
    args,
    (
      compiledSchema: GraphQLCompiledSchema,
      exeContext: ExecutionContext,
      coercedVariableValues: { [variable: string]: unknown },
    ) => {
      const execution = new GraphQLExecution({
        compiledSchema,
        exeContext,
        rootValue: args.rootValue,
        contextValue: args.contextValue,
        variableValues: coercedVariableValues,
      });

      const operationType = exeContext.operation.operation;
      if (operationType === OperationTypeNode.QUERY) {
        return execution.executeQuery(exeContext);
      }

      if (operationType === OperationTypeNode.MUTATION) {
        return execution.executeMutation(exeContext);
      }

      return execution.executeSubscription(exeContext);
    },
  );
}

function prepareContextAndRunFn<T>(
  args: ExecutionArgs,
  fn: (
    compiledSchema: GraphQLCompiledSchema,
    exeContext: ExecutionContext,
    coercedVariableValues: { [variable: string]: unknown },
  ) => T,
): ExecutionResult | T {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('fragments' in exeContext)) {
    return { errors: exeContext };
  }

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
  const variableDefinitions = exeContext.operation.variableDefinitions ?? [];

  const compiledSchema = new GraphQLCompiledSchema(args);

  const coercedVariableValues = getVariableValues(
    compiledSchema.schema,
    variableDefinitions,
    args.variableValues ?? {},
    { maxErrors: 50 },
  );

  if (coercedVariableValues.errors) {
    return { errors: coercedVariableValues.errors };
  }

  return fn(compiledSchema, exeContext, coercedVariableValues.coerced);
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(
  args: ExecutionArgs,
): ExecutionResult | AsyncGenerator<ExecutionResult, void, void> {
  const result = execute(args);

  // Assert that the execution was synchronous.
  if (isPromise(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * Accepts either an object with named arguments, or individual arguments.
 *
 * @deprecated subscribe will be removed in v18; use execute instead
 */
export function subscribe(
  args: ExecutionArgs,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
> {
  return execute(args);
}

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
export function createSourceEventStream(
  args: ExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  return prepareContextAndRunFn(
    args,
    (
      compiledSchema: GraphQLCompiledSchema,
      exeContext: ExecutionContext,
      coercedVariableValues: { [variable: string]: unknown },
    ) => {
      const execution = new GraphQLExecution({
        compiledSchema,
        exeContext,
        rootValue: args.rootValue,
        contextValue: args.contextValue,
        variableValues: coercedVariableValues,
      });

      return execution.createSourceEventStreamImpl(exeContext);
    },
  );
}

/**
 * Implements the "ExecuteSubscriptionEvent" algorithm described in the
 * GraphQL specification.
 */
export function executeSubscriptionEvent(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  return prepareContextAndRunFn(
    args,
    (
      compiledSchema: GraphQLCompiledSchema,
      exeContext: ExecutionContext,
      coercedVariableValues: { [variable: string]: unknown },
    ) => {
      const execution = new GraphQLExecution({
        compiledSchema,
        exeContext,
        rootValue: args.rootValue,
        contextValue: args.contextValue,
        variableValues: coercedVariableValues,
      });

      return execution.executeQuery(exeContext);
    },
  );
}
