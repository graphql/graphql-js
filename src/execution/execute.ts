import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { Maybe } from '../jsutils/Maybe.js';
import { memoize3 } from '../jsutils/memoize3.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import { promiseForObject } from '../jsutils/promiseForObject.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { promiseReduce } from '../jsutils/promiseReduce.js';

import { GraphQLError } from '../error/GraphQLError.js';
import { locatedError } from '../error/locatedError.js';

import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';
import { OperationTypeNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

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
} from '../type/definition.js';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.js';
import { GraphQLStreamDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
import { assertValidSchema } from '../type/validate.js';

import type {
  DeferUsageSet,
  FieldGroup,
  GroupedFieldSet,
} from './buildFieldPlan.js';
import { buildFieldPlan } from './buildFieldPlan.js';
import type { DeferUsage, FieldDetails } from './collectFields.js';
import { collectFields, collectSubfields } from './collectFields.js';
import type {
  CancellableStreamRecord,
  DeferredGroupedFieldSetRecord,
  DeferredGroupedFieldSetResult,
  ExecutionResult,
  ExperimentalIncrementalExecutionResults,
  IncrementalDataRecord,
  StreamItemsRecord,
  StreamItemsResult,
  SubsequentResultRecord,
} from './IncrementalPublisher.js';
import {
  buildIncrementalResponse,
  DeferredFragmentRecord,
  isNonTerminatingStreamItemsResult,
} from './IncrementalPublisher.js';
import { mapAsyncIterable } from './mapAsyncIterable.js';
import {
  getArgumentValues,
  getDirectiveValues,
  getVariableValues,
} from './values.js';

/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

/**
 * A memoized function for building subfield plans with regard to the return
 * type. Memoizing ensures the subfield plans are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const buildSubFieldPlan = memoize3(
  (
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldGroup: FieldGroup,
  ) => {
    const { fields: subFields, newDeferUsages } = collectSubfields(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      exeContext.operation,
      returnType,
      fieldGroup.fields,
    );
    return {
      ...buildFieldPlan(subFields, fieldGroup.deferUsages),
      newDeferUsages,
    };
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
  cancellableStreams: Set<CancellableStreamRecord>;
}

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

export interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldGroup: FieldGroup;
}

type GraphQLResult<T> = [T, ReadonlyArray<IncrementalDataRecord>];

const UNEXPECTED_EXPERIMENTAL_DIRECTIVES =
  'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.';

const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';

/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, it will throw or return a rejected promise.
 * Use `experimentalExecuteIncrementally` if you want to support incremental
 * delivery.
 */
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  if (args.schema.getDirective('defer') || args.schema.getDirective('stream')) {
    throw new Error(UNEXPECTED_EXPERIMENTAL_DIRECTIVES);
  }

  const result = experimentalExecuteIncrementally(args);
  if (!isPromise(result)) {
    if ('initialResult' in result) {
      // This can happen if the operation contains @defer or @stream directives
      // and is not validated prior to execution
      throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    }
    return result;
  }

  return result.then((incrementalResult) => {
    if ('initialResult' in incrementalResult) {
      // This can happen if the operation contains @defer or @stream directives
      // and is not validated prior to execution
      throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    }
    return incrementalResult;
  });
}

/**
 * Implements the "Executing requests" section of the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
 *
 * This function returns a Promise of an ExperimentalIncrementalExecutionResults
 * object. This object either consists of a single ExecutionResult, or an
 * object containing an `initialResult` and a stream of `subsequentResults`.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function experimentalExecuteIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  return executeOperation(exeContext);
}

/**
 * Implements the "Executing operations" section of the spec.
 *
 * Returns a Promise that will eventually resolve to the data described by
 * The "Response" section of the GraphQL specification.
 *
 * If errors are encountered while executing a GraphQL field, only that
 * field and its descendants will be omitted, and sibling fields will still
 * be executed. An execution which encounters errors will still result in a
 * resolved Promise.
 *
 * Errors from sub-fields of a NonNull type may propagate to the top level,
 * at which point we still log the error and null the parent field, which
 * in this case is the entire response.
 */
