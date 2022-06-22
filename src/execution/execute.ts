import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { isIterableObject } from '../jsutils/isIterableObject';
import { isObjectLike } from '../jsutils/isObjectLike';
import { isPromise } from '../jsutils/isPromise';
import type { Maybe } from '../jsutils/Maybe';
import { memoize3 } from '../jsutils/memoize3';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';
import { addPath, pathToArray } from '../jsutils/Path';
import { promiseForObject } from '../jsutils/promiseForObject';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { promiseReduce } from '../jsutils/promiseReduce';

import type { GraphQLFormattedError } from '../error/GraphQLError';
import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast';
import { OperationTypeNode } from '../language/ast';
import { Kind } from '../language/kinds';

import type {
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from '../type/definition';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition';
import { GraphQLStreamDirective } from '../type/directives';
import type { GraphQLSchema } from '../type/schema';
import { assertValidSchema } from '../type/validate';

import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields';
import { flattenAsyncIterator } from './flattenAsyncIterator';
import { mapAsyncIterator } from './mapAsyncIterator';
import {
  getArgumentValues,
  getDirectiveValues,
  getVariableValues,
} from './values';

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
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
  ) =>
    _collectSubfields(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      returnType,
      fieldNodes,
    ),
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
export interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  errors: Array<GraphQLError>;
  subsequentPayloads: Array<AsyncPayloadRecord>;
}

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export interface ExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  hasNext?: boolean;
  extensions?: TExtensions;
}

export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  hasNext?: boolean;
  extensions?: TExtensions;
}

/**
 * The result of an asynchronous GraphQL patch.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of the additional asynchronous data.
 *   - `path` is the location of data.
 *   - `label` is the label provided to `@defer` or `@stream`.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export interface ExecutionPatchResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface FormattedExecutionPatchResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
}

export type AsyncExecutionResult = ExecutionResult | ExecutionPatchResult;
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
  ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  return executeImpl(exeContext);
}

function executeImpl(
  exeContext: ExecutionContext,
): PromiseOrValue<
  ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
> {
  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  //
  // Errors from sub-fields of a NonNull type may propagate to the top level,
  // at which point we still log the error and null the parent field, which
  // in this case is the entire response.
  try {
    const result = executeOperation(exeContext);
    if (isPromise(result)) {
      return result.then(
        (data) => {
          const initialResult = buildResponse(data, exeContext.errors);
          if (exeContext.subsequentPayloads.length > 0) {
            return yieldSubsequentPayloads(exeContext, initialResult);
          }
          return initialResult;
        },
        (error) => {
          exeContext.errors.push(error);
          return buildResponse(null, exeContext.errors);
        },
      );
    }
    const initialResult = buildResponse(result, exeContext.errors);
    if (exeContext.subsequentPayloads.length > 0) {
      return yieldSubsequentPayloads(exeContext, initialResult);
    }
    return initialResult;
  } catch (error) {
    exeContext.errors.push(error);
    return buildResponse(null, exeContext.errors);
  }
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = execute(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || isAsyncIterable(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

/**
 * Given a completed execution context and data, build the `{ errors, data }`
 * response defined by the "Response" section of the GraphQL specification.
 */
