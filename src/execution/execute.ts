import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isPromise } from '../jsutils/isPromise.js';
import { memoize3 } from '../jsutils/memoize3.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import { promiseForObject } from '../jsutils/promiseForObject.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { promiseReduce } from '../jsutils/promiseReduce.js';

import type { GraphQLFormattedError } from '../error/GraphQLError.js';
import { GraphQLError } from '../error/GraphQLError.js';
import { locatedError } from '../error/locatedError.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';
import { OperationTypeNode } from '../language/ast.js';

import type {
  GraphQLAbstractType,
  GraphQLFieldResolver,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from '../type/definition.js';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.js';
import type { GraphQLSchema } from '../type/schema.js';

import {
  AbortSignalListener,
  cancellableIterable,
  cancellablePromise,
} from './AbortSignalListener.js';
import type {
  FieldDetailsList,
  FragmentDetails,
  GroupedFieldSet,
} from './collectFields.js';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields.js';
import { mapAsyncIterable } from './mapAsyncIterable.js';
import { ResolveInfo } from './ResolveInfo.js';
import type { VariableValues } from './values.js';
import { getArgumentValues } from './values.js';
import { withConcurrentAbruptClose } from './withConcurrentAbruptClose.js';

/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = memoize3(
  (
    validatedExecutionArgs: ValidatedExecutionArgs,
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
  ) => {
    const { schema, fragments, variableValues, hideSuggestions } =
      validatedExecutionArgs;
    return _collectSubfields(
      schema,
      fragments,
      variableValues,
      returnType,
      fieldDetailsList,
      hideSuggestions,
    );
  },
);

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
 * 1) field references e.g `a`
 * 2) fragment "spreads" e.g. `...c`
 * 3) inline fragment "spreads" e.g. `...on Type { a }`
 */

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export interface ValidatedExecutionArgs {
  schema: GraphQLSchema;
  // TODO: consider deprecating/removing fragmentDefinitions if/when fragment
  // arguments are officially supported and/or the full fragment details are
  // exposed within GraphQLResolveInfo.
  fragmentDefinitions: ObjMap<FragmentDefinitionNode>;
  fragments: ObjMap<FragmentDetails>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: VariableValues;
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  perEventExecutor: (
    validatedExecutionArgs: ValidatedExecutionArgs,
  ) => PromiseOrValue<ExecutionResult>;
  hideSuggestions: boolean;
  errorPropagation: boolean;
  abortSignal: AbortSignal | undefined;
}

export interface ExecutionContext {
  validatedExecutionArgs: ValidatedExecutionArgs;
  errors: Array<GraphQLError>;
  abortSignalListener: AbortSignalListener | undefined;
  completed: boolean;
}

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

export function executeQueryOrMutationOrSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  const abortSignal = validatedExecutionArgs.abortSignal;
  const exeContext: ExecutionContext = {
    validatedExecutionArgs,
    errors: [],
    abortSignalListener: abortSignal
      ? new AbortSignalListener(abortSignal)
      : undefined,
    completed: false,
  };
  try {
    const {
      schema,
      fragments,
      rootValue,
      operation,
      variableValues,
      hideSuggestions,
    } = validatedExecutionArgs;

    const { operation: operationType, selectionSet } = operation;

    const rootType = schema.getRootType(operationType);
    if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operationType} operation.`,
        { nodes: operation },
      );
    }

    const { groupedFieldSet } = collectFields(
      schema,
      fragments,
      variableValues,
      rootType,
      selectionSet,
      hideSuggestions,
    );

    const result = executeRootGroupedFieldSet(
      exeContext,
      operation.operation,
      rootType,
      rootValue,
      groupedFieldSet,
    );

    if (isPromise(result)) {
      return result.then(
        (resolved) => {
          exeContext.completed = true;
          return buildDataResponse(exeContext, resolved);
        },
        (error: unknown) => {
          exeContext.completed = true;
          exeContext.abortSignalListener?.disconnect();
          return {
            data: null,
            errors: [...exeContext.errors, error as GraphQLError],
          };
        },
      );
    }
    exeContext.completed = true;
    return buildDataResponse(exeContext, result);
  } catch (error) {
    exeContext.completed = true;
    // TODO: add test case for synchronous null bubbling to root with cancellation
    /* c8 ignore next */
    exeContext.abortSignalListener?.disconnect();
    return { data: null, errors: [...exeContext.errors, error] };
  }
}

function buildDataResponse(
  exeContext: ExecutionContext,
  data: ObjMap<unknown>,
): ExecutionResult {
  const errors = exeContext.errors;
  exeContext.abortSignalListener?.disconnect();
  return errors.length ? { errors, data } : { data };
}

function executeRootGroupedFieldSet(
  exeContext: ExecutionContext,
  operation: OperationTypeNode,
  rootType: GraphQLObjectType,
  rootValue: unknown,
  groupedFieldSet: GroupedFieldSet,
): PromiseOrValue<ObjMap<unknown>> {
  switch (operation) {
    case OperationTypeNode.QUERY:
      return executeFields(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
      );
    case OperationTypeNode.MUTATION:
      return executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
      );
    case OperationTypeNode.SUBSCRIPTION:
      // TODO: deprecate `subscribe` and move all logic here
      // Temporary solution until we finish merging execute and subscribe together
      return executeFields(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
      );
  }
}

/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that must be executed serially.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
): PromiseOrValue<ObjMap<unknown>> {
  const abortSignal = exeContext.validatedExecutionArgs.abortSignal;
  return promiseReduce(
    groupedFieldSet,
    (results, [responseName, fieldDetailsList]) => {
      const fieldPath = addPath(path, responseName, parentType.name);

      if (abortSignal?.aborted) {
        handleFieldError(
          abortSignal.reason,
          exeContext,
          parentType,
          fieldDetailsList,
          fieldPath,
        );
        results[responseName] = null;
        return results;
      }

      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldDetailsList,
        fieldPath,
      );
      if (result === undefined) {
        return results;
      }
      if (isPromise(result)) {
        return result.then((resolved) => {
          results[responseName] = resolved;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    },
    Object.create(null),
  );
}

/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that may be executed in parallel.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  try {
    for (const [responseName, fieldDetailsList] of groupedFieldSet) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldDetailsList,
        fieldPath,
      );

      if (result !== undefined) {
        results[responseName] = result;
        if (isPromise(result)) {
          containsPromise = true;
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      // Ensure that any promises returned by other fields are handled, as they may also reject.
      return promiseForObject(results).finally(() => {
        throw error;
      }) as never;
    }
    throw error;
  }

  // If there are no promises, we can just return the object and any incrementalDataRecords
  if (!containsPromise) {
    return results;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results);
}

function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}

/**
 * Implements the "Executing fields" section of the spec
 * In particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * coercing scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: unknown,
  fieldDetailsList: FieldDetailsList,
  path: Path,
): PromiseOrValue<unknown> {
  const { validatedExecutionArgs, abortSignalListener } = exeContext;
  const { schema, contextValue, variableValues, hideSuggestions, abortSignal } =
    validatedExecutionArgs;
  const firstFieldDetails = fieldDetailsList[0];
  const firstNode = firstFieldDetails.node;
  const fieldName = firstNode.name.value;
  const fieldDef = schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? validatedExecutionArgs.fieldResolver;

  const info = new ResolveInfo(
    validatedExecutionArgs,
    fieldDef,
    fieldDetailsList,
    parentType,
    path,
    abortSignal,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      firstNode,
      variableValues,
      firstFieldDetails.fragmentVariableValues,
      hideSuggestions,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const result = resolveFn(source, args, contextValue, info);

    if (isPromise(result)) {
      return completePromisedValue(
        exeContext,
        returnType,
        fieldDetailsList,
        info,
        path,
        abortSignalListener
          ? cancellablePromise(result, abortSignalListener)
          : result,
      );
    }

    const completed = completeValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      result,
    );

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError: unknown) => {
        handleFieldError(
          rawError,
          exeContext,
          returnType,
          fieldDetailsList,
          path,
        );
        return null;
      });
    }
    return completed;
  } catch (rawError) {
    handleFieldError(rawError, exeContext, returnType, fieldDetailsList, path);
    return null;
  }
}

function handleFieldError(
  rawError: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  path: Path,
): void {
  const error = locatedError(
    rawError,
    toNodes(fieldDetailsList),
    pathToArray(path),
  );

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (
    exeContext.validatedExecutionArgs.errorPropagation &&
    isNonNullType(returnType)
  ) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  exeContext.errors.push(error);
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Value Completion" section of the spec.
 *
 * If the field type is Non-Null, then this recursively completes the value
 * for the inner type. It throws a field error if that completion returns null,
 * as per the "Nullability" section of the spec.
 *
 * If the field type is a List, then this recursively completes the value
 * for the inner type on each item in the list.
 *
 * If the field type is a Scalar or Enum, ensures the completed value is a legal
 * value of the type by calling the `coerceOutputValue` method of GraphQL type
 * definition.
 *
 * If the field is an abstract type, determine the runtime type of the value
 * and then complete based on that type
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by executing all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<unknown> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (isNonNullType(returnType)) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldDetailsList,
      info,
      path,
      result,
    );
    if (completed === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType}.${info.fieldName}.`,
      );
    }
    return completed;
  }

  // If result value is null or undefined then return null.
  if (result == null) {
    return null;
  }

  // If field type is List, complete each item in the list with the inner type
  if (isListType(returnType)) {
    return completeListValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      result,
    );
  }

  // If field type is a leaf type, Scalar or Enum, coerce to a valid value,
  // returning null if coercion is not possible.
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isAbstractType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      result,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  if (isObjectType(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      result,
    );
    // c8 control statement technically placed a line early secondary to
    // slight swc source mapping error (at least as compared to ts-node without swc)
    /* c8 ignore next 7 */
  }
  // Not reachable, all possible output types have been considered.
  invariant(
    false,
    'Cannot complete value of unexpected output type: ' + inspect(returnType),
  );
}