function executeOperation(
  exeContext: ExecutionContext,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  const errors: Array<GraphQLError> = [];
  try {
    const { operation, schema, fragments, variableValues, rootValue } =
      exeContext;
    const rootType = schema.getRootType(operation.operation);
    if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        { nodes: operation },
      );
    }

    const { fields, newDeferUsages } = collectFields(
      schema,
      fragments,
      variableValues,
      rootType,
      operation,
    );
    const { groupedFieldSet, newGroupedFieldSets } = buildFieldPlan(fields);

    const newDeferMap = addNewDeferredFragments(newDeferUsages, new Map());

    let acc = executeRootGroupedFieldSet(
      exeContext,
      operation.operation,
      rootType,
      rootValue,
      groupedFieldSet,
      errors,
      newDeferMap,
    );

    const newDeferredGroupedFieldSetRecords = executeDeferredGroupedFieldSets(
      exeContext,
      rootType,
      rootValue,
      undefined,
      undefined,
      newGroupedFieldSets,
      newDeferMap,
    );

    acc = withNewDeferredGroupedFieldSets(
      acc,
      newDeferredGroupedFieldSetRecords,
    );
    if (isPromise(acc)) {
      return acc.then(
        (resolved) =>
          buildDataResponse(exeContext, resolved[0], errors, resolved[1]),
        (error) => ({
          data: null,
          errors: withError(errors, error),
        }),
      );
    }
    return buildDataResponse(exeContext, acc[0], errors, acc[1]);
  } catch (error) {
    return { data: null, errors: withError(errors, error) };
  }
}

function withNewDeferredGroupedFieldSets(
  result: PromiseOrValue<GraphQLResult<ObjMap<unknown>>>,
  newDeferredGroupedFieldSetRecords: ReadonlyArray<DeferredGroupedFieldSetRecord>,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
  if (isPromise(result)) {
    return result.then((resolved) => {
      appendNewIncrementalDataRecords(
        resolved,
        newDeferredGroupedFieldSetRecords,
      );
      return resolved;
    });
  }

  appendNewIncrementalDataRecords(result, newDeferredGroupedFieldSetRecords);
  return result;
}

function appendNewIncrementalDataRecords(
  acc: GraphQLResult<unknown>,
  newRecords: ReadonlyArray<IncrementalDataRecord>,
): void {
  if (newRecords.length > 0) {
    acc[1] = acc[1].length === 0 ? newRecords : [...acc[1], ...newRecords];
  }
}

function withError(
  errors: Array<GraphQLError>,
  error: GraphQLError,
): ReadonlyArray<GraphQLError> {
  return errors.length === 0 ? [error] : [...errors, error];
}

function buildDataResponse(
  exeContext: ExecutionContext,
  data: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError>,
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
): ExecutionResult | ExperimentalIncrementalExecutionResults {
  if (incrementalDataRecords.length === 0) {
    return errors.length > 0 ? { errors, data } : { data };
  }

  return buildIncrementalResponse(
    exeContext,
    data,
    errors,
    incrementalDataRecords,
  );
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = experimentalExecuteIncrementally(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || 'initialResult' in result) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
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
    cancellableStreams: new Set(),
  };
}

function buildPerEventExecutionContext(
  exeContext: ExecutionContext,
  payload: unknown,
): ExecutionContext {
  return {
    ...exeContext,
    rootValue: payload,
  };
}

