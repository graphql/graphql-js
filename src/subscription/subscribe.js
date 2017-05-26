/**
 * Copyright (c) 2017, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import { isAsyncIterable } from 'iterall';
import { GraphQLError } from '../error/GraphQLError';
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
} from '../execution/execute';
import { GraphQLSchema } from '../type/schema';
import invariant from '../jsutils/invariant';
import asyncIteratorReject from './asyncIteratorReject';
import mapAsyncIterator from './mapAsyncIterator';

import type { ExecutionResult } from '../execution/execute';
import type { DocumentNode } from '../language/ast';
import type { GraphQLFieldResolver } from '../type/definition';

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns an AsyncIterator
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response with descriptive errors and no
 * data will be yielded.
 *
 * Accepts either an object with named arguments, or individual arguments.
 */
declare function subscribe({|
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  subscribeFieldResolver?: ?GraphQLFieldResolver<any, any>
|}, ..._: []): AsyncIterator<ExecutionResult>;
/* eslint-disable no-redeclare */
declare function subscribe(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  subscribeFieldResolver?: ?GraphQLFieldResolver<any, any>
): AsyncIterator<ExecutionResult>;
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
  const subscription = createSourceEventStream(
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
  return mapAsyncIterator(
    subscription,
    payload => execute(
      schema,
      document,
      payload,
      contextValue,
      variableValues,
      operationName,
      fieldResolver
    ),
    error => {
      if (error instanceof GraphQLError) {
        return { errors: [ error ] };
      }
      throw error;
    }
  );
}

/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream.
 *
 * Returns an AsyncIterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, iteration will fail with a GraphQLError explaining
 * the invalid input. These should be caught and yielded as a GraphQL Response.
 *
 * A Source Stream represents the sequence of events, each of which is
 * expected to be used to trigger a GraphQL execution for that event.
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
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>
): AsyncIterable<mixed> {
  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  assertValidExecutionArguments(
    schema,
    document,
    variableValues
  );

  // After asserting valid arguments, any error created should result in
  // returning a rejected AsyncIterable.
  try {
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

    const info = buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      type,
      addPath(undefined, responseName)
    );

    // resolveFieldValueOrError implements the "ResolveFieldEventStream"
    // algorithm from GraphQL specification. It differs from
    // "ResolveFieldValue" due to providing a different `resolveFn`.
    const subscription = resolveFieldValueOrError(
      exeContext,
      fieldDef,
      fieldNodes,
      resolveFn,
      rootValue,
      info
    );

    if (subscription instanceof Error) {
      throw subscription;
    }

    if (!isAsyncIterable(subscription)) {
      throw new Error(
        'Subscription must return Async Iterable. ' +
          'Received: ' + String(subscription)
      );
    }

    return (subscription: any);
  } catch (error) {
    return asyncIteratorReject(error);
  }
}
