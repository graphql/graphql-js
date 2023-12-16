import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.ts';
import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import { isPromise } from '../jsutils/isPromise.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import { memoize3 } from '../jsutils/memoize3.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import { promiseForObject } from '../jsutils/promiseForObject.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';
import { promiseReduce } from '../jsutils/promiseReduce.ts';
import { GraphQLError } from '../error/GraphQLError.ts';
import { locatedError } from '../error/locatedError.ts';
import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.ts';
import { OperationTypeNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
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
} from '../type/definition.ts';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.ts';
import { GraphQLStreamDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import { assertValidSchema } from '../type/validate.ts';
import type {
  DeferUsageSet,
  FieldGroup,
  GroupedFieldSet,
  NewGroupedFieldSetDetails,
} from './buildFieldPlan.ts';
import { buildFieldPlan } from './buildFieldPlan.ts';
import type { DeferUsage, FieldDetails } from './collectFields.ts';
import { collectFields, collectSubfields } from './collectFields.ts';
import type {
  ExecutionResult,
  ExperimentalIncrementalExecutionResults,
  IncrementalDataRecord,
} from './IncrementalPublisher.ts';
import {
  DeferredFragmentRecord,
  DeferredGroupedFieldSetRecord,
  IncrementalPublisher,
  InitialResultRecord,
  StreamItemsRecord,
  StreamRecord,
} from './IncrementalPublisher.ts';
import { mapAsyncIterable } from './mapAsyncIterable.ts';
import {
  getArgumentValues,
  getDirectiveValues,
  getVariableValues,
} from './values.ts';
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
    const subFields = collectSubfields(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      exeContext.operation,
      returnType,
      fieldGroup.fields,
    );
    return buildFieldPlan(
      subFields,
      fieldGroup.deferUsages,
      fieldGroup.knownDeferUsages,
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
export interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: {
    [variable: string]: unknown;
  };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  incrementalPublisher: IncrementalPublisher;
}
export interface ExecutionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{
    readonly [variable: string]: unknown;
  }>;
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
  return executeImpl(exeContext);
}
function executeImpl(
  exeContext: ExecutionContext,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
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
  const incrementalPublisher = exeContext.incrementalPublisher;
  const initialResultRecord = new InitialResultRecord();
  try {
    const data = executeOperation(exeContext, initialResultRecord);
    if (isPromise(data)) {
      return data.then(
        (resolved) =>
          incrementalPublisher.buildDataResponse(initialResultRecord, resolved),
        (error) =>
          incrementalPublisher.buildErrorResponse(initialResultRecord, error),
      );
    }
    return incrementalPublisher.buildDataResponse(initialResultRecord, data);
  } catch (error) {
    return incrementalPublisher.buildErrorResponse(initialResultRecord, error);
  }
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
    incrementalPublisher: new IncrementalPublisher(),
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
/**
 * Implements the "Executing operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  initialResultRecord: InitialResultRecord,
): PromiseOrValue<ObjMap<unknown>> {
  const {
    operation,
    schema,
    fragments,
    variableValues,
    rootValue,
    incrementalPublisher,
  } = exeContext;
  const rootType = schema.getRootType(operation.operation);
  if (rootType == null) {
    throw new GraphQLError(
      `Schema is not configured to execute ${operation.operation} operation.`,
      { nodes: operation },
    );
  }
  const fields = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );
  const { groupedFieldSet, newGroupedFieldSetDetailsMap, newDeferUsages } =
    buildFieldPlan(fields);
  const newDeferMap = addNewDeferredFragments(
    incrementalPublisher,
    newDeferUsages,
    initialResultRecord,
  );
  const path = undefined;
  const newDeferredGroupedFieldSetRecords = addNewDeferredGroupedFieldSets(
    incrementalPublisher,
    newGroupedFieldSetDetailsMap,
    newDeferMap,
    path,
  );
  let result;
  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      result = executeFields(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        initialResultRecord,
        newDeferMap,
      );
      break;
    case OperationTypeNode.MUTATION:
      result = executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        initialResultRecord,
        newDeferMap,
      );
      break;
    case OperationTypeNode.SUBSCRIPTION:
      // TODO: deprecate `subscribe` and move all logic here
      // Temporary solution until we finish merging execute and subscribe together
      result = executeFields(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        initialResultRecord,
        newDeferMap,
      );
  }
  executeDeferredGroupedFieldSets(
    exeContext,
    rootType,
    rootValue,
    path,
    newDeferredGroupedFieldSetRecords,
    newDeferMap,
  );
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
  groupedFieldSet: GroupedFieldSet,
  incrementalDataRecord: InitialResultRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    groupedFieldSet,
    (results, [responseName, fieldGroup]) => {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        incrementalDataRecord,
        deferMap,
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
  groupedFieldSet: GroupedFieldSet,
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
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
        incrementalDataRecord,
        deferMap,
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
      });
    }
    throw error;
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
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<unknown> {
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
        incrementalDataRecord,
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
      incrementalDataRecord,
      deferMap,
    );
    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          returnType,
          fieldGroup,
          path,
          incrementalDataRecord,
        );
        exeContext.incrementalPublisher.filter(path, incrementalDataRecord);
        return null;
      });
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldGroup,
      path,
      incrementalDataRecord,
    );
    exeContext.incrementalPublisher.filter(path, incrementalDataRecord);
    return null;
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
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  path: Path,
  incrementalDataRecord: IncrementalDataRecord,
): void {
  const error = locatedError(rawError, toNodes(fieldGroup), pathToArray(path));
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    throw error;
  }
  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  exeContext.incrementalPublisher.addFieldError(incrementalDataRecord, error);
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
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
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
      fieldGroup,
      info,
      path,
      result,
      incrementalDataRecord,
      deferMap,
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
      fieldGroup,
      info,
      path,
      result,
      incrementalDataRecord,
      deferMap,
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
      fieldGroup,
      info,
      path,
      result,
      incrementalDataRecord,
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
      incrementalDataRecord,
      deferMap,
    );
  }
  /* c8 ignore next 6 */
  // Not reachable, all possible output types have been considered.
  false ||
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
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): Promise<unknown> {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      resolved,
      incrementalDataRecord,
      deferMap,
    );
    if (isPromise(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldGroup,
      path,
      incrementalDataRecord,
    );
    exeContext.incrementalPublisher.filter(path, incrementalDataRecord);
    return null;
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
    (
      fieldGroup as unknown as {
        _streamUsage: StreamUsage;
      }
    )._streamUsage !== undefined
  ) {
    return (
      fieldGroup as unknown as {
        _streamUsage: StreamUsage;
      }
    )._streamUsage;
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
  typeof stream.initialCount === 'number' ||
    invariant(false, 'initialCount must be a number');
  stream.initialCount >= 0 ||
    invariant(false, 'initialCount must be a positive integer');
  exeContext.operation.operation !== OperationTypeNode.SUBSCRIPTION ||
    invariant(
      false,
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
  (
    fieldGroup as unknown as {
      _streamUsage: StreamUsage;
    }
  )._streamUsage = streamUsage;
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
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): Promise<ReadonlyArray<unknown>> {
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  let index = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (streamUsage && index >= streamUsage.initialCount) {
      const earlyReturn = asyncIterator.return;
      const streamRecord = new StreamRecord({
        label: streamUsage.label,
        path,
        earlyReturn:
          earlyReturn === undefined
            ? undefined
            : earlyReturn.bind(asyncIterator),
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      executeStreamAsyncIterator(
        index,
        asyncIterator,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
        path,
        incrementalDataRecord,
        streamRecord,
      );
      break;
    }
    const itemPath = addPath(path, index, undefined);
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await asyncIterator.next();
      if (iteration.done) {
        break;
      }
    } catch (rawError) {
      throw locatedError(rawError, toNodes(fieldGroup), pathToArray(path));
    }
    if (
      completeListItemValue(
        iteration.value,
        completedResults,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        incrementalDataRecord,
        deferMap,
      )
    ) {
      containsPromise = true;
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
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ReadonlyArray<unknown>> {
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
      incrementalDataRecord,
      deferMap,
    );
  }
  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  let currentParents = incrementalDataRecord;
  const completedResults: Array<unknown> = [];
  let index = 0;
  let streamRecord: StreamRecord | undefined;
  for (const item of result) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);
    if (streamUsage && index >= streamUsage.initialCount) {
      if (streamRecord === undefined) {
        streamRecord = new StreamRecord({ label: streamUsage.label, path });
      }
      currentParents = executeStreamField(
        path,
        itemPath,
        item,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
        currentParents,
        streamRecord,
      );
      index++;
      continue;
    }
    if (
      completeListItemValue(
        item,
        completedResults,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        incrementalDataRecord,
        deferMap,
      )
    ) {
      containsPromise = true;
    }
    index++;
  }
  if (streamRecord !== undefined) {
    exeContext.incrementalPublisher.setIsFinalRecord(
      currentParents as StreamItemsRecord,
    );
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
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemPath: Path,
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): boolean {
  if (isPromise(item)) {
    completedResults.push(
      completePromisedValue(
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        item,
        incrementalDataRecord,
        deferMap,
      ),
    );
    return true;
  }
  try {
    const completedItem = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      incrementalDataRecord,
      deferMap,
    );
    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(undefined, (rawError) => {
          handleFieldError(
            rawError,
            exeContext,
            itemType,
            fieldGroup,
            itemPath,
            incrementalDataRecord,
          );
          exeContext.incrementalPublisher.filter(
            itemPath,
            incrementalDataRecord,
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
      fieldGroup,
      itemPath,
      incrementalDataRecord,
    );
    exeContext.incrementalPublisher.filter(itemPath, incrementalDataRecord);
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
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
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
          fieldGroup,
          info,
          result,
        ),
        fieldGroup,
        info,
        path,
        result,
        incrementalDataRecord,
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
    incrementalDataRecord,
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
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ObjMap<unknown>> {
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
          incrementalDataRecord,
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
    incrementalDataRecord,
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
  incrementalPublisher: IncrementalPublisher,
  newDeferUsages: ReadonlyArray<DeferUsage>,
  incrementalDataRecord: IncrementalDataRecord,
  deferMap?: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  path?: Path | undefined,
): ReadonlyMap<DeferUsage, DeferredFragmentRecord> {
  if (newDeferUsages.length === 0) {
    // Given no DeferUsages, return the existing map, creating one if necessary.
    return deferMap ?? new Map<DeferUsage, DeferredFragmentRecord>();
  }
  // Create a copy of the old map.
  const newDeferMap =
    deferMap === undefined
      ? new Map<DeferUsage, DeferredFragmentRecord>()
      : new Map<DeferUsage, DeferredFragmentRecord>(deferMap);
  // For each new deferUsage object:
  for (const newDeferUsage of newDeferUsages) {
    const parentDeferUsage = newDeferUsage.parentDeferUsage;
    // If the parent defer usage is not defined, the parent result record is either:
    //  - the InitialResultRecord, or
    //  - a StreamItemsRecord, as `@defer` may be nested under `@stream`.
    const parent =
      parentDeferUsage === undefined
        ? (incrementalDataRecord as InitialResultRecord | StreamItemsRecord)
        : deferredFragmentRecordFromDeferUsage(parentDeferUsage, newDeferMap);
    // Instantiate the new record.
    const deferredFragmentRecord = new DeferredFragmentRecord({
      path,
      label: newDeferUsage.label,
    });
    // Report the new record to the Incremental Publisher.
    incrementalPublisher.reportNewDeferFragmentRecord(
      deferredFragmentRecord,
      parent,
    );
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
function addNewDeferredGroupedFieldSets(
  incrementalPublisher: IncrementalPublisher,
  newGroupedFieldSetDetailsMap: Map<DeferUsageSet, NewGroupedFieldSetDetails>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  path?: Path | undefined,
): ReadonlyArray<DeferredGroupedFieldSetRecord> {
  const newDeferredGroupedFieldSetRecords: Array<DeferredGroupedFieldSetRecord> =
    [];
  for (const [
    deferUsageSet,
    { groupedFieldSet, shouldInitiateDefer },
  ] of newGroupedFieldSetDetailsMap) {
    const deferredFragmentRecords = getDeferredFragmentRecords(
      deferUsageSet,
      deferMap,
    );
    const deferredGroupedFieldSetRecord = new DeferredGroupedFieldSetRecord({
      path,
      deferredFragmentRecords,
      groupedFieldSet,
      shouldInitiateDefer,
    });
    incrementalPublisher.reportNewDeferredGroupedFieldSetRecord(
      deferredGroupedFieldSetRecord,
    );
    newDeferredGroupedFieldSetRecords.push(deferredGroupedFieldSetRecord);
  }
  return newDeferredGroupedFieldSetRecords;
}
function getDeferredFragmentRecords(
  deferUsages: DeferUsageSet,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): ReadonlyArray<DeferredFragmentRecord> {
  return Array.from(deferUsages).map((deferUsage) =>
    deferredFragmentRecordFromDeferUsage(deferUsage, deferMap),
  );
}
function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
  path: Path,
  result: unknown,
  incrementalDataRecord: IncrementalDataRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const { groupedFieldSet, newGroupedFieldSetDetailsMap, newDeferUsages } =
    buildSubFieldPlan(exeContext, returnType, fieldGroup);
  const incrementalPublisher = exeContext.incrementalPublisher;
  const newDeferMap = addNewDeferredFragments(
    incrementalPublisher,
    newDeferUsages,
    incrementalDataRecord,
    deferMap,
    path,
  );
  const newDeferredGroupedFieldSetRecords = addNewDeferredGroupedFieldSets(
    incrementalPublisher,
    newGroupedFieldSetDetailsMap,
    newDeferMap,
    path,
  );
  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    groupedFieldSet,
    incrementalDataRecord,
    newDeferMap,
  );
  executeDeferredGroupedFieldSets(
    exeContext,
    returnType,
    result,
    path,
    newDeferredGroupedFieldSetRecords,
    newDeferMap,
  );
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
      executeImpl(
        buildPerEventExecutionContext(exeContext, payload),
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
  const fields = collectFields(
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
  newDeferredGroupedFieldSetRecords: ReadonlyArray<DeferredGroupedFieldSetRecord>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): void {
  for (const deferredGroupedFieldSetRecord of newDeferredGroupedFieldSetRecords) {
    if (deferredGroupedFieldSetRecord.shouldInitiateDefer) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.resolve().then(() =>
        executeDeferredGroupedFieldSet(
          exeContext,
          parentType,
          sourceValue,
          path,
          deferredGroupedFieldSetRecord,
          deferMap,
        ),
      );
      continue;
    }
    executeDeferredGroupedFieldSet(
      exeContext,
      parentType,
      sourceValue,
      path,
      deferredGroupedFieldSetRecord,
      deferMap,
    );
  }
}
function executeDeferredGroupedFieldSet(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): void {
  try {
    const incrementalResult = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      deferredGroupedFieldSetRecord.groupedFieldSet,
      deferredGroupedFieldSetRecord,
      deferMap,
    );
    if (isPromise(incrementalResult)) {
      incrementalResult.then(
        (resolved) =>
          exeContext.incrementalPublisher.completeDeferredGroupedFieldSet(
            deferredGroupedFieldSetRecord,
            resolved,
          ),
        (error) =>
          exeContext.incrementalPublisher.markErroredDeferredGroupedFieldSet(
            deferredGroupedFieldSetRecord,
            error,
          ),
      );
      return;
    }
    exeContext.incrementalPublisher.completeDeferredGroupedFieldSet(
      deferredGroupedFieldSetRecord,
      incrementalResult,
    );
  } catch (error) {
    exeContext.incrementalPublisher.markErroredDeferredGroupedFieldSet(
      deferredGroupedFieldSetRecord,
      error,
    );
  }
}
function executeStreamField(
  path: Path,
  itemPath: Path,
  item: PromiseOrValue<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  incrementalDataRecord: IncrementalDataRecord,
  streamRecord: StreamRecord,
): StreamItemsRecord {
  const incrementalPublisher = exeContext.incrementalPublisher;
  const streamItemsRecord = new StreamItemsRecord({
    streamRecord,
    path: itemPath,
  });
  incrementalPublisher.reportNewStreamItemsRecord(
    streamItemsRecord,
    incrementalDataRecord,
  );
  if (isPromise(item)) {
    completePromisedValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      streamItemsRecord,
      new Map(),
    ).then(
      (value) =>
        incrementalPublisher.completeStreamItemsRecord(streamItemsRecord, [
          value,
        ]),
      (error) => {
        incrementalPublisher.filter(path, streamItemsRecord);
        incrementalPublisher.markErroredStreamItemsRecord(
          streamItemsRecord,
          error,
        );
      },
    );
    return streamItemsRecord;
  }
  let completedItem: PromiseOrValue<unknown>;
  try {
    try {
      completedItem = completeValue(
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        item,
        streamItemsRecord,
        new Map(),
      );
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldGroup,
        itemPath,
        streamItemsRecord,
      );
      completedItem = null;
      incrementalPublisher.filter(itemPath, streamItemsRecord);
    }
  } catch (error) {
    incrementalPublisher.filter(path, streamItemsRecord);
    incrementalPublisher.markErroredStreamItemsRecord(streamItemsRecord, error);
    return streamItemsRecord;
  }
  if (isPromise(completedItem)) {
    completedItem
      .then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          streamItemsRecord,
        );
        incrementalPublisher.filter(itemPath, streamItemsRecord);
        return null;
      })
      .then(
        (value) =>
          incrementalPublisher.completeStreamItemsRecord(streamItemsRecord, [
            value,
          ]),
        (error) => {
          incrementalPublisher.filter(path, streamItemsRecord);
          incrementalPublisher.markErroredStreamItemsRecord(
            streamItemsRecord,
            error,
          );
        },
      );
    return streamItemsRecord;
  }
  incrementalPublisher.completeStreamItemsRecord(streamItemsRecord, [
    completedItem,
  ]);
  return streamItemsRecord;
}
async function executeStreamAsyncIteratorItem(
  asyncIterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  streamItemsRecord: StreamItemsRecord,
  itemPath: Path,
): Promise<IteratorResult<unknown>> {
  let item;
  try {
    const iteration = await asyncIterator.next();
    if (streamItemsRecord.streamRecord.errors.length > 0) {
      return { done: true, value: undefined };
    }
    if (iteration.done) {
      exeContext.incrementalPublisher.setIsCompletedAsyncIterator(
        streamItemsRecord,
      );
      return { done: true, value: undefined };
    }
    item = iteration.value;
  } catch (rawError) {
    throw locatedError(
      rawError,
      toNodes(fieldGroup),
      streamItemsRecord.streamRecord.path,
    );
  }
  let completedItem;
  try {
    completedItem = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      streamItemsRecord,
      new Map(),
    );
    if (isPromise(completedItem)) {
      completedItem = completedItem.then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          streamItemsRecord,
        );
        exeContext.incrementalPublisher.filter(itemPath, streamItemsRecord);
        return null;
      });
    }
    return { done: false, value: completedItem };
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      streamItemsRecord,
    );
    exeContext.incrementalPublisher.filter(itemPath, streamItemsRecord);
    return { done: false, value: null };
  }
}
async function executeStreamAsyncIterator(
  initialIndex: number,
  asyncIterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  path: Path,
  incrementalDataRecord: IncrementalDataRecord,
  streamRecord: StreamRecord,
): Promise<void> {
  const incrementalPublisher = exeContext.incrementalPublisher;
  let index = initialIndex;
  let currentIncrementalDataRecord = incrementalDataRecord;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const itemPath = addPath(path, index, undefined);
    const streamItemsRecord = new StreamItemsRecord({
      streamRecord,
      path: itemPath,
    });
    incrementalPublisher.reportNewStreamItemsRecord(
      streamItemsRecord,
      currentIncrementalDataRecord,
    );
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await executeStreamAsyncIteratorItem(
        asyncIterator,
        exeContext,
        fieldGroup,
        info,
        itemType,
        streamItemsRecord,
        itemPath,
      );
    } catch (error) {
      incrementalPublisher.filter(path, streamItemsRecord);
      incrementalPublisher.markErroredStreamItemsRecord(
        streamItemsRecord,
        error,
      );
      return;
    }
    const { done, value: completedItem } = iteration;
    if (isPromise(completedItem)) {
      completedItem.then(
        (value) =>
          incrementalPublisher.completeStreamItemsRecord(streamItemsRecord, [
            value,
          ]),
        (error) => {
          incrementalPublisher.filter(path, streamItemsRecord);
          incrementalPublisher.markErroredStreamItemsRecord(
            streamItemsRecord,
            error,
          );
        },
      );
    } else {
      incrementalPublisher.completeStreamItemsRecord(streamItemsRecord, [
        completedItem,
      ]);
    }
    if (done) {
      break;
    }
    currentIncrementalDataRecord = streamItemsRecord;
    index++;
  }
}