async function completePromisedValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  result: Promise<unknown>,
): Promise<unknown> {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      resolved,
    );

    if (isPromise(completed)) {
      completed = await completed;
    }

    return completed;
  } catch (rawError) {
    handleFieldError(rawError, exeContext, returnType, fieldDetailsList, path);
    return null;
  }
}

/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
async function completeAsyncIterable(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  items: AsyncIterable<unknown>,
): Promise<ReadonlyArray<unknown>> {
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  const asyncIterator = items[Symbol.asyncIterator]();
  let index = 0;
  try {
    while (true) {
      const itemPath = addPath(path, index, undefined);
      let iteration;
      try {
        // eslint-disable-next-line no-await-in-loop
        iteration = await asyncIterator.next();
      } catch (rawError) {
        throw locatedError(
          rawError,
          toNodes(fieldDetailsList),
          pathToArray(path),
        );
      }

      // TODO: add test case for stream returning done before initialCount
      /* c8 ignore next 3 */
      if (iteration.done) {
        break;
      }

      const item = iteration.value;
      // TODO: add tests for stream backed by asyncIterator that returns a promise
      /* c8 ignore start */
      if (isPromise(item)) {
        completedResults.push(
          completePromisedListItemValue(
            item,
            exeContext,
            itemType,
            fieldDetailsList,
            info,
            itemPath,
          ),
        );
        containsPromise = true;
      } else if (
        /* c8 ignore stop */
        completeListItemValue(
          item,
          completedResults,
          exeContext,
          itemType,
          fieldDetailsList,
          info,
          itemPath,
        )
        // TODO: add tests for stream backed by asyncIterator that completes to a promise
        /* c8 ignore start */
      ) {
        containsPromise = true;
      }
      /* c8 ignore stop */
      index++;
    }
  } catch (error) {
    returnIteratorIgnoringErrors(asyncIterator);
    throw error;
  }

  return containsPromise
    ? /* c8 ignore start */ Promise.all(completedResults)
    : /* c8 ignore stop */ completedResults;
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLOutputType>,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ReadonlyArray<unknown>> {
  const itemType = returnType.ofType;

  if (isAsyncIterable(result)) {
    const abortSignalListener = exeContext.abortSignalListener;
    const maybeCancellableIterable = abortSignalListener
      ? cancellableIterable(result, abortSignalListener)
      : result;

    return completeAsyncIterable(
      exeContext,
      itemType,
      fieldDetailsList,
      info,
      path,
      maybeCancellableIterable,
    );
  }

  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType}.${info.fieldName}".`,
    );
  }

  return completeIterableValue(
    exeContext,
    itemType,
    fieldDetailsList,
    info,
    path,
    result,
  );
}