function buildResponse(
  data: ObjMap<unknown> | null,
  errors: ReadonlyArray<GraphQLError>,
): ExecutionResult {
  return errors.length === 0 ? { data } : { errors, data };
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * TODO: consider no longer exporting this function
 * @internal
 */
export function buildExecutionContext(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ExecutionContext {
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues: rawVariableValues,
    operationName,
    fieldResolver,
    typeResolver,
    subscribeFieldResolver,
  } = args;

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  let operation: OperationDefinitionNode | undefined;
  const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError(
                'Must provide operation name if query contains multiple operations.',
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
      default:
      // ignore non-executable definitions
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
  const variableDefinitions = operation.variableDefinitions ?? [];

  const coercedVariableValues = getVariableValues(
    schema,
    variableDefinitions,
    rawVariableValues ?? {},
    { maxErrors: 50 },
  );

  if (coercedVariableValues.errors) {
    return coercedVariableValues.errors;
  }

  return {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: coercedVariableValues.coerced,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    subsequentPayloads: [],
    errors: [],
  };
}

function buildPerEventExecutionContext(
  exeContext: ExecutionContext,
  payload: unknown,
): ExecutionContext {
  return {
    ...exeContext,
    rootValue: payload,
    errors: [],
  };
}

/**
 * Implements the "Executing operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
): PromiseOrValue<ObjMap<unknown>> {
  const { operation, schema, fragments, variableValues, rootValue } =
    exeContext;
  const rootType = schema.getRootType(operation.operation);
  if (rootType == null) {
    throw new GraphQLError(
      `Schema is not configured to execute ${operation.operation} operation.`,
      { nodes: operation },
    );
  }

  const { fields: rootFields, patches } = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation.selectionSet,
  );
  const path = undefined;
  let result;

  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      result = executeFields(exeContext, rootType, rootValue, path, rootFields);
      break;
    case OperationTypeNode.MUTATION:
      result = executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        rootFields,
      );
      break;
    case OperationTypeNode.SUBSCRIPTION:
      // TODO: deprecate `subscribe` and move all logic here
      // Temporary solution until we finish merging execute and subscribe together
      result = executeFields(exeContext, rootType, rootValue, path, rootFields);
  }

  for (const patch of patches) {
    const { label, fields: patchFields } = patch;
    executeDeferredFragment(
      exeContext,
      rootType,
      rootValue,
      patchFields,
      label,
      path,
    );
  }

  return result;
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
  fields: Map<string, ReadonlyArray<FieldNode>>,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    fields.entries(),
    (results, [responseName, fieldNodes]) => {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
      );
      if (result === undefined) {
        return results;
      }
      if (isPromise(result)) {
        return result.then((resolvedResult) => {
          results[responseName] = resolvedResult;
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
  fields: Map<string, ReadonlyArray<FieldNode>>,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  for (const [responseName, fieldNodes] of fields.entries()) {
    const fieldPath = addPath(path, responseName, parentType.name);
    const result = executeField(
      exeContext,
      parentType,
      sourceValue,
      fieldNodes,
      fieldPath,
      asyncPayloadRecord,
    );

    if (result !== undefined) {
      results[responseName] = result;
      if (isPromise(result)) {
        containsPromise = true;
      }
    }
  }

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return results;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results);
}

/**
 * Implements the "Executing fields" section of the spec
 * In particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * serialize scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: unknown,
  fieldNodes: ReadonlyArray<FieldNode>,
  path: Path,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<unknown> {
  const errors = asyncPayloadRecord?.errors ?? exeContext.errors;
  const fieldName = fieldNodes[0].name.value;
  const fieldDef = exeContext.schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    parentType,
    path,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      fieldNodes[0],
      exeContext.variableValues,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    const result = resolveFn(source, args, contextValue, info);

    let completed;
    if (isPromise(result)) {
      completed = result.then((resolved) =>
        completeValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path,
          resolved,
          asyncPayloadRecord,
        ),
      );
    } else {
      completed = completeValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        asyncPayloadRecord,
      );
    }

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        const error = locatedError(rawError, fieldNodes, pathToArray(path));
        return handleFieldError(error, returnType, errors);
      });
    }
    return completed;
  } catch (rawError) {
    const error = locatedError(rawError, fieldNodes, pathToArray(path));
    return handleFieldError(error, returnType, errors);
  }
}

/**
 * TODO: consider no longer exporting this function
 * @internal
 */
export function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNodes: ReadonlyArray<FieldNode>,
  parentType: GraphQLObjectType,
  path: Path,
): GraphQLResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldNodes,
    returnType: fieldDef.type,
    parentType,
    path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };
}

function handleFieldError(
  error: GraphQLError,
  returnType: GraphQLOutputType,
  errors: Array<GraphQLError>,
): null {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  errors.push(error);
  return null;
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
 * value of the type by calling the `serialize` method of GraphQL type
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
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  asyncPayloadRecord?: AsyncPayloadRecord,
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
      fieldNodes,
      info,
      path,
      result,
      asyncPayloadRecord,
    );
    if (completed === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
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
      fieldNodes,
      info,
      path,
      result,
      asyncPayloadRecord,
    );
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isAbstractType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      asyncPayloadRecord,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  if (isObjectType(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      asyncPayloadRecord,
    );
  }
  /* c8 ignore next 6 */
  // Not reachable, all possible output types have been considered.
  invariant(
    false,
    'Cannot complete value of unexpected output type: ' + inspect(returnType),
  );
}

