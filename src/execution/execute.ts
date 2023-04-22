import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
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

import type { GraphQLFormattedError } from '../error/GraphQLError.js';
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
  isNullableType,
  isObjectType,
} from '../type/definition.js';
import { GraphQLStreamDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
import { assertValidSchema } from '../type/validate.js';

import type {
  DeferUsage,
  FieldGroup,
  GroupedFieldSet,
} from './collectFields.js';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields.js';
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
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = memoize3(
  (
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldGroup: FieldGroup,
  ) =>
    _collectSubfields(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      exeContext.operation,
      returnType,
      fieldGroup,
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
  subsequentPayloads: Set<AsyncPayloadRecord>;
  streams: Set<StreamContext>;
}

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 *   - `incremental` is a list of the results from defer/stream directives.
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

export interface ExperimentalIncrementalExecutionResults<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TData, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TData, TExtensions>,
    void,
    void
  >;
}

export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface SubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface FormattedSubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
  label?: string;
}

export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
  label?: string;
}

export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}

export type IncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;

export type FormattedIncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TData, TExtensions>;

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

declare module './collectFields.js' {
  export interface FieldGroup {
    // for memoization
    _streamUsage?: StreamUsage | undefined;
  }
}

const UNEXPECTED_EXPERIMENTAL_DIRECTIVES =
  'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.';

const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';

