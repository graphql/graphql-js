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

import {
  addPath,
  buildExecutionContext,
  collectFields,
  defaultFieldResolver,
  execute,
  getFieldDef,
  getOperationRootType,
} from '../execution/execute';
import { getArgumentValues } from '../execution/values';
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
import type { GraphQLResolveInfo } from '../type/definition';


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
  // Note: these invariants are identical to execute.js
  invariant(schema, 'Must provide schema');
  invariant(document, 'Must provide document');
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.'
  );

  // Variables, if provided, must be an object.
  invariant(
    !variableValues || typeof variableValues === 'object',
    'Variables must be provided as an Object where each property is a ' +
    'variable value. Perhaps look to see if an unparsed JSON string ' +
    'was provided.'
  );

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
): AsyncIterator<mixed> {
  // Note: this function is almost the same as executeOperation() and
  // resolveField() with only a few minor differences.

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
  const fieldPath = addPath(undefined, responseName);

  const fieldNode = fieldNodes[0];
  const fieldName = fieldNode.name.value;
  const fieldDef = getFieldDef(exeContext.schema, type, fieldName);
  invariant(
    fieldDef,
    'This subscription is not defined by the schema.'
  );

  // TODO: make GraphQLSubscription flow type special to support defining these?
  const resolveFn = (fieldDef: any).subscribe || defaultFieldResolver;

  // The resolve function's optional third argument is a context value that
  // is provided to every resolve function within an execution. It is commonly
  // used to represent an authenticated user, or request-specific caches.
  const context = exeContext.contextValue;

  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  const info: GraphQLResolveInfo = {
    fieldName,
    fieldNodes,
    returnType: fieldDef.type,
    parentType: type,
    path: fieldPath,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };

  // Build a JS object of arguments from the field.arguments AST, using the
  // variables scope to fulfill any variable references.
  const args = getArgumentValues(
    fieldDef,
    fieldNode,
    exeContext.variableValues
  );

  // TODO: resolveFn could throw!
  const subscription = resolveFn(rootValue, args, context, info);

  invariant(
    isIterable(subscription),
    'Subscription must return async-iterator.'
  );

  return subscription;
}

function isIterable(value) {
  return typeof value === 'object' &&
    value !== null &&
    typeof value.next === 'function';
}
