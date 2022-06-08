import { inspect } from '../jsutils/inspect';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { isPromise } from '../jsutils/isPromise';
import type { Maybe } from '../jsutils/Maybe';
import type { Path } from '../jsutils/Path';
import { addPath, pathToArray } from '../jsutils/Path';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type { DocumentNode, FieldNode } from '../language/ast';

import type { GraphQLFieldResolver } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

import { collectFields } from './collectFields';
import type {
  ExecutionArgs,
  ExecutionContext,
  ExecutionResult,
} from './execute';
import {
  assertValidExecutionArguments,
  buildExecutionContext,
  buildResolveInfo,
  execute,
} from './execute';
import { mapAsyncIterator } from './mapAsyncIterator';
import { getArgumentValues } from './values';

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
export function subscribe(
  args: ExecutionArgs,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
> {
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

  const resultOrStream = createSourceEventStream(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    subscribeFieldResolver,
  );

  if (isPromise(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      mapSourceToResponse(
        schema,
        document,
        resolvedResultOrStream,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
      ),
    );
  }

  return mapSourceToResponse(
    schema,
    document,
    resultOrStream,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
  );
}

function mapSourceToResponse(
  schema: GraphQLSchema,
  document: DocumentNode,
  resultOrStream: ExecutionResult | AsyncIterable<unknown>,
  contextValue?: unknown,
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>,
  operationName?: Maybe<string>,
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
> {
  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  return mapAsyncIterator(resultOrStream, (payload: unknown) =>
    execute({
      schema,
      document,
      rootValue: payload,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
    }),
  );
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
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: unknown,
  contextValue?: unknown,
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>,
  operationName?: Maybe<string>,
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  assertValidExecutionArguments(schema, document, variableValues);

  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    subscribeFieldResolver,
  });

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  try {
    const eventStream = executeSubscription(exeContext);
    if (isPromise(eventStream)) {
      return eventStream.then(undefined, (error) => ({ errors: [error] }));
    }

    return eventStream;
  } catch (error) {
    return { errors: [error] };
  }
}

function executeSubscription(
  exeContext: ExecutionContext,
): PromiseOrValue<AsyncIterable<unknown>> {
  const { schema, fragments, operation, variableValues, rootValue } =
    exeContext;

  const rootType = schema.getSubscriptionType();
  if (rootType == null) {
    throw new GraphQLError(
      'Schema is not configured to execute subscription operation.',
      { nodes: operation },
    );
  }

  const rootFields = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation.selectionSet,
  );
  const [responseName, fieldNodes] = [...rootFields.entries()][0];
  const fieldName = fieldNodes[0].name.value;
  const fieldDef = schema.getField(rootType, fieldName);

  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: fieldNodes },
    );
  }

  const path = addPath(undefined, responseName, rootType.name);
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    rootType,
    path,
  );

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
    const resolveFn = fieldDef.subscribe ?? exeContext.subscribeFieldResolver;
    const eventStream = resolveFn(rootValue, args, contextValue, info);

    if (isPromise(eventStream)) {
      return eventStream.then(
        (resolvedEventStream) =>
          ensureAsyncIterable(resolvedEventStream, fieldNodes, path),
        (error) => {
          throw locatedError(error, fieldNodes, pathToArray(path));
        },
      );
    }

    return ensureAsyncIterable(eventStream, fieldNodes, path);
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
  }
}

function ensureAsyncIterable(
  eventStream: unknown,
  fieldNodes: ReadonlyArray<FieldNode>,
  path: Path,
): AsyncIterable<unknown> {
  if (eventStream instanceof Error) {
    throw locatedError(eventStream, fieldNodes, pathToArray(path));
  }

  // Assert field returned an event stream, otherwise yield an error.
  if (!isAsyncIterable(eventStream)) {
    throw locatedError(
      new GraphQLError(
        'Subscription field must return Async Iterable. ' +
          `Received: ${inspect(eventStream)}.`,
      ),
      fieldNodes,
      pathToArray(path),
    );
  }

  return eventStream;
}