function executeRootGroupedFieldSet(
  exeContext: ExecutionContext,
  operation: OperationTypeNode,
  rootType: GraphQLObjectType,
  rootValue: unknown,
  groupedFieldSet: GroupedFieldSet,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
  switch (operation) {
    case OperationTypeNode.QUERY:
      return executeFields(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        errors,
        deferMap,
      );
    case OperationTypeNode.MUTATION:
      return executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        errors,
        deferMap,
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
        errors,
        deferMap,
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
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
  return promiseReduce(
    groupedFieldSet,
    (acc, [responseName, fieldGroup]) => {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        errors,
        deferMap,
      );
      if (result === undefined) {
        return acc;
      }
      if (isPromise(result)) {
        return result.then((resolved) => {
          acc[0][responseName] = resolved[0];
          appendNewIncrementalDataRecords(acc, resolved[1]);
          return acc;
        });
      }
      acc[0][responseName] = result[0];
      appendNewIncrementalDataRecords(acc, result[1]);
      return acc;
    },
    [Object.create(null), []] as GraphQLResult<ObjMap<unknown>>,
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
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
  const results = Object.create(null);
  const acc: GraphQLResult<ObjMap<unknown>> = [results, []];
  let containsPromise = false;

  try {
    for (const [responseName, fieldGroup] of groupedFieldSet) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        errors,
        deferMap,
      );

      if (result !== undefined) {
        if (isPromise(result)) {
          results[responseName] = result.then((resolved) => {
            appendNewIncrementalDataRecords(acc, resolved[1]);
            return resolved[0];
          });
          containsPromise = true;
        } else {
          results[responseName] = result[0];
          appendNewIncrementalDataRecords(acc, result[1]);
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      // Ensure that any promises returned by other fields are handled, as they may also reject.
      return promiseForObject(results, () => {
        /* noop */
      }).finally(() => {
        throw error;
      }) as never;
    }
    throw error;
  }

  // If there are no promises, we can just return the object and any incrementalDataRecords
  if (!containsPromise) {
    return acc;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results, (resolved) => [resolved, acc[1]]);
}

function toNodes(fieldGroup: FieldGroup): ReadonlyArray<FieldNode> {
  return fieldGroup.fields.map((fieldDetails) => fieldDetails.node);
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
  fieldGroup: FieldGroup,
  path: Path,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<unknown>> | undefined {
  const fieldName = fieldGroup.fields[0].node.name.value;
  const fieldDef = exeContext.schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    toNodes(fieldGroup),
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
      fieldGroup.fields[0].node,
      exeContext.variableValues,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    const result = resolveFn(source, args, contextValue, info);

    if (isPromise(result)) {
      return completePromisedValue(
        exeContext,
        returnType,
        fieldGroup,
        info,
        path,
        result,
        errors,
        deferMap,
      );
    }

    const completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      errors,
      deferMap,
    );

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        handleFieldError(rawError, returnType, fieldGroup, path, errors);
        return [null, []];
      });
    }
    return completed;
  } catch (rawError) {
    handleFieldError(rawError, returnType, fieldGroup, path, errors);
    return [null, []];
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
  rawError: unknown,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  path: Path,
  errors: Array<GraphQLError>,
): void {
  const error = locatedError(rawError, toNodes(fieldGroup), pathToArray(path));

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  errors.push(error);
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
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<unknown>> {
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
      fieldGroup,
      info,
      path,
      result,
      errors,
      deferMap,
    );
    if ((completed as GraphQLResult<unknown>)[0] === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
      );
    }
    return completed;
  }

  // If result value is null or undefined then return null.
  if (result == null) {
    return [null, []];
  }

  // If field type is List, complete each item in the list with the inner type
  if (isListType(returnType)) {
    return completeListValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      errors,
      deferMap,
    );
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    return [completeLeafValue(returnType, result), []];
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isAbstractType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      errors,
      deferMap,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  if (isObjectType(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      errors,
      deferMap,
    );
  }
  /* c8 ignore next 6 */
  // Not reachable, all possible output types have been considered.
  invariant(
    false,
    'Cannot complete value of unexpected output type: ' + inspect(returnType),
  );
}

async function completePromisedValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: Promise<unknown>,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): Promise<GraphQLResult<unknown>> {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      resolved,
      errors,
      deferMap,
    );

    if (isPromise(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    handleFieldError(rawError, returnType, fieldGroup, path, errors);
    return [null, []];
  }
}

