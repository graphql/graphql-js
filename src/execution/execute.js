/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLError, locatedError } from '../error';
import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';

import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  isAbstractType
} from '../type/definition';
import type {
  GraphQLType,
  GraphQLAbstractType,
  GraphQLResolveInfo,
} from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import type {
  Document,
  Field,
} from '../language/ast';
import {
  ExecutionContext,
  buildExecutionContext
} from './context';
import {
  planOperation
} from './plan';

import type {
  ExecutionPlan,
  SelectionExecutionPlan,
  ResolvingExecutionPlan
} from './plan';


/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g "a"
 * 2) fragment "spreads" e.g. "...c"
 * 3) inline fragment "spreads" e.g. "...on Type { a }"
 */

/**
 * The result of execution. `data` is the result of executing the
 * query, `errors` is null if no errors occurred, and is a
 * non-empty array if an error occurred.
 */
type ExecutionResult = {
  data: ?Object;
  errors?: Array<GraphQLError>;
}

/**
 * Implements the "Evaluating requests" section of the GraphQL specification.
 *
 * Returns a Promise that will eventually be resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function execute(
  schema: GraphQLSchema,
  documentAST: Document,
  rootValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): Promise<ExecutionResult> {
  invariant(schema, 'Must provide schema');
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.'
  );

  // If a valid context cannot be created due to incorrect arguments,
  // this will throw an error.
  const context = buildExecutionContext(
    schema,
    documentAST,
    rootValue,
    variableValues,
    operationName
  );

  const plan = planOperation(context, context.operation);

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  return new Promise(resolve => {
    resolve(executeOperation(context, plan, rootValue));
  }).catch(error => {
    // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.
    context.errors.push(error);
    return null;
  }).then(data => {
    if (!context.errors.length) {
      return { data };
    }
    return { data, errors: context.errors };
  });
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  plan: SelectionExecutionPlan,
  rootValue: mixed
): Object {

  invariant(plan.strategy === 'serial' || plan.strategy === 'parallel');


  if (plan.strategy === 'serial') {
    return executeFieldsSerially(
      exeContext,
      plan.type,
      rootValue,
      plan
    );
  }
  return executeFields(exeContext, plan.type, rootValue, plan);
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  plan: SelectionExecutionPlan
): Promise<Object> {
  const fields = plan.fieldPlans;
  return Object.keys(fields).reduce(
    (prevPromise, responseName) => prevPromise.then(results => {
      const result = resolveField(
        exeContext,
        parentType,
        sourceValue,
        fields[responseName]
      );
      if (result === undefined) {
        return results;
      }
      if (isThenable(result)) {
        return ((result: any): Promise).then(resolvedResult => {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    }),
    Promise.resolve({})
  );
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  plan: SelectionExecutionPlan
): Object {
  const fields = plan.fieldPlans;
  let containsPromise = false;

  const finalResults = Object.keys(fields).reduce(
    (results, responseName) => {
      const result = resolveField(
        exeContext,
        parentType,
        sourceValue,
        fields[responseName]
      );
      if (result === undefined) {
        return results;
      }
      results[responseName] = result;
      if (isThenable(result)) {
        containsPromise = true;
      }
      return results;
    },
    Object.create(null)
  );

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return finalResults;
  }

  // Otherwise, results is a map from field name to the result
  // of resolving that field, which is possibly a promise. Return
  // a promise that will return this same map, but with any
  // promises replaced with the values they resolved to.
  return promiseForObject(finalResults);
}

/**
 * This function transforms a JS object `{[key: string]: Promise<T>}` into
 * a `Promise<{[key: string]: T}>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
function promiseForObject<T>(
  object: {[key: string]: Promise<T>}
): Promise<{[key: string]: T}> {
  const keys = Object.keys(object);
  const valuesAndPromises = keys.map(name => object[name]);
  return Promise.all(valuesAndPromises).then(
    values => values.reduce((resolvedObject, value, i) => {
      resolvedObject[keys[i]] = value;
      return resolvedObject;
    }, Object.create(null))
  );
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete promises, serialize scalars, or execute
 * the sub-selection-set for objects.
 */
function resolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: mixed,
  plan: ResolvingExecutionPlan
): mixed {

  // Get the resolve function, regardless of if its result is normal
  // or abrupt (error).
  const result = resolveOrError(plan.resolveFn, source, plan.args, plan.info);

  return completeValueCatchingError(
    exeContext,
    plan.returnType,
    plan.fieldASTs,
    plan.info,
    result,
    plan.completionPlan
  );
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
function resolveOrError<T>(
  resolveFn: (
    source: mixed,
    args: { [key: string]: mixed },
    info: GraphQLResolveInfo
  ) => T,
  source: mixed,
  args: { [key: string]: mixed },
  info: GraphQLResolveInfo
): Error | T {
  try {
    return resolveFn(source, args, info);
  } catch (error) {
    // Sometimes a non-error is thrown, wrap it as an Error for a
    // consistent interface.
    return error instanceof Error ? error : new Error(error);
  }
}

// This is a small wrapper around completeValue which detects and logs errors
// in the execution context.
function completeValueCatchingError(
  exeContext: ExecutionContext,
  returnType: GraphQLType,
  fieldASTs: Array<Field>,
  info: GraphQLResolveInfo,
  result: mixed,
  plan: ExecutionPlan
): mixed {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors.
  if (returnType instanceof GraphQLNonNull) {
    return completeValue(exeContext, returnType, fieldASTs, info, result, plan);
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  try {
    const completed = completeValue(
      exeContext,
      returnType,
      fieldASTs,
      info,
      result,
      plan
    );
    if (isThenable(completed)) {
      // If `completeValue` returned a rejected promise, log the rejection
      // error and resolve to null.
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return ((completed: any): Promise).then(undefined, error => {
        exeContext.errors.push(error);
        return Promise.resolve(null);
      });
    }
    return completed;
  } catch (error) {
    // If `completeValue` returned abruptly (threw an error), log the error
    // and return null.
    exeContext.errors.push(error);
    return null;
  }
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Field entries" section of the spec.
 *
 * If the field type is Non-Null, then this recursively completes the value
 * for the inner type. It throws a field error if that completion returns null,
 * as per the "Nullability" section of the spec.
 *
 * If the field type is a List, then this recursively completes the value
 * for the inner type on each item in the list.
 *
 * If the field type is a Scalar or Enum, ensures the completed value is a legal
 * value of the type by calling the `serialize` method of GraphQL type
 * definition.
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by evaluating all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  returnType: GraphQLType,
  fieldASTs: Array<Field>,
  info: GraphQLResolveInfo,
  result: mixed,
  plan: ExecutionPlan
): mixed {
  // If result is a Promise, apply-lift over completeValue.
  if (isThenable(result)) {
    return ((result: any): Promise).then(
      // Once resolved to a value, complete that value.
      resolved => completeValue(
        exeContext,
        returnType,
        fieldASTs,
        info,
        resolved,
        plan
      ),
      // If rejected, create a located error, and continue to reject.
      error => Promise.reject(locatedError(error, fieldASTs))
    );
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw locatedError(result, fieldASTs);
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnType instanceof GraphQLNonNull) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldASTs,
      info,
      result,
      plan
    );
    if (completed === null) {
      throw new GraphQLError(
        `Cannot return null for non-nullable ` +
        `field ${info.parentType}.${info.fieldName}.`,
        fieldASTs
      );
    }
    return completed;
  }

  // If result is null-like, return null.
  if (isNullish(result)) {
    return null;
  }

  switch (plan.kind) {
    case 'serialize':
      invariant(returnType.serialize, 'Missing serialize method on type');
      const serializedResult = returnType.serialize(result);
      return isNullish(serializedResult) ? null : serializedResult;
    case 'map':
      invariant(
        Array.isArray(result),
        'User Error: expected iterable, but did not find one ' +
        `for field ${info.parentType}.${info.fieldName}.`
      );

      invariant(plan.innerCompletionPlan !== null);

      const innerCompletionPlan = plan.innerCompletionPlan;

      invariant(returnType instanceof GraphQLList);

      // This is specified as a simple map, however we're optimizing the path
      // where the list contains no Promises by avoiding creating another
      // Promise.
      const itemType = returnType.ofType;
      let containsPromise = false;
      const completedResults = result.map(item => {
        const completedItem =
          completeValueCatchingError(
            exeContext,
            itemType,
            fieldASTs,
            info,
            item,
            innerCompletionPlan
          );
        if (!containsPromise && isThenable(completedItem)) {
          containsPromise = true;
        }
        return completedItem;
      });

      return containsPromise ?
        Promise.all(completedResults) : completedResults;
    case 'select':

      invariant(returnType instanceof GraphQLObjectType);

      // If there is an isTypeOf predicate function, call it with the
      // current result. If isTypeOf returns false, then raise an error rather
      // than continuing execution.
      if (returnType.isTypeOf && !returnType.isTypeOf(result, info)) {
        throw new GraphQLError(
          `Expected value of type "${returnType}" but got: ${result}.`,
          fieldASTs
        );
      }

      return executeFields(
        exeContext,
        returnType,
        result,
        plan
      );
    case 'coerce':
      // Field type must be Object, Interface or Union and expect
      // sub-selections.
      let runtimeType: ?GraphQLObjectType;

      invariant(isAbstractType(returnType));

      const abstractType = ((returnType: any): GraphQLAbstractType);
      runtimeType = abstractType.getObjectType(result, info);

      if (!runtimeType) {
        return null;
      }

      // If there is an isTypeOf predicate function, call it with the
      // current result. If isTypeOf returns false, then raise an error rather
      // than continuing execution.
      if (runtimeType.isTypeOf && !runtimeType.isTypeOf(result, info)) {
        throw new GraphQLError(
          `Expected value of type "${runtimeType}" but got: ${result}.`,
          fieldASTs
        );
      }

      if (runtimeType && !abstractType.isPossibleType(runtimeType)) {
        throw new GraphQLError(
          `Runtime Object type "${runtimeType}" is not a possible type ` +
          `for "${abstractType}".`,
          fieldASTs
        );
      }

      invariant(plan.typePlans !== null);

      const typePlans = plan.typePlans;

      const typePlan = typePlans[runtimeType.name];
      if (!typePlan) {
        // console.log(runtimeType.name, ':', Array.keys(typePlans));
        throw new GraphQLError(
          `Runtime Object type "${runtimeType}" ` +
          `is not a possible coercion type for "${abstractType}".`,
          fieldASTs
        );
      }

      return executeFields(
        exeContext,
        runtimeType,
        result,
        typePlan
      );
  }
}

/**
 * Checks to see if this object acts like a Promise, i.e. has a "then"
 * function.
 */
function isThenable(value: mixed): boolean {
  return typeof value === 'object' &&
    value !== null &&
    typeof value.then === 'function';
}
