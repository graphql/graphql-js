import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
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
import {
  GraphQLDisableErrorPropagationDirective,
  GraphQLStreamDirective,
} from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
import { assertValidSchema } from '../type/validate.js';

import {
  AbortSignalListener,
  cancellableIterable,
  cancellablePromise,
} from './AbortSignalListener.js';
import type { DeferUsageSet, ExecutionPlan } from './buildExecutionPlan.js';
import { buildExecutionPlan } from './buildExecutionPlan.js';
import type {
  DeferUsage,
  FieldDetailsList,
  FragmentDetails,
  GroupedFieldSet,
} from './collectFields.js';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields.js';
import { getVariableSignature } from './getVariableSignature.js';
import { buildIncrementalResponse } from './IncrementalPublisher.js';
import { mapAsyncIterable } from './mapAsyncIterable.js';
import type {
  CancellableStreamRecord,
  CompletedExecutionGroup,
  ExecutionResult,
  ExperimentalIncrementalExecutionResults,
  IncrementalDataRecord,
  PendingExecutionGroup,
  StreamItemRecord,
  StreamItemResult,
  StreamRecord,
} from './types.js';
import { DeferredFragmentRecord } from './types.js';
import type { VariableValues } from './values.js';
import {
  experimentalGetArgumentValues,
  getArgumentValues,
  getDirectiveValues,
  getVariableValues,
} from './values.js';

/* eslint-disable @typescript-eslint/max-params */
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
  enableEarlyExecution: boolean;
  hideSuggestions: boolean;
  abortSignal: AbortSignal | undefined;
}

export interface ExecutionContext {
  validatedExecutionArgs: ValidatedExecutionArgs;
  errors: Array<GraphQLError> | undefined;
  abortSignalListener: AbortSignalListener | undefined;
  completed: boolean;
  cancellableStreams: Set<CancellableStreamRecord> | undefined;
  errorPropagation: boolean;
}

interface IncrementalContext {
  errors: Array<GraphQLError> | undefined;
  completed: boolean;
  deferUsageSet?: DeferUsageSet | undefined;
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
  perEventExecutor?: Maybe<
    (
      validatedExecutionArgs: ValidatedExecutionArgs,
    ) => PromiseOrValue<ExecutionResult>
  >;
  enableEarlyExecution?: Maybe<boolean>;
  hideSuggestions?: Maybe<boolean>;
  abortSignal?: Maybe<AbortSignal>;
}

export interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldDetailsList: FieldDetailsList;
}

interface GraphQLWrappedResult<T> {
  rawResult: T;
  incrementalDataRecords: Array<IncrementalDataRecord> | undefined;
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
  // Multiple payloads could be encountered if the operation contains @defer or
  // @stream directives and is not validated prior to execution
  return ensureSinglePayload(result);
}

function ensureSinglePayload(
  result: PromiseOrValue<
    ExecutionResult | ExperimentalIncrementalExecutionResults
  >,
): PromiseOrValue<ExecutionResult> {
  if (isPromise(result)) {
    return result.then((resolved) => {
      if ('initialResult' in resolved) {
        throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
      }
      return resolved;
    });
  }
  if ('initialResult' in result) {
    throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
  }
  return result;
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
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return experimentalExecuteQueryOrMutationOrSubscriptionEvent(
    validatedExecutionArgs,
  );
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
export function executeQueryOrMutationOrSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  const result = experimentalExecuteQueryOrMutationOrSubscriptionEvent(
    validatedExecutionArgs,
  );
  return ensureSinglePayload(result);
}

function errorPropagation(operation: OperationDefinitionNode): boolean {
  const directiveNode = operation.directives?.find(
    (directive) =>
      directive.name.value === GraphQLDisableErrorPropagationDirective.name,
  );

  return directiveNode === undefined;
}

export function experimentalExecuteQueryOrMutationOrSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  const abortSignal = validatedExecutionArgs.abortSignal;
  const exeContext: ExecutionContext = {
    validatedExecutionArgs,
    errors: undefined,
    abortSignalListener: abortSignal
      ? new AbortSignalListener(abortSignal)
      : undefined,
    completed: false,
    cancellableStreams: undefined,
    errorPropagation: errorPropagation(validatedExecutionArgs.operation),
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

    const { groupedFieldSet, newDeferUsages } = collectFields(
      schema,
      fragments,
      variableValues,
      rootType,
      selectionSet,
      hideSuggestions,
    );

    const graphqlWrappedResult = executeRootExecutionPlan(
      exeContext,
      operation.operation,
      rootType,
      rootValue,
      groupedFieldSet,
      newDeferUsages,
    );

    if (isPromise(graphqlWrappedResult)) {
      return graphqlWrappedResult.then(
        (resolved) => {
          exeContext.completed = true;
          return buildDataResponse(exeContext, resolved);
        },
        (error: unknown) => {
          exeContext.completed = true;
          exeContext.abortSignalListener?.disconnect();
          return {
            data: null,
            errors: withError(exeContext.errors, error as GraphQLError),
          };
        },
      );
    }
    exeContext.completed = true;
    return buildDataResponse(exeContext, graphqlWrappedResult);
  } catch (error) {
    exeContext.completed = true;
    // TODO: add test case for synchronous null bubbling to root with cancellation
    /* c8 ignore next */
    exeContext.abortSignalListener?.disconnect();
    return { data: null, errors: withError(exeContext.errors, error) };
  }
}