/**
 * Returns an object containing info for streaming if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamUsage(
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  path: Path,
): StreamUsage | undefined {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }

  // TODO: add test for this case (a streamed list nested under a list).
  /* c8 ignore next 7 */
  if (
    (fieldGroup as unknown as { _streamUsage: StreamUsage })._streamUsage !==
    undefined
  ) {
    return (fieldGroup as unknown as { _streamUsage: StreamUsage })
      ._streamUsage;
  }

  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    fieldGroup.fields[0].node,
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

  invariant(
    exeContext.operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
  );

  const streamedFieldGroup: FieldGroup = {
    fields: fieldGroup.fields.map((fieldDetails) => ({
      node: fieldDetails.node,
      deferUsage: undefined,
    })),
  };

  const streamUsage = {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
    fieldGroup: streamedFieldGroup,
  };

  (fieldGroup as unknown as { _streamUsage: StreamUsage })._streamUsage =
    streamUsage;

  return streamUsage;
}

/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
async function completeAsyncIteratorValue(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  asyncIterator: AsyncIterator<unknown>,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): Promise<GraphQLResult<ReadonlyArray<unknown>>> {
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  const acc: GraphQLResult<Array<unknown>> = [completedResults, []];
  let index = 0;
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (streamUsage && index >= streamUsage.initialCount) {
      const returnFn = asyncIterator.return;
      let streamRecord;
      if (returnFn === undefined) {
        streamRecord = {
          label: streamUsage.label,
          path,
        } as SubsequentResultRecord;
      } else {
        streamRecord = {
          label: streamUsage.label,
          path,
          earlyReturn: returnFn.bind(asyncIterator),
        } as CancellableStreamRecord;
        exeContext.cancellableStreams.add(streamRecord);
      }

      const firstStreamItems = firstAsyncStreamItems(
        streamRecord,
        path,
        index,
        toNodes(fieldGroup),
        asyncIterator,
        (currentItemPath, currentItem) =>
          completeStreamItems(
            streamRecord,
            currentItemPath,
            currentItem,
            exeContext,
            [],
            streamUsage.fieldGroup,
            info,
            itemType,
          ),
      );

      appendNewIncrementalDataRecords(acc, [firstStreamItems]);
      break;
    }

    const itemPath = addPath(path, index, undefined);
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await asyncIterator.next();
    } catch (rawError) {
      throw locatedError(rawError, toNodes(fieldGroup), pathToArray(path));
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
        completePromisedValue(
          exeContext,
          itemType,
          fieldGroup,
          info,
          itemPath,
          item,
          errors,
          deferMap,
        ).then((resolved) => {
          appendNewIncrementalDataRecords(acc, resolved[1]);
          return resolved[0];
        }),
      );
      containsPromise = true;
    } else if (
      /* c8 ignore stop */
      completeListItemValue(
        item,
        completedResults,
        acc,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        errors,
        deferMap,
      )
      // TODO: add tests for stream backed by asyncIterator that completes to a promise
      /* c8 ignore start */
    ) {
      containsPromise = true;
    }
    /* c8 ignore stop */
    index++;
  }

  return containsPromise
    ? /* c8 ignore start */ Promise.all(completedResults).then((resolved) => [
        resolved,
        acc[1],
      ])
    : /* c8 ignore stop */ acc;
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLOutputType>,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ReadonlyArray<unknown>>> {
  const itemType = returnType.ofType;

  if (isAsyncIterable(result)) {
    const asyncIterator = result[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      path,
      asyncIterator,
      errors,
      deferMap,
    );
  }

  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  const acc: GraphQLResult<Array<unknown>> = [completedResults, []];
  let index = 0;
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  const iterator = result[Symbol.iterator]();
  let iteration = iterator.next();
  while (!iteration.done) {
    const item = iteration.value;

    if (streamUsage && index >= streamUsage.initialCount) {
      const streamRecord: SubsequentResultRecord = {
        label: streamUsage.label,
        path,
      };

      const firstStreamItems = firstSyncStreamItems(
        streamRecord,
        item,
        index,
        iterator,
        (currentItemPath, currentItem) =>
          completeStreamItems(
            streamRecord,
            currentItemPath,
            currentItem,
            exeContext,
            [],
            streamUsage.fieldGroup,
            info,
            itemType,
          ),
      );

      appendNewIncrementalDataRecords(acc, [firstStreamItems]);
      break;
    }

    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);

    if (isPromise(item)) {
      completedResults.push(
        completePromisedValue(
          exeContext,
          itemType,
          fieldGroup,
          info,
          itemPath,
          item,
          errors,
          deferMap,
        ).then((resolved) => {
          appendNewIncrementalDataRecords(acc, resolved[1]);
          return resolved[0];
        }),
      );
      containsPromise = true;
    } else if (
      completeListItemValue(
        item,
        completedResults,
        acc,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        errors,
        deferMap,
      )
    ) {
      containsPromise = true;
    }
    index++;

    iteration = iterator.next();
  }

  return containsPromise
    ? Promise.all(completedResults).then((resolved) => [resolved, acc[1]])
    : acc;
}

