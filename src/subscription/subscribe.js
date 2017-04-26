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
import {
  addPath,
  buildExecutionContext,
  collectFields,
  defaultFieldResolver,
  execute,
  getFieldDef,
  getOperationRootType,
  buildResolveInfo,
  resolveFieldValueOrError,
} from '../execution/execute';
import { GraphQLSchema } from '../type/schema';
import invariant from '../jsutils/invariant';
import mapAsyncIterator from './mapAsyncIterator';

import type {
  ExecutionContext,
  ExecutionResult,
} from '../execution/execute';
import type {
  DocumentNode,
  OperationDefinitionNode,
} from '../language/ast';


/**
 * Implements the "Subscribing to request" section of the GraphQL specification.
 *
 * Returns an AsyncIterator
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function subscribe(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string,
): AsyncIterator<ExecutionResult> {
  // If a valid context cannot be created due to incorrect arguments,
  // this will throw an error.
  const exeContext = buildExecutionContext(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName
  );

  // Call the `subscribe()` resolver or the default resolver to produce an
  // AsyncIterable yielding raw payloads.
  const subscription = resolveSubscription(
    exeContext,
    exeContext.operation,
    rootValue
  );

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  return mapAsyncIterator(
    subscription,
    payload => execute(
      schema,
      document,
      payload,
      contextValue,
      variableValues,
      operationName
    )
  );
}

function resolveSubscription(
  exeContext: ExecutionContext,
  operation: OperationDefinitionNode,
  rootValue: mixed
): AsyncIterable<mixed> {
  const type = getOperationRootType(exeContext.schema, exeContext.operation);
  const fields = collectFields(
    exeContext,
    type,
    exeContext.operation.selectionSet,
    Object.create(null),
    Object.create(null)
  );
  const responseNames = Object.keys(fields);
  invariant(
    responseNames.length === 1,
    'A subscription must contain exactly one field.'
  );
  const responseName = responseNames[0];
  const fieldNodes = fields[responseName];
  const fieldNode = fieldNodes[0];
  const fieldDef = getFieldDef(exeContext.schema, type, fieldNode.name.value);
  invariant(
    fieldDef,
    'This subscription is not defined by the schema.'
  );

  // TODO: make GraphQLSubscription flow type special to support defining these?
  const resolveFn = (fieldDef: any).subscribe || defaultFieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    type,
    addPath(undefined, responseName)
  );

  // TODO: handle the error
  const subscription = resolveFieldValueOrError(
    exeContext,
    fieldDef,
    fieldNodes,
    resolveFn,
    rootValue,
    info
  );

  invariant(
    isAsyncIterable(subscription),
    'Subscription must return Async Iterable.'
  );

  return (subscription: any);
}