function completeIterableValue(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  items: Iterable<unknown>,
): PromiseOrValue<ReadonlyArray<unknown>> {
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  let index = 0;
  const iterator = items[Symbol.iterator]();
  try {
    while (true) {
      const iteration = iterator.next();
      if (iteration.done) {
        break;
      }

      const item = iteration.value;

      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const itemPath = addPath(path, index, undefined);

      if (isPromise(item)) {
        completedResults.push(
          completePromisedListItemValue(
            item,
            exeContext,
            itemType,
            fieldDetailsList,
            info,
            itemPath,
          ),
        );
        containsPromise = true;
      } else if (
        completeListItemValue(
          item,
          completedResults,
          exeContext,
          itemType,
          fieldDetailsList,
          info,
          itemPath,
        )
      ) {
        containsPromise = true;
      }
      index++;
    }
  } catch (error) {
    returnIteratorIgnoringErrors(iterator);
    throw error;
  }

  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a list item value by adding it to the completed results.
 *
 * Returns true if the value is a Promise.
 */
function completeListItemValue(
  item: unknown,
  completedResults: Array<unknown>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemPath: Path,
): boolean {
  try {
    const completedItem = completeValue(
      exeContext,
      itemType,
      fieldDetailsList,
      info,
      itemPath,
      item,
    );

    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(undefined, (rawError: unknown) => {
          handleFieldError(
            rawError,
            exeContext,
            itemType,
            fieldDetailsList,
            itemPath,
          );
          return null;
        }),
      );
      return true;
    }

    completedResults.push(completedItem);
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldDetailsList,
      itemPath,
    );
    completedResults.push(null);
  }
  return false;
}

async function completePromisedListItemValue(
  item: Promise<unknown>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemPath: Path,
): Promise<unknown> {
  try {
    const abortSignalListener = exeContext.abortSignalListener;
    const maybeCancellableItem = abortSignalListener
      ? cancellablePromise(item, abortSignalListener)
      : item;
    const resolved = await maybeCancellableItem;
    let completed = completeValue(
      exeContext,
      itemType,
      fieldDetailsList,
      info,
      itemPath,
      resolved,
    );
    if (isPromise(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldDetailsList,
      itemPath,
    );
    return null;
  }
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: unknown,
): unknown {
  const coerced = returnType.coerceOutputValue(result);
  if (coerced == null) {
    throw new Error(
      `Expected \`${inspect(returnType)}.coerceOutputValue(${inspect(result)})\` to ` +
        `return non-nullable value, returned: ${inspect(coerced)}`,
    );
  }
  return coerced;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
  const validatedExecutionArgs = exeContext.validatedExecutionArgs;
  const { schema, contextValue } = validatedExecutionArgs;
  const resolveTypeFn =
    returnType.resolveType ?? validatedExecutionArgs.typeResolver;
  const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

  if (isPromise(runtimeType)) {
    return runtimeType.then((resolvedRuntimeType) =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          schema,
          returnType,
          fieldDetailsList,
          info,
          result,
        ),
        fieldDetailsList,
        info,
        path,
        result,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      schema,
      returnType,
      fieldDetailsList,
      info,
      result,
    ),
    fieldDetailsList,
    info,
    path,
    result,
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  schema: GraphQLSchema,
  returnType: GraphQLAbstractType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  result: unknown,
): GraphQLObjectType {
  if (runtimeTypeName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}". Either the "${returnType}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  if (typeof runtimeTypeName !== 'string') {
    throw new GraphQLError(
      `Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}" with ` +
        `value ${inspect(result)}, received "${inspect(
          runtimeTypeName,
        )}", which is not a valid Object type name.`,
    );
  }

  const runtimeType = schema.getType(runtimeTypeName);
  if (runtimeType == null) {
    throw new GraphQLError(
      `Abstract type "${returnType}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType}" was resolved to a non-object type "${runtimeTypeName}".`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  if (!schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType}" is not a possible type for "${returnType}".`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  return runtimeType;
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
  if (exeContext.completed) {
    throw new Error('Completed, aborting.');
  }

  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(
      result,
      exeContext.validatedExecutionArgs.contextValue,
      info,
    );

    if (isPromise(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldDetailsList);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldDetailsList,
          path,
          result,
        );
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldDetailsList);
    }
  }

  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldDetailsList,
    path,
    result,
  );
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldDetailsList: FieldDetailsList,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType}" but got: ${inspect(result)}.`,
    { nodes: toNodes(fieldDetailsList) },
  );
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
  const validatedExecutionArgs = exeContext.validatedExecutionArgs;

  // Collect sub-fields to execute to complete this value.
  const collectedSubfields = collectSubfields(
    validatedExecutionArgs,
    returnType,
    fieldDetailsList,
  );
  const groupedFieldSet = collectedSubfields;

  return executeFields(exeContext, returnType, result, path, groupedFieldSet);
}