/**
 * Complete a list item value by adding it to the completed results.
 *
 * Returns true if the value is a Promise.
 */
function completeListItemValue(
  item: unknown,
  completedResults: Array<unknown>,
  parent: GraphQLResult<Array<unknown>>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemPath: Path,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): boolean {
  try {
    const completedItem = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      errors,
      deferMap,
    );

    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(
          (resolved) => {
            appendNewIncrementalDataRecords(parent, resolved[1]);
            return resolved[0];
          },
          (rawError) => {
            handleFieldError(rawError, itemType, fieldGroup, itemPath, errors);
            return null;
          },
        ),
      );
      return true;
    }

    completedResults.push(completedItem[0]);
    appendNewIncrementalDataRecords(parent, completedItem[1]);
  } catch (rawError) {
    handleFieldError(rawError, itemType, fieldGroup, itemPath, errors);
    completedResults.push(null);
  }
  return false;
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
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
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
          fieldGroup,
          info,
          result,
        ),
        fieldGroup,
        info,
        path,
        result,
        errors,
        deferMap,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      exeContext,
      returnType,
      fieldGroup,
      info,
      result,
    ),
    fieldGroup,
    info,
    path,
    result,
    errors,
    deferMap,
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  result: unknown,
): GraphQLObjectType {
  if (runtimeTypeName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      { nodes: toNodes(fieldGroup) },
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
      { nodes: toNodes(fieldGroup) },
    );
  }

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
      { nodes: toNodes(fieldGroup) },
    );
  }

  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      { nodes: toNodes(fieldGroup) },
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
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);

    if (isPromise(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldGroup);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldGroup,
          path,
          result,
          errors,
          deferMap,
        );
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldGroup);
    }
  }

  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldGroup,
    path,
    result,
    errors,
    deferMap,
  );
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldGroup: FieldGroup,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    { nodes: toNodes(fieldGroup) },
  );
}

/**
 * Instantiates new DeferredFragmentRecords for the given path within an
 * incremental data record, returning an updated map of DeferUsage
 * objects to DeferredFragmentRecords.
 *
 * Note: As defer directives may be used with operations returning lists,
 * a DeferUsage object may correspond to many DeferredFragmentRecords.
 *
 * DeferredFragmentRecord creation includes the following steps:
 * 1. The new DeferredFragmentRecord is instantiated at the given path.
 * 2. The parent result record is calculated from the given incremental data
 * record.
 * 3. The IncrementalPublisher is notified that a new DeferredFragmentRecord
 * with the calculated parent has been added; the record will be released only
 * after the parent has completed.
 *
 */
function addNewDeferredFragments(
  newDeferUsages: ReadonlyArray<DeferUsage>,
  newDeferMap: Map<DeferUsage, DeferredFragmentRecord>,
  path?: Path | undefined,
): ReadonlyMap<DeferUsage, DeferredFragmentRecord> {
  // For each new deferUsage object:
  for (const newDeferUsage of newDeferUsages) {
    const parentDeferUsage = newDeferUsage.parentDeferUsage;

    const parent =
      parentDeferUsage === undefined
        ? undefined
        : deferredFragmentRecordFromDeferUsage(parentDeferUsage, newDeferMap);

    // Instantiate the new record.
    const deferredFragmentRecord = new DeferredFragmentRecord({
      path,
      label: newDeferUsage.label,
      parent,
    });

    // Update the map.
    newDeferMap.set(newDeferUsage, deferredFragmentRecord);
  }

  return newDeferMap;
}