const OBJECT_VALUE = Object.create(null);
const ARRAY_VALUE: Array<undefined> = [];

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
  try {
    const result = executeOperation(exeContext);
    if (isPromise(result)) {
      return result.then(
        (data) => {
          const initialResult = buildResponse(data, exeContext.errors);
          if (exeContext.subsequentPayloads.size > 0) {
            return {
              initialResult: {
                ...initialResult,
                hasNext: true,
              },
              subsequentResults: yieldSubsequentPayloads(exeContext),
            };
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
    if (exeContext.subsequentPayloads.size > 0) {
      return {
        initialResult: {
          ...initialResult,
          hasNext: true,
        },
        subsequentResults: yieldSubsequentPayloads(exeContext),
      };
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
  const result = experimentalExecuteIncrementally(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || 'initialResult' in result) {
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
    subsequentPayloads: new Set(),
    streams: new Set(),
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
    // no need to override subsequentPayloads/streams as incremental delivery is not enabled for subscriptions
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

  const collectFieldsResult = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );
  const path = undefined;
  let result;

  const { groupedFieldSet, deferUsages } = collectFieldsResult;

  const deferredFragmentRecords: Array<DeferredFragmentRecord> = [];
  const newDefers = new Map<DeferUsage, DeferredFragmentRecord>();
  for (const deferUsage of deferUsages) {
    const deferredFragmentRecord = new DeferredFragmentRecord({
      deferUsage,
      path,
      exeContext,
    });
    deferredFragmentRecords.push(deferredFragmentRecord);
    newDefers.set(deferUsage, deferredFragmentRecord);
  }

  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      result = executeFields(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        newDefers,
      );
      break;
    case OperationTypeNode.MUTATION:
      result = executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        newDefers,
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
        newDefers,
      );
  }

  for (const deferredFragmentRecord of deferredFragmentRecords) {
    deferredFragmentRecord.completeIfReady();
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
  path: Path<FieldGroup> | undefined,
  groupedFieldSet: GroupedFieldSet,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    groupedFieldSet,
    (results, [responseName, fieldGroup]) => {
      const fieldPath = addPath(path, responseName, fieldGroup);

      const fieldDef = exeContext.schema.getField(
        parentType,
        fieldGroup.fieldName,
      );
      if (!fieldDef) {
        return results;
      }

      addPendingDeferredField(fieldGroup, fieldPath, deferMap);

      if (fieldGroup.shouldInitiateDefer) {
        executeDeferredField(
          exeContext,
          parentType,
          sourceValue,
          fieldGroup,
          fieldDef,
          fieldPath,
          deferMap,
        );
        return results;
      }

      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldDef,
        fieldPath,
        deferMap,
      );

      // TODO: add test for this case
      /* c8 ignore next 3 */
      if (!fieldGroup.inInitialResult) {
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
  path: Path<FieldGroup> | undefined,
  groupedFieldSet: GroupedFieldSet,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord?: StreamRecord | undefined,
  parentRecords?: Array<AsyncPayloadRecord> | undefined,
): PromiseOrValue<ObjMap<unknown>> {
  const contextByFieldGroup = new Map<
    string,
    {
      fieldGroup: FieldGroup;
      fieldPath: Path<FieldGroup>;
      fieldDef: GraphQLField<unknown, unknown>;
    }
  >();

  for (const [responseName, fieldGroup] of groupedFieldSet) {
    const fieldPath = addPath(path, responseName, fieldGroup);
    const fieldDef = exeContext.schema.getField(
      parentType,
      fieldGroup.fieldName,
    );
    if (!fieldDef) {
      continue;
    }

    const fieldGroupContext = {
      fieldGroup,
      fieldPath,
      fieldDef,
    };
    contextByFieldGroup.set(responseName, fieldGroupContext);
    addPendingDeferredField(fieldGroup, fieldPath, deferMap);
  }

  const results = Object.create(null);
  let containsPromise = false;

  try {
    for (const [responseName, context] of contextByFieldGroup) {
      const { fieldGroup, fieldPath, fieldDef } = context;

      if (fieldGroup.shouldInitiateDefer) {
        executeDeferredField(
          exeContext,
          parentType,
          sourceValue,
          fieldGroup,
          fieldDef,
          fieldPath,
          deferMap,
          streamRecord,
          parentRecords,
        );
        continue;
      }

      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldDef,
        fieldPath,
        deferMap,
        streamRecord,
        parentRecords,
      );

      if (fieldGroup.inInitialResult) {
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
  return Array.from(fieldGroup.fields.values()).flat();
}

function executeDeferredField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: unknown,
  fieldGroup: FieldGroup,
  fieldDef: GraphQLField<unknown, unknown>,
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord?: StreamRecord | undefined,
  parentRecords?: Array<AsyncPayloadRecord> | undefined,
): void {
  // executeField only throws with a field in the initial result
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  Promise.resolve().then(() =>
    executeField(
      exeContext,
      parentType,
      source,
      fieldGroup,
      fieldDef,
      path,
      deferMap,
      streamRecord,
      parentRecords,
    ),
  );
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
  fieldDef: GraphQLField<unknown, unknown>,
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord?: StreamRecord | undefined,
  parentRecords?: Array<AsyncPayloadRecord> | undefined,
): PromiseOrValue<unknown> {
  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldGroup,
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
      toNodes(fieldGroup)[0],
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
        deferMap,
        streamRecord,
        parentRecords,
      );
    }

    const completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      deferMap,
      streamRecord,
      parentRecords,
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
          deferMap,
          streamRecord,
        );
        filterSubsequentPayloads(exeContext, path, parentRecords);
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
      deferMap,
      streamRecord,
    );
    filterSubsequentPayloads(exeContext, path, parentRecords);
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
  fieldGroup: FieldGroup,
  parentType: GraphQLObjectType,
  path: Path<FieldGroup>,
): GraphQLResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldNodes: toNodes(fieldGroup),
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
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
): void {
  const error = locatedError(rawError, toNodes(fieldGroup), pathToArray(path));

  addDeferredError(exeContext, error, fieldGroup, path, deferMap);

  if (!fieldGroup.inInitialResult) {
    return;
  }

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    throw error;
  }

  const errors = streamRecord?.errors ?? exeContext.errors;

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  errors.push(error);
}

function getNullableParent(
  exeContext: ExecutionContext,
  path: Path<FieldGroup>,
): Path<FieldGroup> | undefined {
  let depth = 0;
  let fieldPath: Path<FieldGroup> = path;

  while (typeof fieldPath.key === 'number') {
    invariant(fieldPath.prev !== undefined);
    fieldPath = fieldPath.prev;
    depth++;
  }

  const fieldGroup = fieldPath.info;

  const type = fieldGroup.parentType;
  const returnType = type.getFields()[fieldGroup.fieldName].type;

  if (depth > 0) {
    const nullable: Array<boolean> = [];
    let outerType = returnType as GraphQLList<GraphQLOutputType>;
    for (let i = 0; i < depth; i++) {
      const innerType = outerType.ofType;
      nullable.unshift(isNullableType(innerType));
      outerType = innerType as GraphQLList<GraphQLOutputType>;
    }
    let maybeNullablePath = fieldPath;
    for (let i = 0; i < depth; i++) {
      if (nullable[i]) {
        return maybeNullablePath;
      }
      // safe as above
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      maybeNullablePath = maybeNullablePath.prev!;
    }
  }

  if (isNullableType(returnType)) {
    return fieldPath;
  }

  const parentPath = fieldPath.prev;

  if (parentPath === undefined) {
    return undefined;
  }

  return getNullableParent(exeContext, parentPath);
}