function withError(
  errors: Array<GraphQLError> | undefined,
  error: GraphQLError,
): ReadonlyArray<GraphQLError> {
  return errors === undefined ? [error] : [...errors, error];
}

function buildDataResponse(
  exeContext: ExecutionContext,
  graphqlWrappedResult: GraphQLWrappedResult<ObjMap<unknown>>,
): ExecutionResult | ExperimentalIncrementalExecutionResults {
  const { rawResult: data, incrementalDataRecords } = graphqlWrappedResult;
  const errors = exeContext.errors;
  if (incrementalDataRecords === undefined) {
    exeContext.abortSignalListener?.disconnect();
    return errors !== undefined ? { errors, data } : { data };
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
export function validateExecutionArgs(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ValidatedExecutionArgs {
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
    perEventExecutor,
    enableEarlyExecution,
    abortSignal,
  } = args;

  if (abortSignal?.aborted) {
    return [locatedError(abortSignal.reason, undefined)];
  }

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  let operation: OperationDefinitionNode | undefined;
  const fragmentDefinitions: ObjMap<FragmentDefinitionNode> =
    Object.create(null);
  const fragments: ObjMap<FragmentDetails> = Object.create(null);
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
      case Kind.FRAGMENT_DEFINITION: {
        fragmentDefinitions[definition.name.value] = definition;
        let variableSignatures;
        if (definition.variableDefinitions) {
          variableSignatures = Object.create(null);
          for (const varDef of definition.variableDefinitions) {
            const signature = getVariableSignature(schema, varDef);
            variableSignatures[signature.name] = signature;
          }
        }
        fragments[definition.name.value] = { definition, variableSignatures };
        break;
      }
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

  const variableDefinitions = operation.variableDefinitions ?? [];
  const hideSuggestions = args.hideSuggestions ?? false;

  const variableValuesOrErrors = getVariableValues(
    schema,
    variableDefinitions,
    rawVariableValues ?? {},
    {
      maxErrors: 50,
      hideSuggestions,
    },
  );

  if (variableValuesOrErrors.errors) {
    return variableValuesOrErrors.errors;
  }

  return {
    schema,
    fragmentDefinitions,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: variableValuesOrErrors.variableValues,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    perEventExecutor: perEventExecutor ?? executeSubscriptionEvent,
    enableEarlyExecution: enableEarlyExecution === true,
    hideSuggestions,
    abortSignal: args.abortSignal ?? undefined,
  };
}

function executeRootExecutionPlan(
  exeContext: ExecutionContext,
  operation: OperationTypeNode,
  rootType: GraphQLObjectType,
  rootValue: unknown,
  originalGroupedFieldSet: GroupedFieldSet,
  newDeferUsages: ReadonlyArray<DeferUsage>,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  if (newDeferUsages.length === 0) {
    return executeRootGroupedFieldSet(
      exeContext,
      operation,
      rootType,
      rootValue,
      originalGroupedFieldSet,
      undefined,
    );
  }
  const newDeferMap = getNewDeferMap(newDeferUsages, undefined, undefined);

  const { groupedFieldSet, newGroupedFieldSets } = buildExecutionPlan(
    originalGroupedFieldSet,
  );

  const graphqlWrappedResult = executeRootGroupedFieldSet(
    exeContext,
    operation,
    rootType,
    rootValue,
    groupedFieldSet,
    newDeferMap,
  );

  if (newGroupedFieldSets.size > 0) {
    const newPendingExecutionGroups = collectExecutionGroups(
      exeContext,
      rootType,
      rootValue,
      undefined,
      undefined,
      newGroupedFieldSets,
      newDeferMap,
    );

    return withNewExecutionGroups(
      graphqlWrappedResult,
      newPendingExecutionGroups,
    );
  }
  return graphqlWrappedResult;
}

function withNewExecutionGroups(
  result: PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>>,
  newPendingExecutionGroups: ReadonlyArray<PendingExecutionGroup>,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  if (isPromise(result)) {
    return result.then((resolved) => {
      addIncrementalDataRecords(resolved, newPendingExecutionGroups);
      return resolved;
    });
  }

  addIncrementalDataRecords(result, newPendingExecutionGroups);
  return result;
}

function executeRootGroupedFieldSet(
  exeContext: ExecutionContext,
  operation: OperationTypeNode,
  rootType: GraphQLObjectType,
  rootValue: unknown,
  groupedFieldSet: GroupedFieldSet,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  switch (operation) {
    case OperationTypeNode.QUERY:
      return executeFields(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        undefined,
        deferMap,
      );
    case OperationTypeNode.MUTATION:
      return executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        undefined,
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
        undefined,
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  const abortSignal = exeContext.validatedExecutionArgs.abortSignal;
  return promiseReduce(
    groupedFieldSet,
    (graphqlWrappedResult, [responseName, fieldDetailsList]) => {
      const fieldPath = addPath(path, responseName, parentType.name);

      if (abortSignal?.aborted) {
        handleFieldError(
          abortSignal.reason,
          exeContext,
          parentType,
          fieldDetailsList,
          fieldPath,
          incrementalContext,
        );
        graphqlWrappedResult.rawResult[responseName] = null;
        return graphqlWrappedResult;
      }

      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldDetailsList,
        fieldPath,
        incrementalContext,
        deferMap,
      );
      if (result === undefined) {
        return graphqlWrappedResult;
      }
      if (isPromise(result)) {
        return result.then((resolved) => {
          graphqlWrappedResult.rawResult[responseName] = resolved.rawResult;
          addIncrementalDataRecords(
            graphqlWrappedResult,
            resolved.incrementalDataRecords,
          );
          return graphqlWrappedResult;
        });
      }
      graphqlWrappedResult.rawResult[responseName] = result.rawResult;
      addIncrementalDataRecords(
        graphqlWrappedResult,
        result.incrementalDataRecords,
      );
      return graphqlWrappedResult;
    },
    {
      rawResult: Object.create(null),
      incrementalDataRecords: undefined,
    },
  );
}

function addIncrementalDataRecords(
  graphqlWrappedResult: GraphQLWrappedResult<unknown>,
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord> | undefined,
): void {
  if (incrementalDataRecords === undefined) {
    return;
  }
  if (graphqlWrappedResult.incrementalDataRecords === undefined) {
    graphqlWrappedResult.incrementalDataRecords = [...incrementalDataRecords];
  } else {
    graphqlWrappedResult.incrementalDataRecords.push(...incrementalDataRecords);
  }
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  const results = Object.create(null);
  const graphqlWrappedResult: GraphQLWrappedResult<ObjMap<unknown>> = {
    rawResult: results,
    incrementalDataRecords: undefined,
  };
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
        incrementalContext,
        deferMap,
      );

      if (result !== undefined) {
        if (isPromise(result)) {
          results[responseName] = result.then((resolved) => {
            addIncrementalDataRecords(
              graphqlWrappedResult,
              resolved.incrementalDataRecords,
            );
            return resolved.rawResult;
          });
          containsPromise = true;
        } else {
          results[responseName] = result.rawResult;
          addIncrementalDataRecords(
            graphqlWrappedResult,
            result.incrementalDataRecords,
          );
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
    return graphqlWrappedResult;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results, (resolved) => ({
    rawResult: resolved,
    incrementalDataRecords: graphqlWrappedResult.incrementalDataRecords,
  }));
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<unknown>> | undefined {
  const { validatedExecutionArgs, abortSignalListener } = exeContext;
  const { schema, contextValue, variableValues, hideSuggestions, abortSignal } =
    validatedExecutionArgs;
  const fieldName = fieldDetailsList[0].node.name.value;
  const fieldDef = schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? validatedExecutionArgs.fieldResolver;

  const info = buildResolveInfo(
    validatedExecutionArgs,
    fieldDef,
    toNodes(fieldDetailsList),
    parentType,
    path,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = experimentalGetArgumentValues(
      fieldDetailsList[0].node,
      fieldDef.args,
      variableValues,
      fieldDetailsList[0].fragmentVariableValues,
      hideSuggestions,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const result = resolveFn(source, args, contextValue, info, abortSignal);

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
        incrementalContext,
        deferMap,
      );
    }

    const completed = completeValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
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
          incrementalContext,
        );
        return { rawResult: null, incrementalDataRecords: undefined };
      });
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldDetailsList,
      path,
      incrementalContext,
    );
    return { rawResult: null, incrementalDataRecords: undefined };
  }
}