function deferredFragmentRecordFromDeferUsage(
  deferUsage: DeferUsage,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): DeferredFragmentRecord {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return deferMap.get(deferUsage)!;
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
  path: Path,
  result: unknown,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLResult<ObjMap<unknown>>> {
  // Collect sub-fields to execute to complete this value.
  const { groupedFieldSet, newGroupedFieldSets, newDeferUsages } =
    buildSubFieldPlan(exeContext, returnType, fieldGroup);

  const newDeferMap = addNewDeferredFragments(
    newDeferUsages,
    new Map(deferMap),
    path,
  );

  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    groupedFieldSet,
    errors,
    newDeferMap,
  );

  const newDeferredGroupedFieldSetRecords = executeDeferredGroupedFieldSets(
    exeContext,
    returnType,
    result,
    path,
    fieldGroup.deferUsages,
    newGroupedFieldSets,
    newDeferMap,
  );

  return withNewDeferredGroupedFieldSets(
    subFields,
    newDeferredGroupedFieldSetRecords,
  );
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
 * compliant subscription, a GraphQL Response (ExecutionResult) with descriptive
 * errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription resolver
 * logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, a field error will be raised at the location of the `@defer` or
 * `@stream` directive.
 *
 * Accepts an object with named arguments.
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
): AsyncGenerator<ExecutionResult, void, void> | ExecutionResult {
  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  return mapAsyncIterable(
    resultOrStream,
    (payload: unknown) =>
      executeOperation(
        buildPerEventExecutionContext(exeContext, payload),
        // typecast to ExecutionResult, not possible to return
        // ExperimentalIncrementalExecutionResults when
        // exeContext.operation is 'subscription'.
      ) as ExecutionResult,
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

  const { fields } = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );

  const firstRootField = fields.entries().next().value as [
    string,
    ReadonlyArray<FieldDetails>,
  ];
  const [responseName, fieldDetailsList] = firstRootField;
  const fieldName = fieldDetailsList[0].node.name.value;
  const fieldDef = schema.getField(rootType, fieldName);

  const fieldNodes = fieldDetailsList.map((fieldDetails) => fieldDetails.node);
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

function executeDeferredGroupedFieldSets(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  parentDeferUsages: DeferUsageSet | undefined,
  newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): ReadonlyArray<DeferredGroupedFieldSetRecord> {
  const newDeferredGroupedFieldSetRecords: Array<DeferredGroupedFieldSetRecord> =
    [];

  for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
    const deferredFragmentRecords = getDeferredFragmentRecords(
      deferUsageSet,
      deferMap,
    );

    const executor = () =>
      executeDeferredGroupedFieldSet(
        deferredFragmentRecords,
        exeContext,
        parentType,
        sourceValue,
        path,
        groupedFieldSet,
        [],
        deferMap,
      );

    const deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord = {
      deferredFragmentRecords,
      result: shouldDefer(parentDeferUsages, deferUsageSet)
        ? Promise.resolve().then(executor)
        : executor(),
    };

    newDeferredGroupedFieldSetRecords.push(deferredGroupedFieldSetRecord);
  }

  return newDeferredGroupedFieldSetRecords;
}

function shouldDefer(
  parentDeferUsages: undefined | DeferUsageSet,
  deferUsages: DeferUsageSet,
): boolean {
  // If we have a new child defer usage, defer.
  // Otherwise, this defer usage was already deferred when it was initially
  // encountered, and is now in the midst of executing early, so the new
  // deferred grouped fields set can be executed immediately.
  return (
    parentDeferUsages === undefined ||
    !Array.from(deferUsages).every((deferUsage) =>
      parentDeferUsages.has(deferUsage),
    )
  );
}