function addDeferredError(
  exeContext: ExecutionContext,
  error: GraphQLError,
  fieldGroup: FieldGroup,
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
): void {
  const nullablePath = getNullableParent(exeContext, path);
  const nullablePathAsArray = pathToArray(nullablePath);

  const deferredFragmentRecords: Array<DeferredFragmentRecord> = [];
  const filterPaths = new Set<Path<FieldGroup> | undefined>();

  for (const [deferUsage] of fieldGroup.fields) {
    if (deferUsage !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const deferredFragmentRecord = deferMap.get(deferUsage)!;
      deferredFragmentRecords.push(deferredFragmentRecord);

      if (
        nullablePathAsArray.length <= deferredFragmentRecord.pathAsArray.length
      ) {
        filterPaths.add(deferredFragmentRecord.path);
        deferredFragmentRecord.data = null;
        deferredFragmentRecord.errors.push(error);
        deferredFragmentRecord.complete();
      } else {
        filterPaths.add(nullablePath);
        // nullablePath cannot be undefined if it is longer than a deferredFragmentRecord path
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        deferredFragmentRecord.addError(nullablePath!, error);
        deferredFragmentRecord.completeIfReady();
      }
    }
  }

  for (const filterPath of filterPaths) {
    filterSubsequentPayloads(exeContext, filterPath, deferredFragmentRecords);
  }
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
  maybeReturnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path<FieldGroup>,
  result: unknown,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
): PromiseOrValue<unknown> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  const returnType = isNonNullType(maybeReturnType)
    ? maybeReturnType.ofType
    : maybeReturnType;

  // If result value is null or undefined then return null.
  if (result === null) {
    if (returnType !== maybeReturnType) {
      removePendingDeferredField(fieldGroup, path, deferMap);
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
      );
    }
    reportDeferredValue(null, fieldGroup, path, deferMap);
    return null;
  }

  if (result === undefined) {
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
      deferMap,
      streamRecord,
      parentRecords,
    );
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    const completed = completeLeafValue(returnType, result);
    reportDeferredValue(completed, fieldGroup, path, deferMap);
    return completed;
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
      deferMap,
      streamRecord,
      parentRecords,
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
      deferMap,
      streamRecord,
      parentRecords,
    );
  }
  /* c8 ignore next 6 */
  // Not reachable, all possible output types have been considered.
  invariant(
    false,
    'Cannot complete value of unexpected output type: ' + inspect(returnType),
  );
}

function addPendingDeferredField(
  fieldGroup: FieldGroup,
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage | undefined, DeferredFragmentRecord>,
): void {
  for (const [deferUsage] of fieldGroup.fields) {
    if (deferUsage !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const deferredFragmentRecord = deferMap.get(deferUsage)!;
      deferredFragmentRecord.addPendingField(path);
    }
  }
}

function removePendingDeferredField(
  fieldGroup: FieldGroup,
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
): void {
  for (const [deferUsage] of fieldGroup.fields) {
    if (deferUsage) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const deferredFragmentRecord = deferMap.get(deferUsage)!;
      deferredFragmentRecord.removePendingField(path);
    }
  }
}

function reportDeferredValue(
  result: unknown,
  fieldGroup: FieldGroup,
  path: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
): void {
  for (const [deferUsage] of fieldGroup.fields) {
    if (deferUsage !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const deferredFragmentRecord = deferMap.get(deferUsage)!;
      deferredFragmentRecord.reportDeferredValue(path, result);
    }
  }
}

