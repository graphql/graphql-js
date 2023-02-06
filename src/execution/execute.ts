import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { Maybe } from '../jsutils/Maybe.js';
import { memoize3 } from '../jsutils/memoize3.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path, PathFactory } from '../jsutils/Path.js';
import { createPathFactory, pathToArray } from '../jsutils/Path.js';
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
  isObjectType,
} from '../type/definition.js';
import { GraphQLStreamDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
import { assertValidSchema } from '../type/validate.js';

import type { FieldGroup, GroupedFieldSet } from './collectFields.js';
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
  addPath: PathFactory;
  errors: Array<GraphQLError>;
  subsequentPayloads: Set<AsyncPayloadRecord>;
  branches: WeakMap<GroupedFieldSet, Set<Path | undefined>>;
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
}

export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  path?: ReadonlyArray<string | number>;
}

export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
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
    addPath: createPathFactory(),
    subsequentPayloads: new Set(),
    branches: new WeakMap(),
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
    addPath: createPathFactory(),
    subsequentPayloads: new Set(),
    branches: new WeakMap(),
    errors: [],
  };
}

function shouldBranch(
  groupedFieldSet: GroupedFieldSet,
  exeContext: ExecutionContext,
  path: Path | undefined,
): boolean {
  const set = exeContext.branches.get(groupedFieldSet);
  if (set === undefined) {
    exeContext.branches.set(groupedFieldSet, new Set([path]));
    return true;
  }
  if (!set.has(path)) {
    set.add(path);
    return true;
  }
  return false;
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

  const { groupedFieldSet, newDeferDepth } = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );
  const path = undefined;
  let result;

  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      result = executeFields(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
      );
      break;
    case OperationTypeNode.MUTATION:
      result = executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
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
      );
  }

  if (
    newDeferDepth !== undefined &&
    shouldBranch(groupedFieldSet, exeContext, path)
  ) {
    executeDeferredFragment(
      exeContext,
      rootType,
      rootValue,
      groupedFieldSet,
      newDeferDepth,
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
  groupedFieldSet: GroupedFieldSet,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    groupedFieldSet,
    (results, [responseName, fieldGroup]) => {
      const fieldPath = exeContext.addPath(path, responseName, parentType.name);

      if (!shouldExecute(fieldGroup)) {
        return results;
      }
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
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

function shouldExecute(
  fieldGroup: FieldGroup,
  asyncPayload?: AsyncPayloadRecord | undefined,
): boolean {
  let deferDepth: number | undefined;
  if (
    asyncPayload === undefined ||
    (deferDepth = asyncPayload.deferDepth) === undefined ||
    !fieldGroup.isLeaf
  ) {
    for (const fieldDeferDepth of fieldGroup.fields.keys()) {
      if (fieldDeferDepth === deferDepth) {
        return true;
      }
    }
    return false;
  }

  let hasDepth = false;
  for (const fieldDeferDepth of fieldGroup.fields.keys()) {
    if (inDeferTree(asyncPayload, fieldDeferDepth, deferDepth)) {
      return false;
    }
    if (fieldDeferDepth === deferDepth) {
      hasDepth = true;
    }
  }
  return hasDepth;
}

function inDeferTree(
  asyncPayload: AsyncPayloadRecord,
  fieldDeferDepth: number | undefined,
  deferDepth: number | undefined,
): boolean {
  const parentContext = asyncPayload.parentContext;
  if (parentContext === undefined) {
    return fieldDeferDepth === undefined;
  }
  const parentDeferDepth = parentContext.deferDepth;
  // Stream payloads have the same deferDepth as their parent, and so should be skipped.
  if (parentDeferDepth !== deferDepth && fieldDeferDepth === parentDeferDepth) {
    return true;
  }
  return inDeferTree(parentContext, fieldDeferDepth, parentDeferDepth);
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
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  try {
    for (const [responseName, fieldGroup] of groupedFieldSet) {
      const fieldPath = exeContext.addPath(path, responseName, parentType.name);

      if (shouldExecute(fieldGroup, asyncPayloadRecord)) {
        const result = executeField(
          exeContext,
          parentType,
          sourceValue,
          fieldGroup,
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
  return [...fieldGroup.fields.values()].flat();
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
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<unknown> {
  const errors = asyncPayloadRecord?.errors ?? exeContext.errors;
  const firstField = (
    fieldGroup.fields.values().next().value as Array<FieldNode>
  )[0];
  const fieldName = firstField.name.value;
  const fieldDef = exeContext.schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldGroup,
    parentType,
    path,
    asyncPayloadRecord,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      firstField,
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
        asyncPayloadRecord,
      );
    }

    const completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      asyncPayloadRecord,
    );

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        const error = locatedError(
          rawError,
          toNodes(fieldGroup),
          pathToArray(path),
        );
        const handledError = handleFieldError(error, returnType, errors);
        filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
        return handledError;
      });
    }
    return completed;
  } catch (rawError) {
    const error = locatedError(
      rawError,
      toNodes(fieldGroup),
      pathToArray(path),
    );
    const handledError = handleFieldError(error, returnType, errors);
    filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
    return handledError;
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
  path: Path,
  asyncPayloadRecord?: AsyncPayloadRecord | undefined,
): GraphQLResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldGroup,
    deferDepth: asyncPayloadRecord?.deferDepth,
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
  fieldGroup: FieldGroup,
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
      fieldGroup,
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
      fieldGroup,
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
      fieldGroup,
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
      fieldGroup,
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

async function completePromisedValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: Promise<unknown>,
  asyncPayloadRecord?: AsyncPayloadRecord,
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
      asyncPayloadRecord,
    );
    if (isPromise(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    const errors = asyncPayloadRecord?.errors ?? exeContext.errors;
    const error = locatedError(
      rawError,
      toNodes(fieldGroup),
      pathToArray(path),
    );
    const handledError = handleFieldError(error, returnType, errors);
    filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
    return handledError;
  }
}

/**
 * Returns an object containing the `@stream` arguments if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamValues(
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  path: Path,
):
  | undefined
  | {
      initialCount: number | undefined;
    } {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }

  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const firstField = (
    fieldGroup.fields.values().next().value as Array<FieldNode>
  )[0];
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    firstField,
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

  return {
    initialCount: stream.initialCount,
  };
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
  iterator: AsyncIterator<unknown>,
  asyncPayloadRecord?: AsyncPayloadRecord,
): Promise<ReadonlyArray<unknown>> {
  const errors = asyncPayloadRecord?.errors ?? exeContext.errors;
  const stream = getStreamValues(exeContext, fieldGroup, path);
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
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
        fieldGroup,
        info,
        itemType,
        path,
        asyncPayloadRecord,
      );
      break;
    }

    const itemPath = exeContext.addPath(path, index, undefined);
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await iterator.next();
      if (iteration.done) {
        break;
      }
    } catch (rawError) {
      const error = locatedError(
        rawError,
        toNodes(fieldGroup),
        pathToArray(itemPath),
      );
      completedResults.push(handleFieldError(error, itemType, errors));
      break;
    }

    if (
      completeListItemValue(
        iteration.value,
        completedResults,
        errors,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        asyncPayloadRecord,
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
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ReadonlyArray<unknown>> {
  const itemType = returnType.ofType;
  const errors = asyncPayloadRecord?.errors ?? exeContext.errors;

  if (isAsyncIterable(result)) {
    const iterator = result[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldGroup,
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

  const stream = getStreamValues(exeContext, fieldGroup, path);

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  let previousAsyncPayloadRecord = asyncPayloadRecord;
  const completedResults: Array<unknown> = [];
  let index = 0;
  for (const item of result) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = exeContext.addPath(path, index, undefined);

    if (
      stream &&
      typeof stream.initialCount === 'number' &&
      index >= stream.initialCount
    ) {
      previousAsyncPayloadRecord = executeStreamField(
        path,
        itemPath,
        item,
        exeContext,
        fieldGroup,
        info,
        itemType,
        previousAsyncPayloadRecord,
      );
      index++;
      continue;
    }

    if (
      completeListItemValue(
        item,
        completedResults,
        errors,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        asyncPayloadRecord,
      )
    ) {
      containsPromise = true;
    }

    index++;
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
  errors: Array<GraphQLError>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemPath: Path,
  asyncPayloadRecord?: AsyncPayloadRecord,
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
        asyncPayloadRecord,
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
      asyncPayloadRecord,
    );

    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(undefined, (rawError) => {
          const error = locatedError(
            rawError,
            toNodes(fieldGroup),
            pathToArray(itemPath),
          );
          const handledError = handleFieldError(error, itemType, errors);
          filterSubsequentPayloads(exeContext, itemPath, asyncPayloadRecord);
          return handledError;
        }),
      );

      return true;
    }

    completedResults.push(completedItem);
  } catch (rawError) {
    const error = locatedError(
      rawError,
      toNodes(fieldGroup),
      pathToArray(itemPath),
    );
    const handledError = handleFieldError(error, itemType, errors);
    filterSubsequentPayloads(exeContext, itemPath, asyncPayloadRecord);
    completedResults.push(handledError);
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
          fieldGroup,
          info,
          result,
        ),
        fieldGroup,
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
      fieldGroup,
      info,
      result,
    ),
    fieldGroup,
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
          throw invalidReturnTypeError(returnType, result, fieldGroup);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldGroup,
          path,
          result,
          asyncPayloadRecord,
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
    asyncPayloadRecord,
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
  path: Path,
  result: unknown,
  asyncPayloadRecord?: AsyncPayloadRecord,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const { groupedFieldSet, newDeferDepth } = collectSubfields(
    exeContext,
    returnType,
    fieldGroup,
  );

  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    groupedFieldSet,
    asyncPayloadRecord,
  );

  if (
    newDeferDepth !== undefined &&
    shouldBranch(groupedFieldSet, exeContext, path)
  ) {
    executeDeferredFragment(
      exeContext,
      returnType,
      result,
      groupedFieldSet,
      newDeferDepth,
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

  const firstRootField = groupedFieldSet.entries().next().value as [
    string,
    FieldGroup,
  ];
  const [responseName, fieldGroup] = firstRootField;
  const firstField = (
    fieldGroup.fields.values().next().value as Array<FieldNode>
  )[0];
  const fieldName = firstField.name.value;
  const fieldDef = schema.getField(rootType, fieldName);

  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: toNodes(fieldGroup) },
    );
  }

  const path = exeContext.addPath(undefined, responseName, rootType.name);
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
    const args = getArgumentValues(fieldDef, firstField, variableValues);

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

function executeDeferredFragment(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  groupedFieldSet: GroupedFieldSet,
  newDeferDepth: number,
  path?: Path,
  parentContext?: AsyncPayloadRecord,
): void {
  const asyncPayloadRecord = new DeferredFragmentRecord({
    deferDepth: newDeferDepth,
    path,
    parentContext,
    exeContext,
  });
  let promiseOrData;
  try {
    promiseOrData = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      groupedFieldSet,
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
}

function executeStreamField(
  path: Path,
  itemPath: Path,
  item: PromiseOrValue<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  parentContext?: AsyncPayloadRecord,
): AsyncPayloadRecord {
  const asyncPayloadRecord = new StreamRecord({
    deferDepth: parentContext?.deferDepth,
    path: itemPath,
    parentContext,
    exeContext,
  });
  if (isPromise(item)) {
    const completedItems = completePromisedValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      asyncPayloadRecord,
    ).then(
      (value) => [value],
      (error) => {
        asyncPayloadRecord.errors.push(error);
        filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
        return null;
      },
    );

    asyncPayloadRecord.addItems(completedItems);
    return asyncPayloadRecord;
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
        asyncPayloadRecord,
      );
    } catch (rawError) {
      const error = locatedError(
        rawError,
        toNodes(fieldGroup),
        pathToArray(itemPath),
      );
      completedItem = handleFieldError(
        error,
        itemType,
        asyncPayloadRecord.errors,
      );
      filterSubsequentPayloads(exeContext, itemPath, asyncPayloadRecord);
    }
  } catch (error) {
    asyncPayloadRecord.errors.push(error);
    filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
    asyncPayloadRecord.addItems(null);
    return asyncPayloadRecord;
  }

  if (isPromise(completedItem)) {
    const completedItems = completedItem
      .then(undefined, (rawError) => {
        const error = locatedError(
          rawError,
          toNodes(fieldGroup),
          pathToArray(itemPath),
        );
        const handledError = handleFieldError(
          error,
          itemType,
          asyncPayloadRecord.errors,
        );
        filterSubsequentPayloads(exeContext, itemPath, asyncPayloadRecord);
        return handledError;
      })
      .then(
        (value) => [value],
        (error) => {
          asyncPayloadRecord.errors.push(error);
          filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
          return null;
        },
      );

    asyncPayloadRecord.addItems(completedItems);
    return asyncPayloadRecord;
  }

  asyncPayloadRecord.addItems([completedItem]);
  return asyncPayloadRecord;
}

async function executeStreamIteratorItem(
  iterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  asyncPayloadRecord: StreamRecord,
  itemPath: Path,
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
    const error = locatedError(
      rawError,
      toNodes(fieldGroup),
      pathToArray(itemPath),
    );
    const value = handleFieldError(error, itemType, asyncPayloadRecord.errors);
    // don't continue if iterator throws
    return { done: true, value };
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
      asyncPayloadRecord,
    );

    if (isPromise(completedItem)) {
      completedItem = completedItem.then(undefined, (rawError) => {
        const error = locatedError(
          rawError,
          toNodes(fieldGroup),
          pathToArray(itemPath),
        );
        const handledError = handleFieldError(
          error,
          itemType,
          asyncPayloadRecord.errors,
        );
        filterSubsequentPayloads(exeContext, itemPath, asyncPayloadRecord);
        return handledError;
      });
    }
    return { done: false, value: completedItem };
  } catch (rawError) {
    const error = locatedError(
      rawError,
      toNodes(fieldGroup),
      pathToArray(itemPath),
    );
    const value = handleFieldError(error, itemType, asyncPayloadRecord.errors);
    filterSubsequentPayloads(exeContext, itemPath, asyncPayloadRecord);
    return { done: false, value };
  }
}

async function executeStreamIterator(
  initialIndex: number,
  iterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  path: Path,
  parentContext?: AsyncPayloadRecord,
): Promise<void> {
  let index = initialIndex;
  const deferDepth = parentContext?.deferDepth;
  let previousAsyncPayloadRecord = parentContext ?? undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const itemPath = exeContext.addPath(path, index, undefined);
    const asyncPayloadRecord = new StreamRecord({
      path: itemPath,
      deferDepth,
      parentContext: previousAsyncPayloadRecord,
      iterator,
      exeContext,
    });

    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await executeStreamIteratorItem(
        iterator,
        exeContext,
        fieldGroup,
        info,
        itemType,
        asyncPayloadRecord,
        itemPath,
      );
    } catch (error) {
      asyncPayloadRecord.errors.push(error);
      filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
      asyncPayloadRecord.addItems(null);
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
          asyncPayloadRecord.errors.push(error);
          filterSubsequentPayloads(exeContext, path, asyncPayloadRecord);
          return null;
        },
      );
    } else {
      completedItems = [completedItem];
    }

    asyncPayloadRecord.addItems(completedItems);

    if (done) {
      break;
    }
    previousAsyncPayloadRecord = asyncPayloadRecord;
    index++;
  }
}

function filterSubsequentPayloads(
  exeContext: ExecutionContext,
  nullPath: Path,
  currentAsyncRecord: AsyncPayloadRecord | undefined,
): void {
  const nullPathArray = pathToArray(nullPath);
  exeContext.subsequentPayloads.forEach((asyncRecord) => {
    if (asyncRecord === currentAsyncRecord) {
      // don't remove payload from where error originates
      return;
    }
    for (let i = 0; i < nullPathArray.length; i++) {
      if (asyncRecord.path[i] !== nullPathArray[i]) {
        // asyncRecord points to a path unaffected by this payload
        return;
      }
    }
    // asyncRecord path points to nulled error field
    if (isStreamPayload(asyncRecord) && asyncRecord.iterator?.return) {
      asyncRecord.iterator.return().catch(() => {
        // ignore error
      });
    }
    exeContext.subsequentPayloads.delete(asyncRecord);
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
      (incrementalResult as IncrementalStreamResult).items = items;
    } else {
      const data = asyncPayloadRecord.data;
      (incrementalResult as IncrementalDeferResult).data = data ?? null;
    }

    incrementalResult.path = asyncPayloadRecord.path;
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
    exeContext.subsequentPayloads.forEach((asyncPayloadRecord) => {
      if (
        isStreamPayload(asyncPayloadRecord) &&
        asyncPayloadRecord.iterator?.return
      ) {
        promises.push(asyncPayloadRecord.iterator.return());
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
      await returnStreamIterators();
      isDone = true;
      return { value: undefined, done: true };
    },
    async throw(
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> {
      await returnStreamIterators();
      isDone = true;
      return Promise.reject(error);
    },
  };
}

class DeferredFragmentRecord {
  type: 'defer';
  errors: Array<GraphQLError>;
  path: Array<string | number>;
  deferDepth: number | undefined;
  promise: Promise<void>;
  data: ObjMap<unknown> | null;
  parentContext: AsyncPayloadRecord | undefined;
  isCompleted: boolean;
  _exeContext: ExecutionContext;
  _resolve?: (arg: PromiseOrValue<ObjMap<unknown> | null>) => void;
  constructor(opts: {
    path: Path | undefined;
    deferDepth: number | undefined;
    parentContext: AsyncPayloadRecord | undefined;
    exeContext: ExecutionContext;
  }) {
    this.type = 'defer';
    this.path = pathToArray(opts.path);
    this.deferDepth = opts.deferDepth;
    this.parentContext = opts.parentContext;
    this.errors = [];
    this._exeContext = opts.exeContext;
    this._exeContext.subsequentPayloads.add(this);
    this.isCompleted = false;
    this.data = null;
    this.promise = new Promise<ObjMap<unknown> | null>((resolve) => {
      this._resolve = (promiseOrValue) => {
        resolve(promiseOrValue);
      };
    }).then((data) => {
      this.data = data;
      this.isCompleted = true;
    });
  }

  addData(data: PromiseOrValue<ObjMap<unknown> | null>) {
    const parentData = this.parentContext?.promise;
    if (parentData) {
      this._resolve?.(parentData.then(() => data));
      return;
    }
    this._resolve?.(data);
  }
}

class StreamRecord {
  type: 'stream';
  errors: Array<GraphQLError>;
  path: Array<string | number>;
  deferDepth: number | undefined;
  items: Array<unknown> | null;
  promise: Promise<void>;
  parentContext: AsyncPayloadRecord | undefined;
  iterator: AsyncIterator<unknown> | undefined;
  isCompletedIterator?: boolean;
  isCompleted: boolean;
  _exeContext: ExecutionContext;
  _resolve?: (arg: PromiseOrValue<Array<unknown> | null>) => void;
  constructor(opts: {
    path: Path | undefined;
    deferDepth: number | undefined;
    iterator?: AsyncIterator<unknown>;
    parentContext: AsyncPayloadRecord | undefined;
    exeContext: ExecutionContext;
  }) {
    this.type = 'stream';
    this.items = null;
    this.path = pathToArray(opts.path);
    this.deferDepth = opts.deferDepth;
    this.parentContext = opts.parentContext;
    this.iterator = opts.iterator;
    this.errors = [];
    this._exeContext = opts.exeContext;
    this._exeContext.subsequentPayloads.add(this);
    this.isCompleted = false;
    this.items = null;
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
    const parentData = this.parentContext?.promise;
    if (parentData) {
      this._resolve?.(parentData.then(() => items));
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