function executeDeferredGroupedFieldSet(
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>,
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
  errors: Array<GraphQLError>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<DeferredGroupedFieldSetResult> {
  let result;
  try {
    result = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      groupedFieldSet,
      errors,
      deferMap,
    );
  } catch (error) {
    return {
      deferredFragmentRecords,
      path: pathToArray(path),
      errors: withError(errors, error),
    };
  }

  if (isPromise(result)) {
    return result.then(
      (resolved) =>
        buildDeferredGroupedFieldSetResult(
          errors,
          deferredFragmentRecords,
          path,
          resolved,
        ),
      (error) => ({
        deferredFragmentRecords,
        path: pathToArray(path),
        errors: withError(errors, error),
      }),
    );
  }

  return buildDeferredGroupedFieldSetResult(
    errors,
    deferredFragmentRecords,
    path,
    result,
  );
}

function buildDeferredGroupedFieldSetResult(
  errors: ReadonlyArray<GraphQLError>,
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>,
  path: Path | undefined,
  result: GraphQLResult<ObjMap<unknown>>,
): DeferredGroupedFieldSetResult {
  return {
    deferredFragmentRecords,
    path: pathToArray(path),
    result:
      errors.length === 0 ? { data: result[0] } : { data: result[0], errors },
    incrementalDataRecords: result[1],
  };
}

function getDeferredFragmentRecords(
  deferUsages: DeferUsageSet,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): ReadonlyArray<DeferredFragmentRecord> {
  return Array.from(deferUsages).map((deferUsage) =>
    deferredFragmentRecordFromDeferUsage(deferUsage, deferMap),
  );
}

function firstSyncStreamItems(
  streamRecord: SubsequentResultRecord,
  initialItem: PromiseOrValue<unknown>,
  initialIndex: number,
  iterator: Iterator<unknown>,
  executor: (
    itemPath: Path,
    item: PromiseOrValue<unknown>,
  ) => PromiseOrValue<StreamItemsResult>,
): StreamItemsRecord {
  const path = streamRecord.path;
  const initialPath = addPath(path, initialIndex, undefined);

  const firstStreamItems: StreamItemsRecord = {
    streamRecord,
    result: Promise.resolve().then(() => {
      const results: Array<PromiseOrValue<StreamItemsResult>> = [
        executor(initialPath, initialItem),
      ];
      let currentIndex = initialIndex;
      let iteration = iterator.next();
      while (!iteration.done) {
        const item = iteration.value;
        currentIndex++;
        const currentPath = addPath(path, currentIndex, undefined);
        results.push(executor(currentPath, item));
        iteration = iterator.next();
      }

      currentIndex = results.length - 1;
      let currentResult = prependNextStreamItems(results[currentIndex], {
        streamRecord,
        result: { streamRecord },
      });

      while (currentIndex-- > 0) {
        currentResult = prependNextStreamItems(results[currentIndex], {
          streamRecord,
          result: currentResult,
        });
      }

      return currentResult;
    }),
  };
  return firstStreamItems;
}

function prependNextStreamItems(
  result: PromiseOrValue<StreamItemsResult>,
  nextStreamItems: StreamItemsRecord,
): PromiseOrValue<StreamItemsResult> {
  if (isPromise(result)) {
    return result.then((resolved) =>
      isNonTerminatingStreamItemsResult(resolved)
        ? {
            ...resolved,
            incrementalDataRecords: [
              nextStreamItems,
              ...resolved.incrementalDataRecords,
            ],
          }
        : resolved,
    );
  }
  return isNonTerminatingStreamItemsResult(result)
    ? {
        ...result,
        incrementalDataRecords: [
          nextStreamItems,
          ...result.incrementalDataRecords,
        ],
      }
    : result;
}