async function completePromisedValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path<FieldGroup>,
  result: Promise<unknown>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
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
      deferMap,
      streamRecord,
      parentRecords,
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
      deferMap,
      streamRecord,
    );
    filterSubsequentPayloads(exeContext, path, parentRecords);
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
  path: Path<FieldGroup>,
): StreamUsage | undefined {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }

  // TODO: add test for this case (a streamed list nested under a list).
  /* c8 ignore next 3 */
  if (fieldGroup._streamUsage !== undefined) {
    return fieldGroup._streamUsage;
  }

  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    toNodes(fieldGroup)[0],
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

  const streamFields = new AccumulatorMap<DeferUsage | undefined, FieldNode>();
  for (const [, fieldNodes] of fieldGroup.fields) {
    for (const node of fieldNodes) {
      streamFields.add(undefined, node);
    }
  }
  const streamedFieldGroup: FieldGroup = {
    ...fieldGroup,
    fields: streamFields,
  };

  const streamUsage = {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
    fieldGroup: streamedFieldGroup,
  };

  fieldGroup._streamUsage = streamUsage;

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
  path: Path<FieldGroup>,
  iterator: AsyncIterator<unknown>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
): Promise<ReadonlyArray<unknown>> {
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  let index = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (streamUsage && index >= streamUsage.initialCount) {
      const streamContext: StreamContext = {
        label: streamUsage.label,
        path: pathToArray(path),
        iterator,
      };
      exeContext.streams.add(streamContext);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      executeStreamAsyncIterator(
        index,
        iterator,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
        path,
        streamContext,
        deferMap,
        parentRecords,
      );
      break;
    }

    const itemPath = addPath(path, index, fieldGroup);
    let iteration;
    addPendingDeferredField(fieldGroup, itemPath, deferMap);
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await iterator.next();
      if (iteration.done) {
        removePendingDeferredField(fieldGroup, itemPath, deferMap);
        break;
      }
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldGroup,
        itemPath,
        deferMap,
        streamRecord,
      );
      completedResults.push(null);
      break;
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
        deferMap,
        streamRecord,
        parentRecords,
      )
    ) {
      containsPromise = true;
    }
    index += 1;
  }

  reportDeferredValue(ARRAY_VALUE, fieldGroup, path, deferMap);

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
  path: Path<FieldGroup>,
  result: unknown,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
): PromiseOrValue<ReadonlyArray<unknown>> {
  const itemType = returnType.ofType;

  if (isAsyncIterable(result)) {
    const iterator = result[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      path,
      iterator,
      deferMap,
      streamRecord,
      parentRecords,
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
  let currentParents = parentRecords;
  const completedResults: Array<unknown> = [];
  let index = 0;
  let streamContext: StreamContext | undefined;
  for (const item of result) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, fieldGroup);

    if (streamUsage && index >= streamUsage.initialCount) {
      if (streamContext === undefined) {
        streamContext = {
          label: streamUsage.label,
          path: pathToArray(path),
        };
      }
      currentParents = executeStreamField(
        path,
        itemPath,
        item,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
        streamContext,
        deferMap,
        currentParents,
      );
      index++;
      continue;
    }

    addPendingDeferredField(fieldGroup, itemPath, deferMap);
    if (
      completeListItemValue(
        item,
        completedResults,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        deferMap,
        streamRecord,
        parentRecords,
      )
    ) {
      containsPromise = true;
    }

    index++;
  }

  reportDeferredValue(ARRAY_VALUE, fieldGroup, path, deferMap);

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
  itemPath: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
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
        deferMap,
        streamRecord,
        parentRecords,
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
      deferMap,
      streamRecord,
      parentRecords,
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
            deferMap,
            streamRecord,
          );
          filterSubsequentPayloads(exeContext, itemPath, parentRecords);
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
      deferMap,
      streamRecord,
    );
    filterSubsequentPayloads(exeContext, itemPath, parentRecords);
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
  path: Path<FieldGroup>,
  result: unknown,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
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
        deferMap,
        streamRecord,
        parentRecords,
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
    deferMap,
    streamRecord,
    parentRecords,
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
  path: Path<FieldGroup>,
  result: unknown,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
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
          deferMap,
          streamRecord,
          parentRecords,
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
    deferMap,
    streamRecord,
    parentRecords,
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

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
  path: Path<FieldGroup>,
  result: unknown,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  streamRecord: StreamRecord | undefined,
  parentRecords: Array<AsyncPayloadRecord> | undefined,
): PromiseOrValue<ObjMap<unknown>> {
  let newParentRecords: Array<AsyncPayloadRecord> | undefined = [];
  for (const [deferUsage] of fieldGroup.fields) {
    if (deferUsage) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const deferredFragmentRecord = deferMap.get(deferUsage)!;
      newParentRecords.push(deferredFragmentRecord);
    } else {
      newParentRecords = parentRecords;
      break;
    }
  }

  // Collect sub-fields to execute to complete this value.
  const { groupedFieldSet: subGroupedFieldSet, deferUsages: subDeferUsages } =
    collectSubfields(exeContext, returnType, fieldGroup);

  const deferredFragmentRecords: Array<DeferredFragmentRecord> = [];
  const newDefers = new Map<DeferUsage, DeferredFragmentRecord>(deferMap);
  for (const deferUsage of subDeferUsages) {
    const deferredFragmentRecord = new DeferredFragmentRecord({
      deferUsage,
      path,
      parents: newParentRecords,
      exeContext,
    });
    deferredFragmentRecords.push(deferredFragmentRecord);
    newDefers.set(deferUsage, deferredFragmentRecord);
  }

  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    subGroupedFieldSet,
    newDefers,
    streamRecord,
    newParentRecords,
  );

  reportDeferredValue(OBJECT_VALUE, fieldGroup, path, deferMap);

  for (const deferredFragmentRecord of deferredFragmentRecords) {
    deferredFragmentRecord.completeIfReady();
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

  const { groupedFieldSet } = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );

  const firstRootField = groupedFieldSet.entries().next().value;
  const [responseName, fieldGroup] = firstRootField;
  const fieldName = fieldGroup.fieldName;
  const fieldDef = schema.getField(rootType, fieldName);

  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: toNodes(fieldGroup) },
    );
  }

  const path = addPath(undefined, responseName, fieldGroup);
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldGroup,
    rootType,
    path,
  );

  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = getArgumentValues(
      fieldDef,
      toNodes(fieldGroup)[0],
      variableValues,
    );

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
        throw locatedError(error, toNodes(fieldGroup), pathToArray(path));
      });
    }

    return assertEventStream(result);
  } catch (error) {
    throw locatedError(error, toNodes(fieldGroup), pathToArray(path));
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

function executeStreamField(
  path: Path<FieldGroup>,
  itemPath: Path<FieldGroup>,
  item: PromiseOrValue<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  streamContext: StreamContext,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  parents?: Array<AsyncPayloadRecord> | undefined,
): Array<StreamRecord> {
  const streamRecord = new StreamRecord({
    streamContext,
    path: itemPath,
    parents,
    exeContext,
  });
  const currentParents = [streamRecord];
  if (isPromise(item)) {
    const completedItems = completePromisedValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      deferMap,
      streamRecord,
      currentParents,
    ).then(
      (value) => [value],
      (error) => {
        streamRecord.errors.push(error);
        filterSubsequentPayloads(exeContext, path, currentParents);
        return null;
      },
    );

    streamRecord.addItems(completedItems);
    return currentParents;
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
        deferMap,
        streamRecord,
        currentParents,
      );
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldGroup,
        itemPath,
        deferMap,
        streamRecord,
      );
      completedItem = null;
      filterSubsequentPayloads(exeContext, itemPath, currentParents);
    }
  } catch (error) {
    streamRecord.errors.push(error);
    filterSubsequentPayloads(exeContext, path, currentParents);
    streamRecord.addItems(null);
    return currentParents;
  }

  if (isPromise(completedItem)) {
    const completedItems = completedItem
      .then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          deferMap,
          streamRecord,
        );
        filterSubsequentPayloads(exeContext, itemPath, currentParents);
        return null;
      })
      .then(
        (value) => [value],
        (error) => {
          streamRecord.errors.push(error);
          filterSubsequentPayloads(exeContext, path, currentParents);
          return null;
        },
      );

    streamRecord.addItems(completedItems);
    return currentParents;
  }

  streamRecord.addItems([completedItem]);
  return currentParents;
}

