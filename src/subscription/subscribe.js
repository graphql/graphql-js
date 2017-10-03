/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { isAsyncIterable } from 'iterall';
import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';
import {
  addPath,
  assertValidExecutionArguments,
  buildExecutionContext,
  buildResolveInfo,
  collectFields,
  execute,
  getFieldDef,
  getOperationRootType,
  resolveFieldValueOrError,
  responsePathAsArray,
} from '../execution/execute';
import { GraphQLSchema } from '../type/schema';
import invariant from '../jsutils/invariant';
import mapAsyncIterator from './mapAsyncIterator';

import type { ObjMap } from '../jsutils/ObjMap';
import type { ExecutionResult } from '../execution/execute';
import type { DocumentNode } from '../language/ast';
import type { GraphQLFieldResolver } from '../type/definition';

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (client error). The promise will be rejected if a
 * server error occurs.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * Accepts either an object with named arguments, or individual arguments.
 */
declare function subscribe({|
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?ObjMap<mixed>,
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  subscribeFieldResolver?: ?GraphQLFieldResolver<any, any>
|}, ..._: []): Promise<AsyncIterator<ExecutionResult> | ExecutionResult>;
/* eslint-disable no-redeclare */
declare function subscribe(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?ObjMap<mixed>,
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  subscribeFieldResolver?: ?GraphQLFieldResolver<any, any>
): Promise<AsyncIterator<ExecutionResult> | ExecutionResult>;
export function subscribe(
  argsOrSchema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  subscribeFieldResolver
) {
  // Extract arguments from object args if provided.
  const args = arguments.length === 1 ? argsOrSchema : undefined;
  const schema = args ? args.schema : argsOrSchema;

  return args ?
    subscribeImpl(
      schema,
      args.document,
      args.rootValue,
      args.contextValue,
      args.variableValues,
      args.operationName,
      args.fieldResolver,
      args.subscribeFieldResolver
    ) :
    subscribeImpl(
      schema,
      document,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
      subscribeFieldResolver
    );
}

/**
 * This function checks if the error is a GraphQLError. If it is, report it as
 * an ExecutionResult, containing only errors and no data. Otherwise treat the
 * error as a system-class error and re-throw it.
 */
function reportGraphQLError(error) {
  if (error instanceof GraphQLError) {
    return { errors: [ error ] };
  }
  throw error;
}

function subscribeImpl(
  schema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  subscribeFieldResolver
) {
  const sourcePromise = createSourceEventStream(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    subscribeFieldResolver
  );

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  const mapSourceToResponse = payload => execute(
    schema,
    document,
    payload,
    contextValue,
    variableValues,
    operationName,
    fieldResolver
  );

  // Resolve the Source Stream, then map every source value to a
  // ExecutionResult value as described above.
  return sourcePromise.then(
    sourceStream => mapAsyncIterator(
      sourceStream,
      mapSourceToResponse,
      reportGraphQLError
    ),
    reportGraphQLError
  );
}

/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream.
 *
 * Returns a Promise<AsyncIterable>.
 *
 * If the client-provided invalid arguments, the source stream could not be
 * created, or the resolver did not return an AsyncIterable, this function will
 * will throw an error, which should be caught and handled by the caller.
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
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ObjMap<mixed>,
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>
): Promise<AsyncIterable<mixed>> {
  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  assertValidExecutionArguments(
    schema,
    document,
    variableValues
  );

  return new Promise((resolve, reject) => {
    // If a valid context cannot be created due to incorrect arguments,
    // this will throw an error.
    const exeContext = buildExecutionContext(
      schema,
      document,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver
    );

    const type = getOperationRootType(schema, exeContext.operation);
    const fields = collectFields(
      exeContext,
      type,
      exeContext.operation.selectionSet,
      Object.create(null),
      Object.create(null)
    );
    const responseNames = Object.keys(fields);
    const responseName = responseNames[0];
    const fieldNodes = fields[responseName];
    const fieldNode = fieldNodes[0];
    const fieldDef = getFieldDef(schema, type, fieldNode.name.value);
    invariant(
      fieldDef,
      'This subscription is not defined by the schema.'
    );

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const resolveFn = fieldDef.subscribe || exeContext.fieldResolver;

    const path = addPath(undefined, responseName);

    const info = buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      type,
      path
    );

    // resolveFieldValueOrError implements the "ResolveFieldEventStream"
    // algorithm from GraphQL specification. It differs from
    // "ResolveFieldValue" due to providing a different `resolveFn`.
    Promise.resolve(resolveFieldValueOrError(
      exeContext,
      fieldDef,
      fieldNodes,
      resolveFn,
      rootValue,
      info
    )).then((subscription: any) => {
      // Reject with a located GraphQLError if subscription source fails
      // to resolve.
      if (subscription instanceof Error) {
        const error = locatedError(
          subscription,
          fieldNodes,
          responsePathAsArray(path),
        );
        reject(error);
      }

      if (!isAsyncIterable(subscription)) {
        reject(new Error(
          'Subscription must return Async Iterable. ' +
            'Received: ' + String(subscription)
        ));
      }

      resolve(subscription);
    })
    .catch(reject);
  });
}