/**
 * TODO: consider no longer exporting this function
 * @internal
 */
export function buildResolveInfo(
  validatedExecutionArgs: ValidatedExecutionArgs,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNodes: ReadonlyArray<FieldNode>,
  parentType: GraphQLObjectType,
  path: Path,
): GraphQLResolveInfo {
  const { schema, fragmentDefinitions, rootValue, operation, variableValues } =
    validatedExecutionArgs;
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldNodes,
    returnType: fieldDef.type,
    parentType,
    path,
    schema,
    fragments: fragmentDefinitions,
    rootValue,
    operation,
    variableValues,
  };
}

function handleFieldError(
  rawError: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  path: Path,
  incrementalContext: IncrementalContext | undefined,
): void {
  const error = locatedError(
    rawError,
    toNodes(fieldDetailsList),
    pathToArray(path),
  );

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (exeContext.errorPropagation && isNonNullType(returnType)) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  const context = incrementalContext ?? exeContext;
  let errors = context.errors;
  if (errors === undefined) {
    errors = [];
    context.errors = errors;
  }
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<unknown>> {
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
      incrementalContext,
      deferMap,
    );
    if ((completed as GraphQLWrappedResult<unknown>).rawResult === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType}.${info.fieldName}.`,
      );
    }
    return completed;
  }

  // If result value is null or undefined then return null.
  if (result == null) {
    return { rawResult: null, incrementalDataRecords: undefined };
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
      incrementalContext,
      deferMap,
    );
  }

  // If field type is a leaf type, Scalar or Enum, coerce to a valid value,
  // returning null if coercion is not possible.
  if (isLeafType(returnType)) {
    return {
      rawResult: completeLeafValue(returnType, result),
      incrementalDataRecords: undefined,
    };
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
      incrementalContext,
      deferMap,
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
      incrementalContext,
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
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  result: Promise<unknown>,
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): Promise<GraphQLWrappedResult<unknown>> {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnType,
      fieldDetailsList,
      info,
      path,
      resolved,
      incrementalContext,
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
      fieldDetailsList,
      path,
      incrementalContext,
    );
    return { rawResult: null, incrementalDataRecords: undefined };
  }
}

/**
 * Returns an object containing info for streaming if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamUsage(
  validatedExecutionArgs: ValidatedExecutionArgs,
  fieldDetailsList: FieldDetailsList,
  path: Path,
): StreamUsage | undefined {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }

  // TODO: add test for this case (a streamed list nested under a list).
  /* c8 ignore next 7 */
  if (
    (fieldDetailsList as unknown as { _streamUsage: StreamUsage })
      ._streamUsage !== undefined
  ) {
    return (fieldDetailsList as unknown as { _streamUsage: StreamUsage })
      ._streamUsage;
  }

  const { operation, variableValues } = validatedExecutionArgs;
  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    fieldDetailsList[0].node,
    variableValues,
    fieldDetailsList[0].fragmentVariableValues,
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
    operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
  );

  const streamedFieldDetailsList: FieldDetailsList = fieldDetailsList.map(
    (fieldDetails) => ({
      node: fieldDetails.node,
      deferUsage: undefined,
      fragmentVariableValues: fieldDetails.fragmentVariableValues,
    }),
  );

  const streamUsage = {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
    fieldDetailsList: streamedFieldDetailsList,
  };

  (fieldDetailsList as unknown as { _streamUsage: StreamUsage })._streamUsage =
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
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  asyncIterator: AsyncIterator<unknown>,
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): Promise<GraphQLWrappedResult<ReadonlyArray<unknown>>> {
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  const graphqlWrappedResult: GraphQLWrappedResult<Array<unknown>> = {
    rawResult: completedResults,
    incrementalDataRecords: undefined,
  };
  let index = 0;
  const streamUsage = getStreamUsage(
    exeContext.validatedExecutionArgs,
    fieldDetailsList,
    path,
  );
  const earlyReturn =
    asyncIterator.return === undefined
      ? undefined
      : asyncIterator.return.bind(asyncIterator);
  try {
    while (true) {
      if (streamUsage && index >= streamUsage.initialCount) {
        const streamItemQueue = buildAsyncStreamItemQueue(
          index,
          path,
          asyncIterator,
          exeContext,
          streamUsage.fieldDetailsList,
          info,
          itemType,
        );

        let streamRecord: StreamRecord | CancellableStreamRecord;
        if (earlyReturn === undefined) {
          streamRecord = {
            label: streamUsage.label,
            path,
            streamItemQueue,
          };
        } else {
          streamRecord = {
            label: streamUsage.label,
            path,
            earlyReturn,
            streamItemQueue,
          };
          if (exeContext.cancellableStreams === undefined) {
            exeContext.cancellableStreams = new Set();
          }
          exeContext.cancellableStreams.add(streamRecord);
        }

        addIncrementalDataRecords(graphqlWrappedResult, [streamRecord]);
        break;
      }

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
            graphqlWrappedResult,
            exeContext,
            itemType,
            fieldDetailsList,
            info,
            itemPath,
            incrementalContext,
            deferMap,
          ),
        );
        containsPromise = true;
      } else if (
        /* c8 ignore stop */
        completeListItemValue(
          item,
          completedResults,
          graphqlWrappedResult,
          exeContext,
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          incrementalContext,
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
  } catch (error) {
    if (earlyReturn !== undefined) {
      earlyReturn().catch(() => {
        /* c8 ignore next 1 */
        // ignore error
      });
    }
    throw error;
  }

  return containsPromise
    ? /* c8 ignore start */ Promise.all(completedResults).then((resolved) => ({
        rawResult: resolved,
        incrementalDataRecords: graphqlWrappedResult.incrementalDataRecords,
      }))
    : /* c8 ignore stop */ graphqlWrappedResult;
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ReadonlyArray<unknown>>> {
  const itemType = returnType.ofType;

  if (isAsyncIterable(result)) {
    const abortSignalListener = exeContext.abortSignalListener;
    const maybeCancellableIterable = abortSignalListener
      ? cancellableIterable(result, abortSignalListener)
      : result;
    const asyncIterator = maybeCancellableIterable[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldDetailsList,
      info,
      path,
      asyncIterator,
      incrementalContext,
      deferMap,
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
    incrementalContext,
    deferMap,
  );
}

function completeIterableValue(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  path: Path,
  items: Iterable<unknown>,
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ReadonlyArray<unknown>>> {
  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  const graphqlWrappedResult: GraphQLWrappedResult<Array<unknown>> = {
    rawResult: completedResults,
    incrementalDataRecords: undefined,
  };
  let index = 0;
  const streamUsage = getStreamUsage(
    exeContext.validatedExecutionArgs,
    fieldDetailsList,
    path,
  );
  const iterator = items[Symbol.iterator]();
  let iteration = iterator.next();
  while (!iteration.done) {
    const item = iteration.value;

    if (streamUsage && index >= streamUsage.initialCount) {
      const syncStreamRecord: StreamRecord = {
        label: streamUsage.label,
        path,
        streamItemQueue: buildSyncStreamItemQueue(
          item,
          index,
          path,
          iterator,
          exeContext,
          streamUsage.fieldDetailsList,
          info,
          itemType,
        ),
      };

      addIncrementalDataRecords(graphqlWrappedResult, [syncStreamRecord]);
      break;
    }

    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);

    if (isPromise(item)) {
      completedResults.push(
        completePromisedListItemValue(
          item,
          graphqlWrappedResult,
          exeContext,
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          incrementalContext,
          deferMap,
        ),
      );
      containsPromise = true;
    } else if (
      completeListItemValue(
        item,
        completedResults,
        graphqlWrappedResult,
        exeContext,
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        incrementalContext,
        deferMap,
      )
    ) {
      containsPromise = true;
    }
    index++;

    iteration = iterator.next();
  }

  return containsPromise
    ? Promise.all(completedResults).then((resolved) => ({
        rawResult: resolved,
        incrementalDataRecords: graphqlWrappedResult.incrementalDataRecords,
      }))
    : graphqlWrappedResult;
}

/**
 * Complete a list item value by adding it to the completed results.
 *
 * Returns true if the value is a Promise.
 */
function completeListItemValue(
  item: unknown,
  completedResults: Array<unknown>,
  parent: GraphQLWrappedResult<Array<unknown>>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemPath: Path,
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): boolean {
  try {
    const completedItem = completeValue(
      exeContext,
      itemType,
      fieldDetailsList,
      info,
      itemPath,
      item,
      incrementalContext,
      deferMap,
    );

    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(
          (resolved) => {
            addIncrementalDataRecords(parent, resolved.incrementalDataRecords);
            return resolved.rawResult;
          },
          (rawError: unknown) => {
            handleFieldError(
              rawError,
              exeContext,
              itemType,
              fieldDetailsList,
              itemPath,
              incrementalContext,
            );
            return null;
          },
        ),
      );
      return true;
    }

    completedResults.push(completedItem.rawResult);
    addIncrementalDataRecords(parent, completedItem.incrementalDataRecords);
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldDetailsList,
      itemPath,
      incrementalContext,
    );
    completedResults.push(null);
  }
  return false;
}

async function completePromisedListItemValue(
  item: Promise<unknown>,
  parent: GraphQLWrappedResult<Array<unknown>>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemPath: Path,
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
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
      incrementalContext,
      deferMap,
    );
    if (isPromise(completed)) {
      completed = await completed;
    }
    addIncrementalDataRecords(parent, completed.incrementalDataRecords);
    return completed.rawResult;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldDetailsList,
      itemPath,
      incrementalContext,
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
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
        incrementalContext,
        deferMap,
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
    incrementalContext,
    deferMap,
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
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  if ((incrementalContext ?? exeContext).completed) {
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
          incrementalContext,
          deferMap,
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
    incrementalContext,
    deferMap,
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

/**
 * Instantiates new DeferredFragmentRecords for the given path within an
 * incremental data record, returning an updated map of DeferUsage
 * objects to DeferredFragmentRecords.
 *
 * Note: As defer directives may be used with operations returning lists,
 * a DeferUsage object may correspond to many DeferredFragmentRecords.
 */
function getNewDeferMap(
  newDeferUsages: ReadonlyArray<DeferUsage>,
  deferMap?: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  path?: Path,
): ReadonlyMap<DeferUsage, DeferredFragmentRecord> {
  const newDeferMap = new Map(deferMap);

  // For each new deferUsage object:
  for (const newDeferUsage of newDeferUsages) {
    const parentDeferUsage = newDeferUsage.parentDeferUsage;

    const parent =
      parentDeferUsage === undefined
        ? undefined
        : deferredFragmentRecordFromDeferUsage(parentDeferUsage, newDeferMap);

    // Instantiate the new record.
    const deferredFragmentRecord = new DeferredFragmentRecord(
      path,
      newDeferUsage.label,
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

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  path: Path,
  result: unknown,
  incrementalContext: IncrementalContext | undefined,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  const validatedExecutionArgs = exeContext.validatedExecutionArgs;

  // Collect sub-fields to execute to complete this value.
  const collectedSubfields = collectSubfields(
    validatedExecutionArgs,
    returnType,
    fieldDetailsList,
  );
  const { groupedFieldSet, newDeferUsages } = collectedSubfields;

  if (newDeferUsages.length > 0) {
    invariant(
      validatedExecutionArgs.operation.operation !==
        OperationTypeNode.SUBSCRIPTION,
      '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
    );
  }

  return executeSubExecutionPlan(
    exeContext,
    returnType,
    result,
    groupedFieldSet,
    newDeferUsages,
    path,
    incrementalContext,
    deferMap,
  );
}

function executeSubExecutionPlan(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  sourceValue: unknown,
  originalGroupedFieldSet: GroupedFieldSet,
  newDeferUsages: ReadonlyArray<DeferUsage>,
  path?: Path,
  incrementalContext?: IncrementalContext,
  deferMap?: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
  if (deferMap === undefined && newDeferUsages.length === 0) {
    return executeFields(
      exeContext,
      returnType,
      sourceValue,
      path,
      originalGroupedFieldSet,
      incrementalContext,
      deferMap,
    );
  }

  const newDeferMap = getNewDeferMap(newDeferUsages, deferMap, path);

  const { groupedFieldSet, newGroupedFieldSets } = buildSubExecutionPlan(
    originalGroupedFieldSet,
    incrementalContext?.deferUsageSet,
  );

  const graphqlWrappedResult = executeFields(
    exeContext,
    returnType,
    sourceValue,
    path,
    groupedFieldSet,
    incrementalContext,
    newDeferMap,
  );

  if (newGroupedFieldSets.size > 0) {
    const newPendingExecutionGroups = collectExecutionGroups(
      exeContext,
      returnType,
      sourceValue,
      path,
      incrementalContext?.deferUsageSet,
      newGroupedFieldSets,
      newDeferMap,
    );

    return withNewExecutionGroups(
      graphqlWrappedResult,
      newPendingExecutionGroups,
    );
  }
  return graphqlWrappedResult;
}

function buildSubExecutionPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  deferUsageSet: DeferUsageSet | undefined,
): ExecutionPlan {
  let executionPlan = (
    originalGroupedFieldSet as unknown as { _executionPlan: ExecutionPlan }
  )._executionPlan;
  if (executionPlan !== undefined) {
    return executionPlan;
  }
  executionPlan = buildExecutionPlan(originalGroupedFieldSet, deferUsageSet);
  (
    originalGroupedFieldSet as unknown as { _executionPlan: ExecutionPlan }
  )._executionPlan = executionPlan;
  return executionPlan;
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
          if (promisedIsTypeOfResults.length > 0) {
            Promise.all(promisedIsTypeOfResults).then(undefined, () => {
              /* ignore errors */
            });
          }

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
  function (source: any, args, contextValue, info, abortSignal) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return source[info.fieldName](args, contextValue, info, abortSignal);
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
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  const resultOrStream = createSourceEventStreamImpl(validatedExecutionArgs);

  if (isPromise(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      mapSourceToResponse(validatedExecutionArgs, resolvedResultOrStream),
    );
  }

  return mapSourceToResponse(validatedExecutionArgs, resultOrStream);
}

function mapSourceToResponse(
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
  return mapAsyncIterable(
    abortSignalListener
      ? cancellableIterable(resultOrStream, abortSignalListener)
      : resultOrStream,
    (payload: unknown) => {
      const perEventExecutionArgs: ValidatedExecutionArgs = {
        ...validatedExecutionArgs,
        rootValue: payload,
      };
      return validatedExecutionArgs.perEventExecutor(perEventExecutionArgs);
    },
    () => abortSignalListener?.disconnect(),
  );
}

export function executeSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  return executeQueryOrMutationOrSubscriptionEvent(validatedExecutionArgs);
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
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return createSourceEventStreamImpl(validatedExecutionArgs);
}

function createSourceEventStreamImpl(
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
    validatedExecutionArgs,
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
    const args = getArgumentValues(
      fieldDef,
      fieldNodes[0],
      variableValues,
      hideSuggestions,
    );

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const resolveFn =
      fieldDef.subscribe ?? validatedExecutionArgs.subscribeFieldResolver;

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const result = resolveFn(rootValue, args, contextValue, info, abortSignal);

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
          throw locatedError(error, fieldNodes, pathToArray(path));
        },
      );
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

function collectExecutionGroups(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  parentDeferUsages: DeferUsageSet | undefined,
  newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): ReadonlyArray<PendingExecutionGroup> {
  const newPendingExecutionGroups: Array<PendingExecutionGroup> = [];

  for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
    const deferredFragmentRecords = getDeferredFragmentRecords(
      deferUsageSet,
      deferMap,
    );

    const pendingExecutionGroup: PendingExecutionGroup = {
      deferredFragmentRecords,
      result:
        undefined as unknown as BoxedPromiseOrValue<CompletedExecutionGroup>,
    };

    const executor = () =>
      executeExecutionGroup(
        pendingExecutionGroup,
        exeContext,
        parentType,
        sourceValue,
        path,
        groupedFieldSet,
        {
          errors: undefined,
          completed: false,
          deferUsageSet,
        },
        deferMap,
      );

    if (exeContext.validatedExecutionArgs.enableEarlyExecution) {
      pendingExecutionGroup.result = new BoxedPromiseOrValue(
        shouldDefer(parentDeferUsages, deferUsageSet)
          ? Promise.resolve().then(executor)
          : executor(),
      );
    } else {
      pendingExecutionGroup.result = () => new BoxedPromiseOrValue(executor());
    }

    newPendingExecutionGroups.push(pendingExecutionGroup);
  }

  return newPendingExecutionGroups;
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

function executeExecutionGroup(
  pendingExecutionGroup: PendingExecutionGroup,
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
  incrementalContext: IncrementalContext,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<CompletedExecutionGroup> {
  let result;
  try {
    result = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      groupedFieldSet,
      incrementalContext,
      deferMap,
    );
  } catch (error) {
    incrementalContext.completed = true;
    return {
      pendingExecutionGroup,
      path: pathToArray(path),
      errors: withError(incrementalContext.errors, error),
    };
  }

  if (isPromise(result)) {
    return result.then(
      (resolved) => {
        incrementalContext.completed = true;
        return buildCompletedExecutionGroup(
          incrementalContext.errors,
          pendingExecutionGroup,
          path,
          resolved,
        );
      },
      (error: unknown) => {
        incrementalContext.completed = true;
        return {
          pendingExecutionGroup,
          path: pathToArray(path),
          errors: withError(incrementalContext.errors, error as GraphQLError),
        };
      },
    );
  }

  incrementalContext.completed = true;
  return buildCompletedExecutionGroup(
    incrementalContext.errors,
    pendingExecutionGroup,
    path,
    result,
  );
}

function buildCompletedExecutionGroup(
  errors: ReadonlyArray<GraphQLError> | undefined,
  pendingExecutionGroup: PendingExecutionGroup,
  path: Path | undefined,
  result: GraphQLWrappedResult<ObjMap<unknown>>,
): CompletedExecutionGroup {
  const { rawResult: data, incrementalDataRecords } = result;
  return {
    pendingExecutionGroup,
    path: pathToArray(path),
    result: errors === undefined ? { data } : { data, errors },
    incrementalDataRecords,
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

function buildSyncStreamItemQueue(
  initialItem: PromiseOrValue<unknown>,
  initialIndex: number,
  streamPath: Path,
  iterator: Iterator<unknown>,
  exeContext: ExecutionContext,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
): Array<StreamItemRecord> {
  const streamItemQueue: Array<StreamItemRecord> = [];

  const enableEarlyExecution =
    exeContext.validatedExecutionArgs.enableEarlyExecution;

  const firstExecutor = () => {
    const initialPath = addPath(streamPath, initialIndex, undefined);
    const firstStreamItem = new BoxedPromiseOrValue(
      completeStreamItem(
        initialPath,
        initialItem,
        exeContext,
        { errors: undefined, completed: false },
        fieldDetailsList,
        info,
        itemType,
      ),
    );

    let iteration = iterator.next();
    let currentIndex = initialIndex + 1;
    let currentStreamItem:
      | BoxedPromiseOrValue<StreamItemResult>
      | (() => BoxedPromiseOrValue<StreamItemResult>) = firstStreamItem;
    while (!iteration.done) {
      // TODO: add test case for early sync termination
      /* c8 ignore next 6 */
      if (currentStreamItem instanceof BoxedPromiseOrValue) {
        const result = currentStreamItem.value;
        if (!isPromise(result) && result.errors !== undefined) {
          break;
        }
      }

      const itemPath = addPath(streamPath, currentIndex, undefined);

      const value = iteration.value;

      const currentExecutor = () =>
        completeStreamItem(
          itemPath,
          value,
          exeContext,
          { errors: undefined, completed: false },
          fieldDetailsList,
          info,
          itemType,
        );

      currentStreamItem = enableEarlyExecution
        ? new BoxedPromiseOrValue(currentExecutor())
        : () => new BoxedPromiseOrValue(currentExecutor());

      streamItemQueue.push(currentStreamItem);

      iteration = iterator.next();
      currentIndex = initialIndex + 1;
    }

    streamItemQueue.push(new BoxedPromiseOrValue({}));

    return firstStreamItem.value;
  };

  streamItemQueue.push(
    enableEarlyExecution
      ? new BoxedPromiseOrValue(Promise.resolve().then(firstExecutor))
      : () => new BoxedPromiseOrValue(firstExecutor()),
  );

  return streamItemQueue;
}

function buildAsyncStreamItemQueue(
  initialIndex: number,
  streamPath: Path,
  asyncIterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
): Array<StreamItemRecord> {
  const streamItemQueue: Array<StreamItemRecord> = [];
  const executor = () =>
    getNextAsyncStreamItemResult(
      streamItemQueue,
      streamPath,
      initialIndex,
      asyncIterator,
      exeContext,
      fieldDetailsList,
      info,
      itemType,
    );

  streamItemQueue.push(
    exeContext.validatedExecutionArgs.enableEarlyExecution
      ? new BoxedPromiseOrValue(executor())
      : () => new BoxedPromiseOrValue(executor()),
  );

  return streamItemQueue;
}

async function getNextAsyncStreamItemResult(
  streamItemQueue: Array<StreamItemRecord>,
  streamPath: Path,
  index: number,
  asyncIterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
): Promise<StreamItemResult> {
  let iteration;
  try {
    iteration = await asyncIterator.next();
  } catch (error) {
    return {
      errors: [
        locatedError(error, toNodes(fieldDetailsList), pathToArray(streamPath)),
      ],
    };
  }

  if (iteration.done) {
    return {};
  }

  const itemPath = addPath(streamPath, index, undefined);

  const result = completeStreamItem(
    itemPath,
    iteration.value,
    exeContext,
    { errors: undefined, completed: false },
    fieldDetailsList,
    info,
    itemType,
  );

  const executor = () =>
    getNextAsyncStreamItemResult(
      streamItemQueue,
      streamPath,
      index + 1,
      asyncIterator,
      exeContext,
      fieldDetailsList,
      info,
      itemType,
    );

  streamItemQueue.push(
    exeContext.validatedExecutionArgs.enableEarlyExecution
      ? new BoxedPromiseOrValue(executor())
      : () => new BoxedPromiseOrValue(executor()),
  );

  return result;
}

function completeStreamItem(
  itemPath: Path,
  item: unknown,
  exeContext: ExecutionContext,
  incrementalContext: IncrementalContext,
  fieldDetailsList: FieldDetailsList,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
): PromiseOrValue<StreamItemResult> {
  if (isPromise(item)) {
    const abortSignalListener = exeContext.abortSignalListener;
    const maybeCancellableItem = abortSignalListener
      ? cancellablePromise(item, abortSignalListener)
      : item;
    return completePromisedValue(
      exeContext,
      itemType,
      fieldDetailsList,
      info,
      itemPath,
      maybeCancellableItem,
      incrementalContext,
      new Map(),
    ).then(
      (resolvedItem) => {
        incrementalContext.completed = true;
        return buildStreamItemResult(incrementalContext.errors, resolvedItem);
      },
      (error: unknown) => {
        incrementalContext.completed = true;
        return {
          errors: withError(incrementalContext.errors, error as GraphQLError),
        };
      },
    );
  }

  let result: PromiseOrValue<GraphQLWrappedResult<unknown>>;
  try {
    try {
      result = completeValue(
        exeContext,
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        item,
        incrementalContext,
        new Map(),
      );
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldDetailsList,
        itemPath,
        incrementalContext,
      );
      result = { rawResult: null, incrementalDataRecords: undefined };
    }
  } catch (error) {
    incrementalContext.completed = true;
    return {
      errors: withError(incrementalContext.errors, error),
    };
  }

  if (isPromise(result)) {
    return result
      .then(undefined, (rawError: unknown) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldDetailsList,
          itemPath,
          incrementalContext,
        );
        return { rawResult: null, incrementalDataRecords: undefined };
      })
      .then(
        (resolvedItem) => {
          incrementalContext.completed = true;
          return buildStreamItemResult(incrementalContext.errors, resolvedItem);
        },
        (error: unknown) => {
          incrementalContext.completed = true;
          return {
            errors: withError(incrementalContext.errors, error as GraphQLError),
          };
        },
      );
  }

  incrementalContext.completed = true;
  return buildStreamItemResult(incrementalContext.errors, result);
}

function buildStreamItemResult(
  errors: ReadonlyArray<GraphQLError> | undefined,
  result: GraphQLWrappedResult<unknown>,
): StreamItemResult {
  const { rawResult: item, incrementalDataRecords } = result;
  return {
    item,
    errors,
    incrementalDataRecords,
  };
}