async function executeStreamAsyncIteratorItem(
  iterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  streamRecord: StreamRecord,
  itemPath: Path<FieldGroup>,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  parentRecords: Array<AsyncPayloadRecord>,
): Promise<IteratorResult<unknown>> {
  let item;
  try {
    const iteration = await iterator.next();
    if (!exeContext.streams.has(streamRecord.streamContext) || iteration.done) {
      streamRecord.setIsCompletedIterator();
      return { done: true, value: undefined };
    }
    item = iteration.value;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      deferMap,
      streamRecord,
    );
    // don't continue if iterator throws
    return { done: true, value: null };
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
      deferMap,
      streamRecord,
      parentRecords,
    );

    if (isPromise(completedItem)) {
      completedItem = completedItem.then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          deferMap,
          streamRecord,
        );
        filterSubsequentPayloads(exeContext, itemPath, parentRecords);
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
      deferMap,
      streamRecord,
    );
    filterSubsequentPayloads(exeContext, itemPath, parentRecords);
    return { done: false, value: null };
  }
}

async function executeStreamAsyncIterator(
  initialIndex: number,
  iterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  path: Path<FieldGroup>,
  streamContext: StreamContext,
  deferMap: Map<DeferUsage, DeferredFragmentRecord>,
  parents?: Array<AsyncPayloadRecord> | undefined,
): Promise<void> {
  let index = initialIndex;
  let currentParents = parents;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const itemPath = addPath(path, index, fieldGroup);
    const streamRecord = new StreamRecord({
      streamContext,
      path: itemPath,
      parents: currentParents,
      exeContext,
    });
    currentParents = [streamRecord];

    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await executeStreamAsyncIteratorItem(
        iterator,
        exeContext,
        fieldGroup,
        info,
        itemType,
        streamRecord,
        itemPath,
        deferMap,
        currentParents,
      );
    } catch (error) {
      streamRecord.errors.push(error);
      filterSubsequentPayloads(exeContext, path, currentParents);
      streamRecord.addItems(null);
      // entire stream has errored and bubbled upwards
      if (iterator?.return) {
        iterator.return().catch(() => {
          // ignore errors
        });
      }
      return;
    }

    const { done, value: completedItem } = iteration;

    let completedItems: PromiseOrValue<Array<unknown> | null>;
    if (isPromise(completedItem)) {
      completedItems = completedItem.then(
        (value) => [value],
        (error) => {
          streamRecord.errors.push(error);
          filterSubsequentPayloads(exeContext, path, [streamRecord]);
          return null;
        },
      );
    } else {
      completedItems = [completedItem];
    }

    streamRecord.addItems(completedItems);

    if (done) {
      break;
    }
    index++;
  }
}