export function mapSourceToResponse(
  validatedExecutionArgs: ValidatedExecutionArgs,
  resultOrStream: ExecutionResult | AsyncIterable<unknown>,
): AsyncGenerator<ExecutionResult, void, void> | ExecutionResult {
  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  const abortSignal = validatedExecutionArgs.abortSignal;
  const abortSignalListener = abortSignal
    ? new AbortSignalListener(abortSignal)
    : undefined;

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification..
  function mapFn(payload: unknown): PromiseOrValue<ExecutionResult> {
    const perEventExecutionArgs: ValidatedExecutionArgs = {
      ...validatedExecutionArgs,
      rootValue: payload,
    };
    return validatedExecutionArgs.perEventExecutor(perEventExecutionArgs);
  }

  return abortSignalListener
    ? withConcurrentAbruptClose(
        mapAsyncIterable(
          cancellableIterable(resultOrStream, abortSignalListener),
          mapFn,
        ),
        () => abortSignalListener.disconnect(),
      )
    : mapAsyncIterable(resultOrStream, mapFn);
}

export function createSourceEventStreamImpl(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  try {
    const eventStream = executeSubscription(validatedExecutionArgs);
    if (isPromise(eventStream)) {
      return eventStream.then(undefined, (error: unknown) => ({
        errors: [error as GraphQLError],
      }));
    }

    return eventStream;
  } catch (error) {
    return { errors: [error] };
  }
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
    abortSignal,
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

  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  const path = addPath(undefined, responseName, rootType.name);
  const info = new ResolveInfo(
    validatedExecutionArgs,
    fieldDef,
    fieldDetailsList,
    rootType,
    path,
    abortSignal,
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

    if (isPromise(result)) {
      const abortSignalListener = abortSignal
        ? new AbortSignalListener(abortSignal)
        : undefined;

      const promise = abortSignalListener
        ? cancellablePromise(result, abortSignalListener)
        : result;
      return promise.then(assertEventStream).then(
        (resolved) => {
          abortSignalListener?.disconnect();
          return resolved;
        },
        (error: unknown) => {
          abortSignalListener?.disconnect();
          throw locatedError(
            error,
            toNodes(fieldDetailsList),
            pathToArray(path),
          );
        },
      );
    }

    return assertEventStream(result);
  } catch (error) {
    throw locatedError(error, toNodes(fieldDetailsList), pathToArray(path));
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

function returnIteratorIgnoringErrors(
  iterator: Iterator<unknown> | AsyncIterator<unknown>,
) {
  try {
    const result = iterator.return?.();
    if (isPromise(result)) {
      result.catch(() => {
        // ignore errors
      });
    }
  } catch {
    // ignore errors
  }
}
