import { devAssert } from '../jsutils/devAssert';
import { inspect } from '../jsutils/inspect';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import type { Maybe } from '../jsutils/Maybe';
import { addPath, pathToArray } from '../jsutils/Path';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type { DocumentNode } from '../language/ast';

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
  getFieldDef,
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
export async function subscribe(
  args: ExecutionArgs,
): Promise<AsyncGenerator<ExecutionResult, void, void> | ExecutionResult> {
  // Temporary for v15 to v16 migration. Remove in v17
  devAssert(
    arguments.length < 2,
    'graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead.',
  );

  const resultOrStream = await createSourceEventStream(args);

  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  const mapSourceToResponse = (payload: unknown) =>
    execute({
      ...args,
      rootValue: payload,
    });

  // Map every source value to a ExecutionResult value as described above.
  return mapAsyncIterator(resultOrStream, mapSourceToResponse);
}

type BackwardsCompatibleArgs =
  | [options: ExecutionArgs]
  | [
      schema: ExecutionArgs['schema'],
      document: ExecutionArgs['document'],
      rootValue?: ExecutionArgs['rootValue'],
      contextValue?: ExecutionArgs['contextValue'],
      variableValues?: ExecutionArgs['variableValues'],
      operationName?: ExecutionArgs['operationName'],
      subscribeFieldResolver?: ExecutionArgs['subscribeFieldResolver'],
    ];

function toNormalizedArgs(args: BackwardsCompatibleArgs): ExecutionArgs {
  const firstArg = args[0];
  if (firstArg && 'document' in firstArg) {
    return firstArg;
  }

  return {
    schema: firstArg,
    // FIXME: when underlying TS bug fixed, see https://github.com/microsoft/TypeScript/issues/31613
    document: args[1] as DocumentNode,
    rootValue: args[2],
    contextValue: args[3],
    variableValues: args[4],
    operationName: args[5],
    subscribeFieldResolver: args[6],
  };
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
  args: ExecutionArgs,
): Promise<AsyncIterable<unknown> | ExecutionResult>;
/** @deprecated will be removed in next major version in favor of named arguments */
export async function createSourceEventStream(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: unknown,
  contextValue?: unknown,
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>,
  operationName?: Maybe<string>,
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
): Promise<AsyncIterable<unknown> | ExecutionResult>;
export async function createSourceEventStream(
  ...rawArgs: BackwardsCompatibleArgs
) {
  const args = toNormalizedArgs(rawArgs);

  const { schema, document, variableValues } = args;

  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  assertValidExecutionArguments(schema, document, variableValues);

  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  try {
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
): Promise<unknown> {
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
  const fieldDef = getFieldDef(schema, rootType, fieldNodes[0]);

  if (!fieldDef) {
    const fieldName = fieldNodes[0].name.value;
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
    const eventStream = await resolveFn(rootValue, args, contextValue, info);

    if (eventStream instanceof Error) {
      throw eventStream;
    }
    return eventStream;
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
  }
}