function filterSubsequentPayloads(
  exeContext: ExecutionContext,
  nullPath: Path<FieldGroup> | undefined,
  currentAsyncRecords: Array<AsyncPayloadRecord> | undefined,
): void {
  const nullPathArray = pathToArray(nullPath);
  const streams = new Set<StreamContext>();
  exeContext.subsequentPayloads.forEach((asyncRecord) => {
    if (currentAsyncRecords?.includes(asyncRecord)) {
      // don't remove payload from where error originates
      return;
    }
    for (let i = 0; i < nullPathArray.length; i++) {
      if (asyncRecord.pathAsArray[i] !== nullPathArray[i]) {
        // asyncRecord points to a path unaffected by this payload
        return;
      }
    }
    // asyncRecord path points to nulled error field
    if (isStreamPayload(asyncRecord)) {
      streams.add(asyncRecord.streamContext);
    }
    exeContext.subsequentPayloads.delete(asyncRecord);
  });
  streams.forEach((stream) => {
    returnStreamIteratorIgnoringError(stream);
    exeContext.streams.delete(stream);
  });
}

function returnStreamIteratorIgnoringError(streamContext: StreamContext): void {
  streamContext.iterator?.return?.().catch(() => {
    // ignore error
  });
}

function getCompletedIncrementalResults(
  exeContext: ExecutionContext,
): Array<IncrementalResult> {
  const incrementalResults: Array<IncrementalResult> = [];
  for (const asyncPayloadRecord of exeContext.subsequentPayloads) {
    const incrementalResult: IncrementalResult = {};
    if (!asyncPayloadRecord.isCompleted) {
      continue;
    }
    exeContext.subsequentPayloads.delete(asyncPayloadRecord);
    if (isStreamPayload(asyncPayloadRecord)) {
      const items = asyncPayloadRecord.items;
      if (asyncPayloadRecord.isCompletedIterator) {
        // async iterable resolver just finished but there may be pending payloads
        continue;
      }
      (incrementalResult as IncrementalStreamResult).items = items ?? null;
      if (asyncPayloadRecord.streamContext.label !== undefined) {
        incrementalResult.label = asyncPayloadRecord.streamContext.label;
      }
    } else {
      const data = asyncPayloadRecord.data;
      (incrementalResult as IncrementalDeferResult).data = data ?? null;
      if (asyncPayloadRecord.deferUsage.label !== undefined) {
        incrementalResult.label = asyncPayloadRecord.deferUsage.label;
      }
    }

    incrementalResult.path = asyncPayloadRecord.pathAsArray;

    if (asyncPayloadRecord.errors.length > 0) {
      incrementalResult.errors = asyncPayloadRecord.errors;
    }
    incrementalResults.push(incrementalResult);
  }
  return incrementalResults;
}

