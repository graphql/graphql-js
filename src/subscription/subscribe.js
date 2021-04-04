import { inspect } from '../jsutils/inspect';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { addPath, pathToArray } from '../jsutils/Path';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type { DocumentNode } from '../language/ast';

import type { ExecutionResult, ExecutionContext } from '../execution/execute';
import { getArgumentValues } from '../execution/values';
import {
  assertValidExecutionArguments,
  buildExecutionContext,
  buildResolveInfo,
  collectFields,
  execute,
  getFieldDef,
} from '../execution/execute';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLFieldResolver } from '../type/definition';

import { getOperationRootType } from '../utilities/getOperationRootType';

import { mapAsyncIterator } from './mapAsyncIterator';

export type SubscriptionArgs = {|
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{ +[variable: string]: mixed, ... },
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  subscribeFieldResolver?: ?GraphQLFieldResolver<any, any>,
|};

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
 */
export async function subscribe(
  args: SubscriptionArgs,
): Promise<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult> {
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    subscribeFieldResolver,
  } = args;

  // $FlowFixMe[incompatible-call]
  const resultOrStream = await createSourceEventStream(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    subscribeFieldResolver,
  );

  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  const mapSourceToResponse = (payload) =>
    execute({
      schema,
      document,
      rootValue: payload,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
    });

  // Map every source value to a ExecutionResult value as described above.
  return mapAsyncIterator(resultOrStream, mapSourceToResponse);
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
export async function createSourceEventStream(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{ +[variable: string]: mixed, ... },
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
): Promise<AsyncIterable<mixed> | ExecutionResult> {
  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  assertValidExecutionArguments(schema, document, variableValues);

  try {
    // If a valid context cannot be created due to incorrect arguments, this will throw an error.
    const exeContext = buildExecutionContext(
      schema,
      document,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
    );

    // Return early errors if execution context failed.
    if (Array.isArray(exeContext)) {
      return { errors: exeContext };
    }

    const eventStream = await executeSubscription(exeContext);

    // Assert field returned an event stream, otherwise yield an error.
    if (!isAsyncIterable(eventStream)) {
      throw new Error(
        'Subscription field must return Async Iterable. ' +
          `Received: ${inspect(eventStream)}.`,
      );
    }

    return eventStream;
  } catch (error) {
    // If it GraphQLError, report it as an ExecutionResult, containing only errors and no data.
    // Otherwise treat the error as a system-class error and re-throw it.
    if (error instanceof GraphQLError) {
      return { errors: [error] };
    }
    throw error;
  }
}

async function executeSubscription(
  exeContext: ExecutionContext,
): Promise<mixed> {
  const { schema, operation, variableValues, rootValue } = exeContext;
  const type = getOperationRootType(schema, operation);
  const fields = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    Object.create(null),
  );
  const [responseName, fieldNodes] = Object.entries(fields)[0];
  const fieldName = fieldNodes[0].name.value;
  const fieldDef = getFieldDef(schema, type, fieldName);

  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      fieldNodes,
    );
  }

  const path = addPath(undefined, responseName, type.name);
  const info = buildResolveInfo(exeContext, fieldDef, fieldNodes, type, path);

  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = getArgumentValues(fieldDef, fieldNodes[0], variableValues);

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const resolveFn = fieldDef.subscribe ?? exeContext.fieldResolver;
    const eventStream = await resolveFn(rootValue, args, contextValue, info);

    if (eventStream instanceof Error) {
      throw eventStream;
    }
    return eventStream;
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
  }
}