/**
 * Returns an object containing the `@stream` arguments if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamValues(
  exeContext: ExecutionContext,
  fieldNodes: ReadonlyArray<FieldNode>,
  path: Path,
):
  | undefined
  | {
      initialCount?: number;
      label?: string;
    } {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }

  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    fieldNodes[0],
    exeContext.variableValues,
  );

  if (!stream) {
    return;
  }

  if (stream.if === false) {
    return;
  }

  invariant(
    typeof stream.initialCount === 'number',
    'initialCount must be a number',
  );

  invariant(
    stream.initialCount >= 0,
    'initialCount must be a positive integer',
  );

  return {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
  };
}

/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
async function completeAsyncIteratorValue(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  iterator: AsyncIterator<unknown>,
  asyncPayloadRecord?: AsyncPayloadRecord,
): Promise<ReadonlyArray<unknown>> {
  const errors = asyncPayloadRecord?.errors ?? exeContext.errors;
  const stream = getStreamValues(exeContext, fieldNodes, path);
  let containsPromise = false;
  const completedResults = [];
  let index = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (
      stream &&
      typeof stream.initialCount === 'number' &&
      index >= stream.initialCount
    ) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      executeStreamIterator(
        index,
        iterator,
        exeContext,
        fieldNodes,
        info,
        itemType,
        path,
        stream.label,
        asyncPayloadRecord,
      );
      break;
    }

    const fieldPath = addPath(path, index, undefined);
    try {
      // eslint-disable-next-line no-await-in-loop
      const { value, done } = await iterator.next();
      if (done) {
        break;
      }

      try {
        // TODO can the error checking logic be consolidated with completeListValue?
        const completedItem = completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          fieldPath,
          value,
          asyncPayloadRecord,
        );
        if (isPromise(completedItem)) {
          containsPromise = true;
        }
        completedResults.push(completedItem);
      } catch (rawError) {
        completedResults.push(null);
        const error = locatedError(
          rawError,
          fieldNodes,
          pathToArray(fieldPath),
        );
        handleFieldError(error, itemType, errors);
      }
    } catch (rawError) {
      completedResults.push(null);
      const error = locatedError(rawError, fieldNodes, pathToArray(fieldPath));
      handleFieldError(error, itemType, errors);
      break;
    }
    index += 1;
  }
  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLOutputType>,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ReadonlyArray<unknown>> {
  const itemType = returnType.ofType;
  const errors = asyncPayloadRecord?.errors ?? exeContext.errors;

  if (isAsyncIterable(result)) {
    const iterator = result[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldNodes,
      info,
      path,
      iterator,
      asyncPayloadRecord,
    );
  }

  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }

  const stream = getStreamValues(exeContext, fieldNodes, path);

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  let previousAsyncPayloadRecord = asyncPayloadRecord;
  const completedResults = [];
  let index = 0;
  for (const item of result) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);
    try {
      let completedItem;

      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        previousAsyncPayloadRecord = executeStreamField(
          itemPath,
          item,
          exeContext,
          fieldNodes,
          info,
          itemType,
          stream.label,
          previousAsyncPayloadRecord,
        );
        index++;
        continue;
      }
      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            asyncPayloadRecord,
          ),
        );
      } else {
        completedItem = completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          itemPath,
          item,
          asyncPayloadRecord,
        );
      }

      if (isPromise(completedItem)) {
        containsPromise = true;
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        completedResults.push(
          completedItem.then(undefined, (rawError) => {
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(itemPath),
            );
            return handleFieldError(error, itemType, errors);
          }),
        );
      } else {
        completedResults.push(completedItem);
      }
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
      completedResults.push(handleFieldError(error, itemType, errors));
    }
    index++;
  }

  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: unknown,
): unknown {
  const serializedResult = returnType.serialize(result);
  if (serializedResult == null) {
    throw new Error(
      `Expected \`${inspect(returnType)}.serialize(${inspect(result)})\` to ` +
        `return non-nullable value, returned: ${inspect(serializedResult)}`,
    );
  }
  return serializedResult;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ObjMap<unknown>> {
  const resolveTypeFn = returnType.resolveType ?? exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

  if (isPromise(runtimeType)) {
    return runtimeType.then((resolvedRuntimeType) =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          exeContext,
          returnType,
          fieldNodes,
          info,
          result,
        ),
        fieldNodes,
        info,
        path,
        result,
        asyncPayloadRecord,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      exeContext,
      returnType,
      fieldNodes,
      info,
      result,
    ),
    fieldNodes,
    info,
    path,
    result,
    asyncPayloadRecord,
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  result: unknown,
): GraphQLObjectType {
  if (runtimeTypeName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      { nodes: fieldNodes },
    );
  }

  // releases before 16.0.0 supported returning `GraphQLObjectType` from `resolveType`
  // TODO: remove in 17.0.0 release
  if (isObjectType(runtimeTypeName)) {
    throw new GraphQLError(
      'Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead.',
    );
  }

  if (typeof runtimeTypeName !== 'string') {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
        `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
    );
  }

  const runtimeType = exeContext.schema.getType(runtimeTypeName);
  if (runtimeType == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
      { nodes: fieldNodes },
    );
  }

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
      { nodes: fieldNodes },
    );
  }

  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      { nodes: fieldNodes },
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
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ObjMap<unknown>> {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);

    if (isPromise(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldNodes,
          path,
          result,
          asyncPayloadRecord,
        );
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldNodes);
    }
  }

  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldNodes,
    path,
    result,
    asyncPayloadRecord,
  );
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldNodes: ReadonlyArray<FieldNode>,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    { nodes: fieldNodes },
  );
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldNodes: ReadonlyArray<FieldNode>,
  path: Path,
  result: unknown,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const { fields: subFieldNodes, patches: subPatches } = collectSubfields(
    exeContext,
    returnType,
    fieldNodes,
  );

  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    subFieldNodes,
    asyncPayloadRecord,
  );

  for (const subPatch of subPatches) {
    const { label, fields: subPatchFieldNodes } = subPatch;
    executeDeferredFragment(
      exeContext,
      returnType,
      result,
      subPatchFieldNodes,
      label,
      path,
      asyncPayloadRecord,
    );
  }

  return subFields;
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
    // First, look for `__typename`.
    if (isObjectLike(value) && typeof value.__typename === 'string') {
      return value.__typename;
    }

    // Otherwise, test each possible type.
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults = [];

    for (let i = 0; i < possibleTypes.length; i++) {
      const type = possibleTypes[i];

      if (type.isTypeOf) {
        const isTypeOfResult = type.isTypeOf(value, contextValue, info);

        if (isPromise(isTypeOfResult)) {
          promisedIsTypeOfResults[i] = isTypeOfResult;
        } else if (isTypeOfResult) {
          return type.name;
        }
      }
    }

    if (promisedIsTypeOfResults.length) {
      return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
        for (let i = 0; i < isTypeOfResults.length; i++) {
          if (isTypeOfResults[i]) {
            return possibleTypes[i].name;
          }
        }
      });
    }
  };

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return source[info.fieldName](args, contextValue, info);
      }
      return property;
    }
  };

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
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  const resultOrStream = createSourceEventStreamImpl(exeContext);

  if (isPromise(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      mapSourceToResponse(exeContext, resolvedResultOrStream),
    );
  }

  return mapSourceToResponse(exeContext, resultOrStream);
}

function mapSourceToResponse(
  exeContext: ExecutionContext,
  resultOrStream: ExecutionResult | AsyncIterable<unknown>,
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
  return flattenAsyncIterator<ExecutionResult, AsyncExecutionResult>(
    mapAsyncIterator(resultOrStream, (payload: unknown) =>
      executeImpl(buildPerEventExecutionContext(exeContext, payload)),
    ),
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
  args: ExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  return createSourceEventStreamImpl(exeContext);
}

function createSourceEventStreamImpl(
  exeContext: ExecutionContext,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
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

  const { fields: rootFields } = collectFields(
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
    const result = resolveFn(rootValue, args, contextValue, info);

    if (isPromise(result)) {
      return result.then(assertEventStream).then(undefined, (error) => {
        throw locatedError(error, fieldNodes, pathToArray(path));
      });
    }

    return assertEventStream(result);
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
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

function executeDeferredFragment(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  fields: Map<string, ReadonlyArray<FieldNode>>,
  label?: string,
  path?: Path,
  parentContext?: AsyncPayloadRecord,
): void {
  const asyncPayloadRecord = new AsyncPayloadRecord({
    label,
    path,
    parentContext,
  });
  let promiseOrData;
  try {
    promiseOrData = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      fields,
      asyncPayloadRecord,
    );

    if (isPromise(promiseOrData)) {
      promiseOrData = promiseOrData.then(null, (e) => {
        asyncPayloadRecord.errors.push(e);
        return null;
      });
    }
  } catch (e) {
    asyncPayloadRecord.errors.push(e);
    promiseOrData = null;
  }
  asyncPayloadRecord.addData(promiseOrData);
  exeContext.subsequentPayloads.push(asyncPayloadRecord);
}

function executeStreamField(
  path: Path,
  item: PromiseOrValue<unknown>,
  exeContext: ExecutionContext,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  label?: string,
  parentContext?: AsyncPayloadRecord,
): AsyncPayloadRecord {
  const asyncPayloadRecord = new AsyncPayloadRecord({
    label,
    path,
    parentContext,
  });
  let completedItem: PromiseOrValue<unknown>;
  try {
    try {
      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            path,
            resolved,
            asyncPayloadRecord,
          ),
        );
      } else {
        completedItem = completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          path,
          item,
          asyncPayloadRecord,
        );
      }

      if (isPromise(completedItem)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        completedItem = completedItem.then(undefined, (rawError) => {
          const error = locatedError(rawError, fieldNodes, pathToArray(path));
          return handleFieldError(error, itemType, asyncPayloadRecord.errors);
        });
      }
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(path));
      completedItem = handleFieldError(
        error,
        itemType,
        asyncPayloadRecord.errors,
      );
    }
  } catch (error) {
    asyncPayloadRecord.errors.push(error);
    asyncPayloadRecord.addData(null);
    exeContext.subsequentPayloads.push(asyncPayloadRecord);
    return asyncPayloadRecord;
  }

  if (isPromise(completedItem)) {
    completedItem = completedItem.then(
      (value) => [value],
      (error) => {
        asyncPayloadRecord.errors.push(error);
        return null;
      },
    );
  } else {
    completedItem = [completedItem];
  }

  asyncPayloadRecord.addData(completedItem);
  exeContext.subsequentPayloads.push(asyncPayloadRecord);
  return asyncPayloadRecord;
}

async function executeStreamIteratorItem(
  iterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  asyncPayloadRecord: AsyncPayloadRecord,
  fieldPath: Path,
): Promise<IteratorResult<unknown>> {
  let item;
  try {
    const { value, done } = await iterator.next();
    if (done) {
      asyncPayloadRecord.setIsCompletedIterator();
      return { done, value: undefined };
    }
    item = value;
  } catch (rawError) {
    const error = locatedError(rawError, fieldNodes, pathToArray(fieldPath));
    const value = handleFieldError(error, itemType, asyncPayloadRecord.errors);
    // don't continue if iterator throws
    return { done: true, value };
  }
  let completedItem;
  try {
    completedItem = completeValue(
      exeContext,
      itemType,
      fieldNodes,
      info,
      fieldPath,
      item,
      asyncPayloadRecord,
    );

    if (isPromise(completedItem)) {
      completedItem = completedItem.then(undefined, (rawError) => {
        const error = locatedError(
          rawError,
          fieldNodes,
          pathToArray(fieldPath),
        );
        return handleFieldError(error, itemType, asyncPayloadRecord.errors);
      });
    }
    return { done: false, value: completedItem };
  } catch (rawError) {
    const error = locatedError(rawError, fieldNodes, pathToArray(fieldPath));
    const value = handleFieldError(error, itemType, asyncPayloadRecord.errors);
    return { done: false, value };
  }
}

async function executeStreamIterator(
  initialIndex: number,
  iterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  path?: Path,
  label?: string,
  parentContext?: AsyncPayloadRecord,
): Promise<void> {
  const subsequentPayloads = exeContext.subsequentPayloads;
  let index = initialIndex;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const fieldPath = addPath(path, index, undefined);
    const asyncPayloadRecord = new AsyncPayloadRecord({
      label,
      path: fieldPath,
      parentContext,
    });

    const dataPromise = executeStreamIteratorItem(
      iterator,
      exeContext,
      fieldNodes,
      info,
      itemType,
      asyncPayloadRecord,
      fieldPath,
    );

    asyncPayloadRecord.addData(
      dataPromise
        .then(({ value }) => value)
        .then(
          (value) => [value],
          (err) => {
            asyncPayloadRecord.errors.push(err);
            return null;
          },
        ),
    );
    subsequentPayloads.push(asyncPayloadRecord);
    try {
      // eslint-disable-next-line no-await-in-loop
      const { done } = await dataPromise;
      if (done) {
        break;
      }
    } catch (err) {
      // do nothing, error is already handled above
    }
    index++;
  }
}

function yieldSubsequentPayloads(
  exeContext: ExecutionContext,
  initialResult: ExecutionResult,
): AsyncGenerator<AsyncExecutionResult, void, void> {
  let _hasReturnedInitialResult = false;

  async function race(): Promise<IteratorResult<AsyncExecutionResult>> {
    if (exeContext.subsequentPayloads.length === 0) {
      // async iterable resolver just finished and no more pending payloads
      return {
        value: {
          hasNext: false,
        },
        done: false,
      };
    }

    const asyncPayloadRecord: AsyncPayloadRecord = await new Promise(
      (resolve) => {
        exeContext.subsequentPayloads.forEach((payload) => {
          const data = payload.getData();
          if (isPromise(data)) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            data.then(() => {
              resolve(payload);
            });
          } else {
            resolve(payload);
          }
        });
      },
    );

    const data = await asyncPayloadRecord.data;

    const index = exeContext.subsequentPayloads.indexOf(asyncPayloadRecord);
    exeContext.subsequentPayloads.splice(index, 1);

    if (asyncPayloadRecord.isCompletedIterator) {
      // async iterable resolver just finished but there may be pending payloads
      // return the next one
      return race();
    }

    const returnValue: ExecutionPatchResult = {
      data,
      path: asyncPayloadRecord.path ? pathToArray(asyncPayloadRecord.path) : [],
      hasNext: exeContext.subsequentPayloads.length > 0,
    };
    if (asyncPayloadRecord.label) {
      returnValue.label = asyncPayloadRecord.label;
    }
    if (asyncPayloadRecord.errors.length > 0) {
      returnValue.errors = asyncPayloadRecord.errors;
    }
    return {
      value: returnValue,
      done: false,
    };
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: () => {
      if (!_hasReturnedInitialResult) {
        _hasReturnedInitialResult = true;
        return Promise.resolve({
          value: {
            ...initialResult,
            hasNext: true,
          },
          done: false,
        });
      } else if (exeContext.subsequentPayloads.length === 0) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return race();
    },
    // TODO: implement return & throw
    // c8 ignore next 2
    // will be covered in follow up
    return: () => Promise.resolve({ value: undefined, done: true }),

    // c8 ignore next 2
    // will be covered in follow up
    throw: (error?: unknown) => Promise.reject(error),
  };
}

class AsyncPayloadRecord {
  errors: Array<GraphQLError>;
  label?: string;
  path?: Path;
  data?: PromiseOrValue<unknown>;
  parentContext?: AsyncPayloadRecord;
  iterator?: AsyncIterator<unknown>;
  isCompletedIterator?: boolean;
  constructor(opts: {
    label?: string;
    path?: Path;
    iterator?: AsyncIterator<unknown>;
    parentContext?: AsyncPayloadRecord;
  }) {
    this.label = opts.label;
    this.path = opts.path;
    this.parentContext = opts.parentContext;
    this.iterator = opts.iterator;
    this.errors = [];
  }

  addData(data: PromiseOrValue<unknown>) {
    this.data = data;
  }

  getData(): PromiseOrValue<unknown> {
    const parentData = this.parentContext?.getData();
    if (parentData) {
      return Promise.resolve(parentData).then(() => this.data);
    }
    return this.data;
  }

  setIsCompletedIterator() {
    this.isCompletedIterator = true;
  }
}