function yieldSubsequentPayloads(
  exeContext: ExecutionContext,
): AsyncGenerator<SubsequentIncrementalExecutionResult, void, void> {
  let isDone = false;

  async function next(): Promise<
    IteratorResult<SubsequentIncrementalExecutionResult, void>
  > {
    if (isDone) {
      return { value: undefined, done: true };
    }

    await Promise.race(
      Array.from(exeContext.subsequentPayloads).map((p) => p.promise),
    );

    if (isDone) {
      // a different call to next has exhausted all payloads
      return { value: undefined, done: true };
    }

    const incremental = getCompletedIncrementalResults(exeContext);
    const hasNext = exeContext.subsequentPayloads.size > 0;

    if (!incremental.length && hasNext) {
      return next();
    }

    if (!hasNext) {
      isDone = true;
    }

    return {
      value: incremental.length ? { incremental, hasNext } : { hasNext },
      done: false,
    };
  }

  function returnStreamIterators() {
    const promises: Array<Promise<IteratorResult<unknown>>> = [];
    exeContext.streams.forEach((streamContext) => {
      if (streamContext.iterator?.return) {
        promises.push(streamContext.iterator.return());
      }
    });
    return Promise.all(promises);
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next,
    async return(): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > {
      isDone = true;
      await returnStreamIterators();
      return { value: undefined, done: true };
    },
    async throw(
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> {
      isDone = true;
      await returnStreamIterators();
      return Promise.reject(error);
    },
  };
}

class DeferredFragmentRecord {
  type: 'defer';
  errors: Array<GraphQLError>;
  deferUsage: DeferUsage;
  path: Path<FieldGroup> | undefined;
  pathAsArray: Array<string | number>;
  promise: Promise<void>;
  data: ObjMap<unknown> | null;
  parents: Array<AsyncPayloadRecord> | undefined;
  isCompleted: boolean;
  _exeContext: ExecutionContext;
  _resolve?: (arg: PromiseOrValue<ObjMap<unknown> | null>) => void;
  _pending: Set<Path<FieldGroup>>;
  _results: Map<Path<FieldGroup> | undefined, Map<Path<FieldGroup>, unknown>>;

  constructor(opts: {
    deferUsage: DeferUsage;
    path: Path<FieldGroup> | undefined;
    parents?: Array<AsyncPayloadRecord> | undefined;
    exeContext: ExecutionContext;
  }) {
    this.type = 'defer';
    this.deferUsage = opts.deferUsage;
    this.path = opts.path;
    this.pathAsArray = pathToArray(opts.path);
    this.parents = opts.parents;
    this.errors = [];
    this._exeContext = opts.exeContext;
    this._exeContext.subsequentPayloads.add(this);
    this.isCompleted = false;
    this.data = Object.create(null);
    this._pending = new Set();
    this._results = new Map();
    this.promise = new Promise<ObjMap<unknown> | null>((resolve) => {
      this._resolve = (promiseOrValue) => {
        resolve(promiseOrValue);
      };
    }).then((data) => {
      this.data = data;
      this.isCompleted = true;
    });
  }

  addPendingField(path: Path<FieldGroup>) {
    this._pending.add(path);
    let siblings = this._results.get(path.prev);
    if (siblings === undefined) {
      siblings = new Map<Path<FieldGroup>, unknown>();
      this._results.set(path.prev, siblings);
    }
    siblings.set(path, undefined);
  }

  removePendingField(path: Path<FieldGroup>) {
    this._pending.delete(path);
    this._results.delete(path);
    const siblings = this._results.get(path.prev);
    if (siblings !== undefined) {
      siblings.delete(path);
    }
  }

  reportDeferredValue(path: Path<FieldGroup>, result: unknown) {
    this._pending.delete(path);
    const siblings = this._results.get(path.prev);
    if (siblings !== undefined) {
      const existingValue = siblings.get(path);
      // if a null has already bubbled, do not overwrite
      if (existingValue === undefined) {
        siblings.set(path, result);
      }
    }
    this.completeIfReady();
  }

  completeIfReady() {
    if (this._pending.size === 0) {
      this.complete();
    }
  }

  complete(): void {
    this._buildData(this.data, this._results.get(this.path));

    if (this.parents !== undefined) {
      const parentPromises = this.parents.map((parent) => parent.promise);
      this._resolve?.(Promise.any(parentPromises).then(() => this.data));
      return;
    }
    this._resolve?.(this.data);
  }

  addError(path: Path<FieldGroup>, error: GraphQLError): void {
    this.errors.push(error);
    this.removePendingTree(path);
    const siblings = this._results.get(path.prev);
    if (siblings !== undefined) {
      // overwrite current value to support null bubbling
      siblings.set(path, null);
    }
  }

  removePendingTree(path: Path<FieldGroup>) {
    const children = this._results.get(path);
    if (children !== undefined) {
      for (const [childPath] of children) {
        this.removePendingTree(childPath);
      }
    }
    this.removePendingField(path);
  }

  _buildData(
    parent: any,
    children: Map<Path<FieldGroup>, unknown> | undefined,
  ): void {
    if (children === undefined) {
      return;
    }
    for (const [childPath, value] of children) {
      const key = childPath.key;
      switch (value) {
        case null:
          parent[key] = null;
          break;
        case OBJECT_VALUE:
          parent[key] = Object.create(null);
          this._buildData(parent[key], this._results.get(childPath));
          break;
        case ARRAY_VALUE:
          parent[key] = [];
          this._buildData(parent[key], this._results.get(childPath));
          break;
        default:
          parent[key] = value;
      }
    }
  }
}

interface StreamContext {
  label: string | undefined;
  path: Array<string | number>;
  iterator?: AsyncIterator<unknown> | undefined;
}

class StreamRecord {
  type: 'stream';
  errors: Array<GraphQLError>;
  streamContext: StreamContext;
  pathAsArray: Array<string | number>;
  items: Array<unknown> | null;
  promise: Promise<void>;
  parents: Array<AsyncPayloadRecord> | undefined;
  isCompletedIterator?: boolean;
  isCompleted: boolean;
  _exeContext: ExecutionContext;
  _resolve?: (arg: PromiseOrValue<Array<unknown> | null>) => void;
  constructor(opts: {
    streamContext: StreamContext;
    path: Path<FieldGroup> | undefined;
    parents: Array<AsyncPayloadRecord> | undefined;
    exeContext: ExecutionContext;
  }) {
    this.type = 'stream';
    this.streamContext = opts.streamContext;
    this.pathAsArray = pathToArray(opts.path);
    this.parents = opts.parents;
    this.errors = [];
    this._exeContext = opts.exeContext;
    this._exeContext.subsequentPayloads.add(this);
    this.isCompleted = false;
    this.items = [];
    this.promise = new Promise<Array<unknown> | null>((resolve) => {
      this._resolve = (promiseOrValue) => {
        resolve(promiseOrValue);
      };
    }).then((items) => {
      this.items = items;
      this.isCompleted = true;
    });
  }

  addItems(items: PromiseOrValue<Array<unknown> | null>) {
    if (this.parents !== undefined) {
      const parentPromises = this.parents.map((parent) => parent.promise);
      this._resolve?.(Promise.any(parentPromises).then(() => items));
      return;
    }
    this._resolve?.(items);
  }

  setIsCompletedIterator() {
    this.isCompletedIterator = true;
  }
}

type AsyncPayloadRecord = DeferredFragmentRecord | StreamRecord;

function isStreamPayload(
  asyncPayload: AsyncPayloadRecord,
): asyncPayload is StreamRecord {
  return asyncPayload.type === 'stream';
}