function firstAsyncStreamItems(
  streamRecord: SubsequentResultRecord,
  path: Path,
  initialIndex: number,
  nodes: ReadonlyArray<FieldNode>,
  asyncIterator: AsyncIterator<unknown>,
  executor: (
    itemPath: Path,
    item: PromiseOrValue<unknown>,
  ) => PromiseOrValue<StreamItemsResult>,
): StreamItemsRecord {
  const firstStreamItems: StreamItemsRecord = {
    streamRecord,
    result: Promise.resolve().then(() =>
      getNextAsyncStreamItemsResult(
        streamRecord,
        path,
        initialIndex,
        nodes,
        asyncIterator,
        executor,
      ),
    ),
  };
  return firstStreamItems;
}

async function getNextAsyncStreamItemsResult(
  streamRecord: SubsequentResultRecord,
  path: Path,
  index: number,
  nodes: ReadonlyArray<FieldNode>,
  asyncIterator: AsyncIterator<unknown>,
  executor: (
    itemPath: Path,
    item: PromiseOrValue<unknown>,
  ) => PromiseOrValue<StreamItemsResult>,
): Promise<StreamItemsResult> {
  let iteration;
  try {
    iteration = await asyncIterator.next();
  } catch (error) {
    return {
      streamRecord,
      errors: [locatedError(error, nodes, pathToArray(path))],
    };
  }

  if (iteration.done) {
    return { streamRecord };
  }

  const itemPath = addPath(path, index, undefined);

  const result = executor(itemPath, iteration.value);

  const nextStreamItems: StreamItemsRecord = nextAsyncStreamItems(
    streamRecord,
    path,
    index,
    nodes,
    asyncIterator,
    executor,
  );

  return prependNextStreamItems(result, nextStreamItems);
}

function nextAsyncStreamItems(
  streamRecord: SubsequentResultRecord,
  path: Path,
  initialIndex: number,
  nodes: ReadonlyArray<FieldNode>,
  asyncIterator: AsyncIterator<unknown>,
  executor: (
    itemPath: Path,
    item: PromiseOrValue<unknown>,
  ) => PromiseOrValue<StreamItemsResult>,
): StreamItemsRecord {
  const nextStreamItems: StreamItemsRecord = {
    streamRecord,
    result: Promise.resolve().then(() =>
      getNextAsyncStreamItemsResult(
        streamRecord,
        path,
        initialIndex + 1,
        nodes,
        asyncIterator,
        executor,
      ),
    ),
  };
  return nextStreamItems;
}

function completeStreamItems(
  streamRecord: SubsequentResultRecord,
  itemPath: Path,
  item: unknown,
  exeContext: ExecutionContext,
  errors: Array<GraphQLError>,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
): PromiseOrValue<StreamItemsResult> {
  if (isPromise(item)) {
    return completePromisedValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      errors,
      new Map(),
    ).then(
      (resolvedItem) =>
        buildStreamItemsResult(errors, streamRecord, resolvedItem),
      (error) => ({
        streamRecord,
        errors: withError(errors, error),
      }),
    );
  }

  let result: PromiseOrValue<GraphQLResult<unknown>>;
  try {
    try {
      result = completeValue(
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        item,
        errors,
        new Map(),
      );
    } catch (rawError) {
      handleFieldError(rawError, itemType, fieldGroup, itemPath, errors);
      result = [null, []];
    }
  } catch (error) {
    return {
      streamRecord,
      errors: withError(errors, error),
    };
  }

  if (isPromise(result)) {
    return result
      .then(undefined, (rawError) => {
        handleFieldError(rawError, itemType, fieldGroup, itemPath, errors);
        return [null, []] as GraphQLResult<unknown>;
      })
      .then(
        (resolvedItem) =>
          buildStreamItemsResult(errors, streamRecord, resolvedItem),
        (error) => ({
          streamRecord,
          errors: withError(errors, error),
        }),
      );
  }

  return buildStreamItemsResult(errors, streamRecord, result);
}

function buildStreamItemsResult(
  errors: ReadonlyArray<GraphQLError>,
  streamRecord: SubsequentResultRecord,
  result: GraphQLResult<unknown>,
): StreamItemsResult {
  return {
    streamRecord,
    result:
      errors.length === 0
        ? { items: [result[0]] }
        : {
            items: [result[0]],
            errors: [...errors],
          },
    incrementalDataRecords: result[1],
  };
}
