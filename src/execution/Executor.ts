import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isPromise } from '../jsutils/isPromise.js';
import { memoize2 } from '../jsutils/memoize2.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import { promiseForObject } from '../jsutils/promiseForObject.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { promiseReduce } from '../jsutils/promiseReduce.js';

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
import { GraphQLStreamDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import {
  AbortSignalListener,
  cancellableIterable,
  cancellablePromise,
} from './AbortSignalListener.js';
import type { DeferUsageSet, ExecutionPlan } from './buildExecutionPlan.js';
import { buildResolveInfo } from './buildResolveInfo.js';
import type {
  DeferUsage,
  FieldDetailsList,
  FragmentDetails,
  GroupedFieldSet,
} from './collectFields.js';
import { collectFields, collectSubfields } from './collectFields.js';
import type { ExperimentalIncrementalExecutionResults } from './IncrementalPublisher.js';
import { buildIncrementalResponse } from './IncrementalPublisher.js';
import type { PayloadPublisher } from './PayloadPublisher.js';
import type {
  CancellableStreamRecord,
  CompletedExecutionGroup,
  ExecutionResult,
  IncrementalDataRecord,
  InitialIncrementalExecutionResult,
  PendingExecutionGroup,
  StreamItemRecord,
  StreamItemResult,
  StreamRecord,
  SubsequentIncrementalExecutionResult,
} from './types.js';
import { DeferredFragmentRecord } from './types.js';
import type { VariableValues } from './values.js';
import { experimentalGetArgumentValues, getDirectiveValues } from './values.js';

/* eslint-disable @typescript-eslint/max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

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
  errors: Array<GraphQLError> | undefined;
  abortSignalListener: AbortSignalListener | undefined;
  completed: boolean;
  cancellableStreams: Set<CancellableStreamRecord> | undefined;
}

interface IncrementalContext {
  errors: Array<GraphQLError> | undefined;
  completed: boolean;
  deferUsageSet?: DeferUsageSet | undefined;
}

interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldDetailsList: FieldDetailsList;
}

interface GraphQLWrappedResult<T> {
  rawResult: T;
  incrementalDataRecords: Array<IncrementalDataRecord> | undefined;
}

/** @internal */
export class Executor<
  TInitialPayload = InitialIncrementalExecutionResult,
  TSubsequentPayload = SubsequentIncrementalExecutionResult,
> {
  validatedExecutionArgs: ValidatedExecutionArgs;

  buildExecutionPlan: (
    originalGroupedFieldSet: GroupedFieldSet,
    parentDeferUsages?: DeferUsageSet | undefined,
  ) => ExecutionPlan;

  getPayloadPublisher: () => PayloadPublisher<
    TInitialPayload,
    TSubsequentPayload
  >;

  exeContext: ExecutionContext;

  /**
   * A memoized collection of relevant subfields with regard to the return
   * type. Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */
  collectSubfields: (
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
  ) => {
    groupedFieldSet: GroupedFieldSet;
    newDeferUsages: ReadonlyArray<DeferUsage>;
  };

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    buildExecutionPlan: (
      originalGroupedFieldSet: GroupedFieldSet,
      parentDeferUsages?: DeferUsageSet | undefined,
    ) => ExecutionPlan,
    getPayloadPublisher: () => PayloadPublisher<
      TInitialPayload,
      TSubsequentPayload
    >,
  ) {
    this.validatedExecutionArgs = validatedExecutionArgs;
    this.buildExecutionPlan = buildExecutionPlan;
    this.getPayloadPublisher = getPayloadPublisher;

    const abortSignal = validatedExecutionArgs.abortSignal;
    this.exeContext = {
      errors: undefined,
      abortSignalListener: abortSignal
        ? new AbortSignalListener(abortSignal)
        : undefined,
      completed: false,
      cancellableStreams: undefined,
    };

    const { schema, fragments, variableValues, hideSuggestions } =
      validatedExecutionArgs;

    this.collectSubfields = memoize2(
      (returnType: GraphQLObjectType, fieldDetailsList: FieldDetailsList) =>
        collectSubfields(
          schema,
          fragments,
          variableValues,
          returnType,
          fieldDetailsList,
          hideSuggestions,
        ),
    );
  }

  executeQueryOrMutationOrSubscriptionEvent(): PromiseOrValue<
    | ExecutionResult
    | ExperimentalIncrementalExecutionResults<
        TInitialPayload,
        TSubsequentPayload
      >
  > {
    try {
      const {
        schema,
        fragments,
        rootValue,
        operation,
        variableValues,
        hideSuggestions,
      } = this.validatedExecutionArgs;

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

      const graphqlWrappedResult = this.executeRootExecutionPlan(
        operation.operation,
        rootType,
        rootValue,
        groupedFieldSet,
        newDeferUsages,
      );

      if (isPromise(graphqlWrappedResult)) {
        return graphqlWrappedResult.then(
          (resolved) => {
            this.exeContext.completed = true;
            return this.buildDataResponse(resolved);
          },
          (error: unknown) => {
            this.exeContext.completed = true;
            this.exeContext.abortSignalListener?.disconnect();
            return {
              data: null,
              errors: this.withError(
                this.exeContext.errors,
                error as GraphQLError,
              ),
            };
          },
        );
      }
      this.exeContext.completed = true;
      return this.buildDataResponse(graphqlWrappedResult);
    } catch (error) {
      this.exeContext.completed = true;
      // TODO: add test case for synchronous null bubbling to root with cancellation
      /* c8 ignore next */
      this.exeContext.abortSignalListener?.disconnect();
      return {
        data: null,
        errors: this.withError(this.exeContext.errors, error),
      };
    }
  }

  withError(
    errors: Array<GraphQLError> | undefined,
    error: GraphQLError,
  ): ReadonlyArray<GraphQLError> {
    return errors === undefined ? [error] : [...errors, error];
  }

  buildDataResponse(
    graphqlWrappedResult: GraphQLWrappedResult<ObjMap<unknown>>,
  ):
    | ExecutionResult
    | ExperimentalIncrementalExecutionResults<
        TInitialPayload,
        TSubsequentPayload
      > {
    const { rawResult: data, incrementalDataRecords } = graphqlWrappedResult;
    const errors = this.exeContext.errors;
    if (incrementalDataRecords === undefined) {
      this.exeContext.abortSignalListener?.disconnect();
      return errors !== undefined ? { errors, data } : { data };
    }

    return this.buildIncrementalResponse(data, errors, incrementalDataRecords);
  }

  buildIncrementalResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ExperimentalIncrementalExecutionResults<
    TInitialPayload,
    TSubsequentPayload
  > {
    return buildIncrementalResponse(
      this.exeContext,
      data,
      errors,
      incrementalDataRecords,
      this.getPayloadPublisher(),
    );
  }

  executeRootExecutionPlan(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    if (newDeferUsages.length === 0) {
      return this.executeRootGroupedFieldSet(
        operation,
        rootType,
        rootValue,
        originalGroupedFieldSet,
        undefined,
      );
    }
    const newDeferMap = this.getNewDeferMap(
      newDeferUsages,
      undefined,
      undefined,
    );

    const { groupedFieldSet, newGroupedFieldSets } = this.buildExecutionPlan(
      originalGroupedFieldSet,
    );

    const graphqlWrappedResult = this.executeRootGroupedFieldSet(
      operation,
      rootType,
      rootValue,
      groupedFieldSet,
      newDeferMap,
    );

    if (newGroupedFieldSets.size > 0) {
      const newPendingExecutionGroups = this.collectExecutionGroups(
        rootType,
        rootValue,
        undefined,
        undefined,
        newGroupedFieldSets,
        newDeferMap,
      );

      return this.withNewExecutionGroups(
        graphqlWrappedResult,
        newPendingExecutionGroups,
      );
    }
    return graphqlWrappedResult;
  }

  withNewExecutionGroups(
    result: PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>>,
    newPendingExecutionGroups: ReadonlyArray<PendingExecutionGroup>,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    if (isPromise(result)) {
      return result.then((resolved) => {
        this.addIncrementalDataRecords(resolved, newPendingExecutionGroups);
        return resolved;
      });
    }

    this.addIncrementalDataRecords(result, newPendingExecutionGroups);
    return result;
  }

  executeRootGroupedFieldSet(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
    groupedFieldSet: GroupedFieldSet,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    switch (operation) {
      case OperationTypeNode.QUERY:
        return this.executeFields(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          undefined,
          deferMap,
        );
      case OperationTypeNode.MUTATION:
        return this.executeFieldsSerially(
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
        return this.executeFields(
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
  executeFieldsSerially(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    const abortSignal = this.validatedExecutionArgs.abortSignal;
    return promiseReduce(
      groupedFieldSet,
      (graphqlWrappedResult, [responseName, fieldDetailsList]) => {
        const fieldPath = addPath(path, responseName, parentType.name);

        if (abortSignal?.aborted) {
          this.handleFieldError(
            abortSignal.reason,
            parentType,
            fieldDetailsList,
            fieldPath,
            incrementalContext,
          );
          graphqlWrappedResult.rawResult[responseName] = null;
          return graphqlWrappedResult;
        }

        const result = this.executeField(
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
            this.addIncrementalDataRecords(
              graphqlWrappedResult,
              resolved.incrementalDataRecords,
            );
            return graphqlWrappedResult;
          });
        }
        graphqlWrappedResult.rawResult[responseName] = result.rawResult;
        this.addIncrementalDataRecords(
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

  addIncrementalDataRecords(
    graphqlWrappedResult: GraphQLWrappedResult<unknown>,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord> | undefined,
  ): void {
    if (incrementalDataRecords === undefined) {
      return;
    }
    if (graphqlWrappedResult.incrementalDataRecords === undefined) {
      graphqlWrappedResult.incrementalDataRecords = [...incrementalDataRecords];
    } else {
      graphqlWrappedResult.incrementalDataRecords.push(
        ...incrementalDataRecords,
      );
    }
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that may be executed in parallel.
   */
  executeFields(
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
        const result = this.executeField(
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
              this.addIncrementalDataRecords(
                graphqlWrappedResult,
                resolved.incrementalDataRecords,
              );
              return resolved.rawResult;
            });
            containsPromise = true;
          } else {
            results[responseName] = result.rawResult;
            this.addIncrementalDataRecords(
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

  toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
  }

  /**
   * Implements the "Executing fields" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * coercing scalars, or execute the sub-selection-set for objects.
   */
  executeField(
    parentType: GraphQLObjectType,
    source: unknown,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<unknown>> | undefined {
    const {
      schema,
      contextValue,
      variableValues,
      hideSuggestions,
      abortSignal,
    } = this.validatedExecutionArgs;
    const fieldName = fieldDetailsList[0].node.name.value;
    const fieldDef = schema.getField(parentType, fieldName);
    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const resolveFn =
      fieldDef.resolve ?? this.validatedExecutionArgs.fieldResolver;

    const info = buildResolveInfo(
      this.validatedExecutionArgs,
      fieldDef,
      this.toNodes(fieldDetailsList),
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
        return this.completePromisedValue(
          returnType,
          fieldDetailsList,
          info,
          path,
          this.exeContext.abortSignalListener
            ? cancellablePromise(result, this.exeContext.abortSignalListener)
            : result,
          incrementalContext,
          deferMap,
        );
      }

      const completed = this.completeValue(
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
          this.handleFieldError(
            rawError,
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
      this.handleFieldError(
        rawError,
        returnType,
        fieldDetailsList,
        path,
        incrementalContext,
      );
      return { rawResult: null, incrementalDataRecords: undefined };
    }
  }

  handleFieldError(
    rawError: unknown,
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    incrementalContext: IncrementalContext | undefined,
  ): void {
    const error = locatedError(
      rawError,
      this.toNodes(fieldDetailsList),
      pathToArray(path),
    );

    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (isNonNullType(returnType)) {
      throw error;
    }

    // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.
    const context = incrementalContext ?? this.exeContext;
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
  completeValue(
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
      const completed = this.completeValue(
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
      return this.completeListValue(
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
        rawResult: this.completeLeafValue(returnType, result),
        incrementalDataRecords: undefined,
      };
    }

    // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.
    if (isAbstractType(returnType)) {
      return this.completeAbstractValue(
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
      return this.completeObjectValue(
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

  async completePromisedValue(
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
      let completed = this.completeValue(
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
      this.handleFieldError(
        rawError,
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
  getStreamUsage(
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

    const { operation, variableValues } = this.validatedExecutionArgs;
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

    (
      fieldDetailsList as unknown as { _streamUsage: StreamUsage }
    )._streamUsage = streamUsage;

    return streamUsage;
  }

  /**
   * Complete a async iterator value by completing the result and calling
   * recursively until all the results are completed.
   */
  async completeAsyncIteratorValue(
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
    const streamUsage = this.getStreamUsage(fieldDetailsList, path);
    const earlyReturn =
      asyncIterator.return === undefined
        ? undefined
        : asyncIterator.return.bind(asyncIterator);
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (streamUsage && index >= streamUsage.initialCount) {
          const streamItemQueue = this.buildAsyncStreamItemQueue(
            index,
            path,
            asyncIterator,
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
            if (this.exeContext.cancellableStreams === undefined) {
              this.exeContext.cancellableStreams = new Set();
            }
            this.exeContext.cancellableStreams.add(streamRecord);
          }

          this.addIncrementalDataRecords(graphqlWrappedResult, [streamRecord]);
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
            this.toNodes(fieldDetailsList),
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
            this.completePromisedListItemValue(
              item,
              graphqlWrappedResult,
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
          this.completeListItemValue(
            item,
            completedResults,
            graphqlWrappedResult,
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
      ? /* c8 ignore start */ Promise.all(completedResults).then(
          (resolved) => ({
            rawResult: resolved,
            incrementalDataRecords: graphqlWrappedResult.incrementalDataRecords,
          }),
        )
      : /* c8 ignore stop */ graphqlWrappedResult;
  }

  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */
  completeListValue(
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
      const abortSignalListener = this.exeContext.abortSignalListener;
      const maybeCancellableIterable = abortSignalListener
        ? cancellableIterable(result, abortSignalListener)
        : result;
      const asyncIterator = maybeCancellableIterable[Symbol.asyncIterator]();

      return this.completeAsyncIteratorValue(
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

    return this.completeIterableValue(
      itemType,
      fieldDetailsList,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
    );
  }

  completeIterableValue(
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
    const streamUsage = this.getStreamUsage(fieldDetailsList, path);
    const iterator = items[Symbol.iterator]();
    let iteration = iterator.next();
    while (!iteration.done) {
      const item = iteration.value;

      if (streamUsage && index >= streamUsage.initialCount) {
        const syncStreamRecord: StreamRecord = {
          label: streamUsage.label,
          path,
          streamItemQueue: this.buildSyncStreamItemQueue(
            item,
            index,
            path,
            iterator,
            streamUsage.fieldDetailsList,
            info,
            itemType,
          ),
        };

        this.addIncrementalDataRecords(graphqlWrappedResult, [
          syncStreamRecord,
        ]);
        break;
      }

      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const itemPath = addPath(path, index, undefined);

      if (isPromise(item)) {
        completedResults.push(
          this.completePromisedListItemValue(
            item,
            graphqlWrappedResult,
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
        this.completeListItemValue(
          item,
          completedResults,
          graphqlWrappedResult,
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
  completeListItemValue(
    item: unknown,
    completedResults: Array<unknown>,
    parent: GraphQLWrappedResult<Array<unknown>>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemPath: Path,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): boolean {
    try {
      const completedItem = this.completeValue(
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
              this.addIncrementalDataRecords(
                parent,
                resolved.incrementalDataRecords,
              );
              return resolved.rawResult;
            },
            (rawError: unknown) => {
              this.handleFieldError(
                rawError,
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
      this.addIncrementalDataRecords(
        parent,
        completedItem.incrementalDataRecords,
      );
    } catch (rawError) {
      this.handleFieldError(
        rawError,
        itemType,
        fieldDetailsList,
        itemPath,
        incrementalContext,
      );
      completedResults.push(null);
    }
    return false;
  }

  async completePromisedListItemValue(
    item: Promise<unknown>,
    parent: GraphQLWrappedResult<Array<unknown>>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemPath: Path,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): Promise<unknown> {
    try {
      const abortSignalListener = this.exeContext.abortSignalListener;
      const maybeCancellableItem = abortSignalListener
        ? cancellablePromise(item, abortSignalListener)
        : item;
      const resolved = await maybeCancellableItem;
      let completed = this.completeValue(
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
      this.addIncrementalDataRecords(parent, completed.incrementalDataRecords);
      return completed.rawResult;
    } catch (rawError) {
      this.handleFieldError(
        rawError,
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
  completeLeafValue(returnType: GraphQLLeafType, result: unknown): unknown {
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
  completeAbstractValue(
    returnType: GraphQLAbstractType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    const { schema, contextValue } = this.validatedExecutionArgs;
    const resolveTypeFn =
      returnType.resolveType ?? this.validatedExecutionArgs.typeResolver;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

    if (isPromise(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) =>
        this.completeObjectValue(
          this.ensureValidRuntimeType(
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

    return this.completeObjectValue(
      this.ensureValidRuntimeType(
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

  ensureValidRuntimeType(
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
        { nodes: this.toNodes(fieldDetailsList) },
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
        { nodes: this.toNodes(fieldDetailsList) },
      );
    }

    if (!isObjectType(runtimeType)) {
      throw new GraphQLError(
        `Abstract type "${returnType}" was resolved to a non-object type "${runtimeTypeName}".`,
        { nodes: this.toNodes(fieldDetailsList) },
      );
    }

    if (!schema.isSubType(returnType, runtimeType)) {
      throw new GraphQLError(
        `Runtime Object type "${runtimeType}" is not a possible type for "${returnType}".`,
        { nodes: this.toNodes(fieldDetailsList) },
      );
    }

    return runtimeType;
  }

  /**
   * Complete an Object value by executing all sub-selections.
   */
  completeObjectValue(
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    if ((incrementalContext ?? this.exeContext).completed) {
      throw new Error('Completed, aborting.');
    }

    // If there is an isTypeOf predicate function, call it with the
    // current result. If isTypeOf returns false, then raise an error rather
    // than continuing execution.
    if (returnType.isTypeOf) {
      const isTypeOf = returnType.isTypeOf(
        result,
        this.validatedExecutionArgs.contextValue,
        info,
      );

      if (isPromise(isTypeOf)) {
        return isTypeOf.then((resolvedIsTypeOf) => {
          if (!resolvedIsTypeOf) {
            throw this.invalidReturnTypeError(
              returnType,
              result,
              fieldDetailsList,
            );
          }
          return this.collectAndExecuteSubfields(
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
        throw this.invalidReturnTypeError(returnType, result, fieldDetailsList);
      }
    }

    return this.collectAndExecuteSubfields(
      returnType,
      fieldDetailsList,
      path,
      result,
      incrementalContext,
      deferMap,
    );
  }

  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldDetailsList: FieldDetailsList,
  ): GraphQLError {
    return new GraphQLError(
      `Expected value of type "${returnType}" but got: ${inspect(result)}.`,
      { nodes: this.toNodes(fieldDetailsList) },
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
  getNewDeferMap(
    newDeferUsages: ReadonlyArray<DeferUsage>,
    deferMap?: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
    path?: Path | undefined,
  ): ReadonlyMap<DeferUsage, DeferredFragmentRecord> {
    const newDeferMap = new Map(deferMap);

    // For each new deferUsage object:
    for (const newDeferUsage of newDeferUsages) {
      const parentDeferUsage = newDeferUsage.parentDeferUsage;

      const parent =
        parentDeferUsage === undefined
          ? undefined
          : this.deferredFragmentRecordFromDeferUsage(
              parentDeferUsage,
              newDeferMap,
            );

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

  deferredFragmentRecordFromDeferUsage(
    deferUsage: DeferUsage,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  ): DeferredFragmentRecord {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return deferMap.get(deferUsage)!;
  }

  collectAndExecuteSubfields(
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    result: unknown,
    incrementalContext: IncrementalContext | undefined,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    // Collect sub-fields to execute to complete this value.
    const collectedSubfields = this.collectSubfields(
      returnType,
      fieldDetailsList,
    );
    const { groupedFieldSet, newDeferUsages } = collectedSubfields;

    this.assertValidOperationTypeForDefer(newDeferUsages);

    return this.executeSubExecutionPlan(
      returnType,
      result,
      groupedFieldSet,
      newDeferUsages,
      path,
      incrementalContext,
      deferMap,
    );
  }

  assertValidOperationTypeForDefer(
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ): void {
    if (newDeferUsages.length > 0) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      );
    }
  }

  executeSubExecutionPlan(
    returnType: GraphQLObjectType,
    sourceValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
    path?: Path | undefined,
    incrementalContext?: IncrementalContext | undefined,
    deferMap?: ReadonlyMap<DeferUsage, DeferredFragmentRecord> | undefined,
  ): PromiseOrValue<GraphQLWrappedResult<ObjMap<unknown>>> {
    if (deferMap === undefined && newDeferUsages.length === 0) {
      return this.executeFields(
        returnType,
        sourceValue,
        path,
        originalGroupedFieldSet,
        incrementalContext,
        deferMap,
      );
    }

    const newDeferMap = this.getNewDeferMap(newDeferUsages, deferMap, path);

    const { groupedFieldSet, newGroupedFieldSets } = this.buildSubExecutionPlan(
      originalGroupedFieldSet,
      incrementalContext?.deferUsageSet,
    );

    const graphqlWrappedResult = this.executeFields(
      returnType,
      sourceValue,
      path,
      groupedFieldSet,
      incrementalContext,
      newDeferMap,
    );

    if (newGroupedFieldSets.size > 0) {
      const newPendingExecutionGroups = this.collectExecutionGroups(
        returnType,
        sourceValue,
        path,
        incrementalContext?.deferUsageSet,
        newGroupedFieldSets,
        newDeferMap,
      );

      return this.withNewExecutionGroups(
        graphqlWrappedResult,
        newPendingExecutionGroups,
      );
    }
    return graphqlWrappedResult;
  }

  buildSubExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
    deferUsageSet: DeferUsageSet | undefined,
  ): ExecutionPlan {
    let executionPlan = (
      originalGroupedFieldSet as unknown as { _executionPlan: ExecutionPlan }
    )._executionPlan;
    if (executionPlan !== undefined) {
      return executionPlan;
    }
    executionPlan = this.buildExecutionPlan(
      originalGroupedFieldSet,
      deferUsageSet,
    );
    (
      originalGroupedFieldSet as unknown as { _executionPlan: ExecutionPlan }
    )._executionPlan = executionPlan;
    return executionPlan;
  }

  collectExecutionGroups(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    parentDeferUsages: DeferUsageSet | undefined,
    newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  ): ReadonlyArray<PendingExecutionGroup> {
    const newPendingExecutionGroups: Array<PendingExecutionGroup> = [];

    for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
      const deferredFragmentRecords = this.getDeferredFragmentRecords(
        deferUsageSet,
        deferMap,
      );

      const pendingExecutionGroup: PendingExecutionGroup = {
        deferredFragmentRecords,
        result:
          undefined as unknown as BoxedPromiseOrValue<CompletedExecutionGroup>,
      };

      const executor = () =>
        this.executeExecutionGroup(
          pendingExecutionGroup,
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

      if (this.validatedExecutionArgs.enableEarlyExecution) {
        pendingExecutionGroup.result = new BoxedPromiseOrValue(
          this.shouldDefer(parentDeferUsages, deferUsageSet)
            ? Promise.resolve().then(executor)
            : executor(),
        );
      } else {
        pendingExecutionGroup.result = () =>
          new BoxedPromiseOrValue(executor());
      }

      newPendingExecutionGroups.push(pendingExecutionGroup);
    }

    return newPendingExecutionGroups;
  }

  shouldDefer(
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

  executeExecutionGroup(
    pendingExecutionGroup: PendingExecutionGroup,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    incrementalContext: IncrementalContext,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  ): PromiseOrValue<CompletedExecutionGroup> {
    let result;
    try {
      result = this.executeFields(
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
        errors: this.withError(incrementalContext.errors, error),
      };
    }

    if (isPromise(result)) {
      return result.then(
        (resolved) => {
          incrementalContext.completed = true;
          return this.buildCompletedExecutionGroup(
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
            errors: this.withError(
              incrementalContext.errors,
              error as GraphQLError,
            ),
          };
        },
      );
    }

    incrementalContext.completed = true;
    return this.buildCompletedExecutionGroup(
      incrementalContext.errors,
      pendingExecutionGroup,
      path,
      result,
    );
  }

  buildCompletedExecutionGroup(
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

  getDeferredFragmentRecords(
    deferUsages: DeferUsageSet,
    deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  ): ReadonlyArray<DeferredFragmentRecord> {
    return Array.from(deferUsages).map((deferUsage) =>
      this.deferredFragmentRecordFromDeferUsage(deferUsage, deferMap),
    );
  }

  buildSyncStreamItemQueue(
    initialItem: PromiseOrValue<unknown>,
    initialIndex: number,
    streamPath: Path,
    iterator: Iterator<unknown>,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): Array<StreamItemRecord> {
    const streamItemQueue: Array<StreamItemRecord> = [];

    const enableEarlyExecution =
      this.validatedExecutionArgs.enableEarlyExecution;

    const firstExecutor = () => {
      const initialPath = addPath(streamPath, initialIndex, undefined);
      const firstStreamItem = new BoxedPromiseOrValue(
        this.completeStreamItem(
          initialPath,
          initialItem,
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
          this.completeStreamItem(
            itemPath,
            value,
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

  buildAsyncStreamItemQueue(
    initialIndex: number,
    streamPath: Path,
    asyncIterator: AsyncIterator<unknown>,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): Array<StreamItemRecord> {
    const streamItemQueue: Array<StreamItemRecord> = [];
    const executor = () =>
      this.getNextAsyncStreamItemResult(
        streamItemQueue,
        streamPath,
        initialIndex,
        asyncIterator,
        fieldDetailsList,
        info,
        itemType,
      );

    streamItemQueue.push(
      this.validatedExecutionArgs.enableEarlyExecution
        ? new BoxedPromiseOrValue(executor())
        : () => new BoxedPromiseOrValue(executor()),
    );

    return streamItemQueue;
  }

  async getNextAsyncStreamItemResult(
    streamItemQueue: Array<StreamItemRecord>,
    streamPath: Path,
    index: number,
    asyncIterator: AsyncIterator<unknown>,
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
          locatedError(
            error,
            this.toNodes(fieldDetailsList),
            pathToArray(streamPath),
          ),
        ],
      };
    }

    if (iteration.done) {
      return {};
    }

    const itemPath = addPath(streamPath, index, undefined);

    const result = this.completeStreamItem(
      itemPath,
      iteration.value,
      { errors: undefined, completed: false },
      fieldDetailsList,
      info,
      itemType,
    );

    const executor = () =>
      this.getNextAsyncStreamItemResult(
        streamItemQueue,
        streamPath,
        index + 1,
        asyncIterator,
        fieldDetailsList,
        info,
        itemType,
      );

    streamItemQueue.push(
      this.validatedExecutionArgs.enableEarlyExecution
        ? new BoxedPromiseOrValue(executor())
        : () => new BoxedPromiseOrValue(executor()),
    );

    return result;
  }

  completeStreamItem(
    itemPath: Path,
    item: unknown,
    incrementalContext: IncrementalContext,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): PromiseOrValue<StreamItemResult> {
    if (isPromise(item)) {
      const abortSignalListener = this.exeContext.abortSignalListener;
      const maybeCancellableItem = abortSignalListener
        ? cancellablePromise(item, abortSignalListener)
        : item;
      return this.completePromisedValue(
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
          return this.buildStreamItemResult(
            incrementalContext.errors,
            resolvedItem,
          );
        },
        (error: unknown) => {
          incrementalContext.completed = true;
          return {
            errors: this.withError(
              incrementalContext.errors,
              error as GraphQLError,
            ),
          };
        },
      );
    }

    let result: PromiseOrValue<GraphQLWrappedResult<unknown>>;
    try {
      try {
        result = this.completeValue(
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          item,
          incrementalContext,
          new Map(),
        );
      } catch (rawError) {
        this.handleFieldError(
          rawError,
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
        errors: this.withError(incrementalContext.errors, error),
      };
    }

    if (isPromise(result)) {
      return result
        .then(undefined, (rawError: unknown) => {
          this.handleFieldError(
            rawError,
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
            return this.buildStreamItemResult(
              incrementalContext.errors,
              resolvedItem,
            );
          },
          (error: unknown) => {
            incrementalContext.completed = true;
            return {
              errors: this.withError(
                incrementalContext.errors,
                error as GraphQLError,
              ),
            };
          },
        );
    }

    incrementalContext.completed = true;
    return this.buildStreamItemResult(incrementalContext.errors, result);
  }

  buildStreamItemResult(
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
}
