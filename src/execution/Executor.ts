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
import { GraphQLStreamDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { cancellablePromise } from './cancellablePromise.js';
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
import type {
  DeferUsageSet,
  ExecutionPlan,
} from './incremental/buildExecutionPlan.js';
import { buildExecutionPlan } from './incremental/buildExecutionPlan.js';
import { Computation } from './incremental/Computation.js';
import { IncrementalPublisher } from './incremental/IncrementalPublisher.js';
import { Queue } from './incremental/Queue.js';
import type { Group, Stream, Task, Work } from './incremental/WorkQueue.js';
import { ResolveInfo } from './ResolveInfo.js';
import type { VariableValues } from './values.js';
import { getArgumentValues, getDirectiveValues } from './values.js';

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
  externalAbortSignal: AbortSignal | undefined;
  enableEarlyExecution: boolean;
}

/**
 * @internal
 */
class CollectedErrors {
  private _errorPositions: Set<Path | undefined>;
  private _errors: Array<GraphQLError>;
  constructor() {
    this._errorPositions = new Set<Path | undefined>();
    this._errors = [];
  }

  get errors(): ReadonlyArray<GraphQLError> {
    return this._errors;
  }

  add(error: GraphQLError, path: Path | undefined) {
    // Do not modify errors list if the execution position for this error or
    // any of its ancestors has already been nulled via error propagation.
    // This check should be unnecessary for implementations able to implement
    // actual cancellation.
    if (this.hasNulledPosition(path)) {
      return;
    }
    this._errorPositions.add(path);
    this._errors.push(error);
  }

  hasNulledPosition(startPath: Path | undefined): boolean {
    let path = startPath;
    while (path !== undefined) {
      if (this._errorPositions.has(path)) {
        return true;
      }
      path = path.prev;
    }
    return this._errorPositions.has(undefined);
  }
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
  TInitial = ObjMap<unknown>,
  TSubsequent = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TInitial, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TSubsequent, TExtensions>,
    void,
    void
  >;
}

export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  data: TData;
  pending: ReadonlyArray<PendingResult>;
  hasNext: true;
  extensions?: TExtensions;
}

export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  data: TData;
  pending: ReadonlyArray<PendingResult>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface SubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  completed?: ReadonlyArray<CompletedResult>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface FormattedSubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  completed?: ReadonlyArray<FormattedCompletedResult>;
  extensions?: TExtensions;
}

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  data: TData;
  extensions?: TExtensions;
}

export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data: TData;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export interface IncrementalStreamResult<
  TData = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  items: TData;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items: TData;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export type IncrementalResult<TData = unknown, TExtensions = ObjMap<unknown>> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;

export type FormattedIncrementalResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TData, TExtensions>;

export interface PendingResult {
  id: string;
  path: ReadonlyArray<string | number>;
  label?: string;
}

export interface CompletedResult {
  id: string;
  errors?: ReadonlyArray<GraphQLError>;
}

export interface FormattedCompletedResult {
  id: string;
  errors?: ReadonlyArray<GraphQLFormattedError>;
}

export interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldDetailsList: FieldDetailsList;
}

/** @internal */
interface ExecutionGroup
  extends Task<
    ExecutionGroupValue,
    StreamItemValue,
    DeliveryGroup,
    ItemStream
  > {
  groups: ReadonlyArray<DeliveryGroup>;
  path: Path | undefined;
  computation: Computation<ExecutionGroupResult>;
}

/** @internal */
export interface DeliveryGroup extends Group<DeliveryGroup> {
  path: Path | undefined;
  label: string | undefined;
  parent: DeliveryGroup | undefined;
}

export interface ItemStream
  extends Stream<
    ExecutionGroupValue,
    StreamItemValue,
    DeliveryGroup,
    ItemStream
  > {
  path: Path;
  label: string | undefined;
}

export interface ExecutionGroupValue {
  deliveryGroups: ReadonlyArray<DeliveryGroup>;
  path: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  data: ObjMap<unknown>;
}

export type IncrementalWork = Work<
  ExecutionGroupValue,
  StreamItemValue,
  DeliveryGroup,
  ItemStream
>;

export interface ExecutionGroupResult {
  value: ExecutionGroupValue;
  work?: IncrementalWork | undefined;
}

export interface StreamItemValue {
  errors?: ReadonlyArray<GraphQLError>;
  item: unknown;
}

export interface StreamItemResult {
  value: StreamItemValue;
  work?: IncrementalWork | undefined;
}

/** @internal */
export class Executor {
  validatedExecutionArgs: ValidatedExecutionArgs;
  deferUsageSet?: DeferUsageSet | undefined;
  onExternalAbort: (() => void) | undefined;
  finished: boolean;
  abortControllers: Set<AbortController>;
  collectedErrors: CollectedErrors;
  groups: Array<DeliveryGroup>;
  tasks: Array<ExecutionGroup>;
  streams: Array<ItemStream>;

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    deferUsageSet?: DeferUsageSet,
  ) {
    this.validatedExecutionArgs = validatedExecutionArgs;
    this.deferUsageSet = deferUsageSet;
    this.onExternalAbort = undefined;
    this.finished = false;
    this.abortControllers = new Set();
    this.collectedErrors = new CollectedErrors();
    this.groups = [];
    this.tasks = [];
    this.streams = [];
  }

  executeQueryOrMutationOrSubscriptionEvent(): PromiseOrValue<
    ExecutionResult | ExperimentalIncrementalExecutionResults
  > {
    const validatedExecutionArgs = this.validatedExecutionArgs;
    const externalAbortSignal = validatedExecutionArgs.externalAbortSignal;
    if (externalAbortSignal) {
      if (externalAbortSignal.aborted) {
        throw new Error(externalAbortSignal.reason);
      }
      const onExternalAbort = () => {
        this.cancel(externalAbortSignal.reason);
      };
      externalAbortSignal.addEventListener('abort', onExternalAbort);
      this.onExternalAbort = onExternalAbort;
    }

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

      const result = this.executeCollectedRootFields(
        operation.operation,
        rootType,
        rootValue,
        groupedFieldSet,
        newDeferUsages,
      );

      if (isPromise(result)) {
        const promise = result.then(
          (data) => {
            this.finish();
            return this.buildResponse(data);
          },
          (error: unknown) => {
            this.finish();
            this.collectedErrors.add(error as GraphQLError, undefined);
            return this.buildResponse(null);
          },
        );
        return externalAbortSignal
          ? cancellablePromise(promise, externalAbortSignal)
          : promise;
      }
      return this.buildResponse(result);
    } catch (error) {
      this.collectedErrors.add(error as GraphQLError, undefined);
      return this.buildResponse(null);
    }
  }

  cancel(reason?: unknown): void {
    if (!this.finished) {
      for (const task of this.tasks) {
        task.computation.cancel();
      }
      for (const stream of this.streams) {
        stream.queue.abort();
      }
      this.finish(reason);
    }
  }

  finish(reason?: unknown): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    const { abortControllers, onExternalAbort } = this;
    const finishReason =
      reason ?? new Error('Execution has already completed.');
    for (const abortController of abortControllers) {
      abortController.abort(finishReason);
    }
    if (onExternalAbort) {
      this.validatedExecutionArgs.externalAbortSignal?.removeEventListener(
        'abort',
        onExternalAbort,
      );
    }
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | ExperimentalIncrementalExecutionResults {
    const errors = this.collectedErrors.errors;
    const work = this.getIncrementalWork();
    const { tasks, streams } = work;
    if (tasks?.length === 0 && streams?.length === 0) {
      return errors.length ? { errors, data } : { data };
    }

    invariant(data !== null);
    const incrementalPublisher = new IncrementalPublisher();
    return incrementalPublisher.buildResponse(
      data,
      errors,
      work,
      this.validatedExecutionArgs.externalAbortSignal,
    );
  }

  executeCollectedRootFields(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<ObjMap<unknown>> {
    if (newDeferUsages.length === 0) {
      return this.executeRootGroupedFieldSet(
        operation,
        rootType,
        rootValue,
        originalGroupedFieldSet,
        undefined,
      );
    }

    invariant(
      this.validatedExecutionArgs.operation.operation !==
        OperationTypeNode.SUBSCRIPTION,
      '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
    );

    const { newDeliveryGroups, newDeliveryGroupMap } =
      this.getNewDeliveryGroupMap(newDeferUsages, undefined, undefined);

    const { groupedFieldSet, newGroupedFieldSets } = buildExecutionPlan(
      originalGroupedFieldSet,
    );

    const data = this.executeRootGroupedFieldSet(
      operation,
      rootType,
      rootValue,
      groupedFieldSet,
      newDeliveryGroupMap,
    );

    this.groups.push(...newDeliveryGroups);

    if (newGroupedFieldSets.size > 0) {
      this.collectExecutionGroups(
        rootType,
        rootValue,
        undefined,
        newGroupedFieldSets,
        newDeliveryGroupMap,
      );
    }

    return data;
  }

  executeRootGroupedFieldSet(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
    groupedFieldSet: GroupedFieldSet,
    deliveryGroupMap?: ReadonlyMap<DeferUsage, DeliveryGroup>,
  ): PromiseOrValue<ObjMap<unknown>> {
    switch (operation) {
      case OperationTypeNode.QUERY:
        return this.executeFields(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          deliveryGroupMap,
        );
      case OperationTypeNode.MUTATION:
        return this.executeFieldsSerially(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          deliveryGroupMap,
        );
      case OperationTypeNode.SUBSCRIPTION:
        // TODO: deprecate `subscribe` and move all logic here
        // Temporary solution until we finish merging execute and subscribe together
        return this.executeFields(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          deliveryGroupMap,
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
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    return promiseReduce(
      groupedFieldSet,
      (results, [responseName, fieldDetailsList]) => {
        if (this.finished) {
          throw new Error('Execution has already completed.');
        }
        const fieldPath = addPath(path, responseName, parentType.name);
        const result = this.executeField(
          parentType,
          sourceValue,
          fieldDetailsList,
          fieldPath,
          deliveryGroupMap,
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
  executeFields(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    const results = Object.create(null);
    let containsPromise = false;

    try {
      for (const [responseName, fieldDetailsList] of groupedFieldSet) {
        const fieldPath = addPath(path, responseName, parentType.name);
        const result = this.executeField(
          parentType,
          sourceValue,
          fieldDetailsList,
          fieldPath,
          deliveryGroupMap,
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
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<unknown> {
    const validatedExecutionArgs = this.validatedExecutionArgs;
    const { schema, contextValue, variableValues, hideSuggestions } =
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
      () => {
        /* c8 ignore next 3 */
        if (this.finished) {
          throw new Error('Execution has already completed.');
        }
        const abortController = new AbortController();
        this.abortControllers.add(abortController);
        return {
          abortSignal: abortController.signal,
          unregister: () => {
            this.abortControllers.delete(abortController);
          },
        };
      },
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
        return this.completePromisedValue(
          returnType,
          fieldDetailsList,
          info,
          path,
          result,
          deliveryGroupMap,
          true,
        );
      }

      const completed = this.completeValue(
        returnType,
        fieldDetailsList,
        info,
        path,
        result,
        deliveryGroupMap,
      );

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(
          (resolved) => {
            info.unregisterAbortSignal();
            return resolved;
          },
          (rawError: unknown) => {
            info.unregisterAbortSignal();
            this.handleFieldError(rawError, returnType, fieldDetailsList, path);
            return null;
          },
        );
      }
      info.unregisterAbortSignal();
      return completed;
    } catch (rawError) {
      info.unregisterAbortSignal();
      this.handleFieldError(rawError, returnType, fieldDetailsList, path);
      return null;
    }
  }

  handleFieldError(
    rawError: unknown,
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
  ): void {
    if (this.finished) {
      throw new Error('Execution has already completed.');
    }

    const error = locatedError(
      rawError,
      toNodes(fieldDetailsList),
      pathToArray(path),
    );

    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (
      this.validatedExecutionArgs.errorPropagation &&
      isNonNullType(returnType)
    ) {
      throw error;
    }

    // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.
    this.collectedErrors.add(error, path);
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
    info: ResolveInfo,
    path: Path,
    result: unknown,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<unknown> {
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
        deliveryGroupMap,
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
      return this.completeListValue(
        returnType,
        fieldDetailsList,
        info,
        path,
        result,
        deliveryGroupMap,
      );
    }

    // If field type is a leaf type, Scalar or Enum, coerce to a valid value,
    // returning null if coercion is not possible.
    if (isLeafType(returnType)) {
      return this.completeLeafValue(returnType, result);
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
        deliveryGroupMap,
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
        deliveryGroupMap,
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

  async completePromisedValue(
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    path: Path,
    result: Promise<unknown>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
    isFieldValue?: boolean,
  ): Promise<unknown> {
    try {
      const resolved = await result;
      if (this.finished) {
        throw new Error('Execution has already completed.');
      }
      let completed = this.completeValue(
        returnType,
        fieldDetailsList,
        info,
        path,
        resolved,
        deliveryGroupMap,
      );

      if (isPromise(completed)) {
        completed = await completed;
      }
      if (isFieldValue) {
        info.unregisterAbortSignal();
      }
      return completed;
    } catch (rawError) {
      if (isFieldValue) {
        info.unregisterAbortSignal();
      }
      this.handleFieldError(rawError, returnType, fieldDetailsList, path);
      return null;
    }
  }

  /**
   * Complete a async iterator value by completing the result and calling
   * recursively until all the results are completed.
   */
  async completeAsyncIterableValue(
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    path: Path,
    items: AsyncIterable<unknown>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): Promise<ReadonlyArray<unknown>> {
    const streamUsage = this.getStreamUsage(fieldDetailsList, path);

    let containsPromise = false;
    const completedResults: Array<unknown> = [];
    const asyncIterator = items[Symbol.asyncIterator]();
    let index = 0;
    let iteration;
    try {
      while (true) {
        if (streamUsage && index === streamUsage.initialCount) {
          this.handleStream(
            index,
            path,
            { handle: asyncIterator, isAsync: true },
            streamUsage,
            info,
            itemType,
          );
          break;
        }

        const itemPath = addPath(path, index, undefined);
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
        if (this.finished || iteration.done) {
          break;
        }
        const item = iteration.value;
        if (
          this.completeMaybePromisedListItemValue(
            item,
            completedResults,
            itemType,
            fieldDetailsList,
            info,
            itemPath,
            deliveryGroupMap,
          )
        ) {
          containsPromise = true;
        }
        index++;
      }
    } catch (error) {
      returnIteratorCatchingErrors(asyncIterator);
      throw error;
    }

    // Throwing on completion outside of the loop may allow engines to better optimize
    if (this.finished) {
      if (!iteration?.done) {
        returnIteratorCatchingErrors(asyncIterator);
      }
      throw new Error('Execution has already completed.');
    }

    return containsPromise ? Promise.all(completedResults) : completedResults;
  }

  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */
  completeListValue(
    returnType: GraphQLList<GraphQLOutputType>,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    path: Path,
    result: unknown,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const itemType = returnType.ofType;

    if (isAsyncIterable(result)) {
      return this.completeAsyncIterableValue(
        itemType,
        fieldDetailsList,
        info,
        path,
        result,
        deliveryGroupMap,
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
      deliveryGroupMap,
    );
  }

  completeIterableValue(
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    path: Path,
    items: Iterable<unknown>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const streamUsage = this.getStreamUsage(fieldDetailsList, path);

    // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.
    let containsPromise = false;
    const completedResults: Array<unknown> = [];
    let index = 0;
    const iterator = items[Symbol.iterator]();
    try {
      while (true) {
        if (streamUsage && index === streamUsage.initialCount) {
          this.handleStream(
            index,
            path,
            { handle: iterator },
            streamUsage,
            info,
            itemType,
          );
          break;
        }

        const iteration = iterator.next();
        if (iteration.done) {
          break;
        }

        const item = iteration.value;

        // No need to modify the info object containing the path,
        // since from here on it is not ever accessed by resolver functions.
        const itemPath = addPath(path, index, undefined);

        if (
          this.completeMaybePromisedListItemValue(
            item,
            completedResults,
            itemType,
            fieldDetailsList,
            info,
            itemPath,
            deliveryGroupMap,
          )
        ) {
          containsPromise = true;
        }

        index++;
      }
    } catch (error) {
      returnIteratorCatchingErrors(iterator);
      throw error;
    }

    return containsPromise ? Promise.all(completedResults) : completedResults;
  }

  completeMaybePromisedListItemValue(
    item: unknown,
    completedResults: Array<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    itemPath: Path,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): boolean {
    if (isPromise(item)) {
      completedResults.push(
        this.completePromisedListItemValue(
          item,
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          deliveryGroupMap,
        ),
      );
      return true;
    } else if (
      this.completeListItemValue(
        item,
        completedResults,
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        deliveryGroupMap,
      )
    ) {
      return true;
    }
    return false;
  }

  /**
   * Complete a list item value by adding it to the completed results.
   *
   * Returns true if the value is a Promise.
   */
  completeListItemValue(
    item: unknown,
    completedResults: Array<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    itemPath: Path,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): boolean {
    try {
      const completedItem = this.completeValue(
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        item,
        deliveryGroupMap,
      );

      if (isPromise(completedItem)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        completedResults.push(
          completedItem.then(undefined, (rawError: unknown) => {
            this.handleFieldError(
              rawError,
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
      this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
      completedResults.push(null);
    }
    return false;
  }

  async completePromisedListItemValue(
    item: Promise<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    itemPath: Path,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): Promise<unknown> {
    try {
      const resolved = await item;
      if (this.finished) {
        throw new Error('Execution has already completed.');
      }
      let completed = this.completeValue(
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        resolved,
        deliveryGroupMap,
      );
      if (isPromise(completed)) {
        completed = await completed;
      }
      return completed;
    } catch (rawError) {
      this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
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
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    const validatedExecutionArgs = this.validatedExecutionArgs;
    const { schema, contextValue } = validatedExecutionArgs;
    const resolveTypeFn =
      returnType.resolveType ?? validatedExecutionArgs.typeResolver;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

    if (isPromise(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) => {
        if (this.finished) {
          throw new Error('Execution has already completed.');
        }
        return this.completeObjectValue(
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
          deliveryGroupMap,
        );
      });
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
      deliveryGroupMap,
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
  completeObjectValue(
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
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
          if (this.finished) {
            throw new Error('Execution has already completed.');
          }
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
            deliveryGroupMap,
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
      deliveryGroupMap,
    );
  }

  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldDetailsList: FieldDetailsList,
  ): GraphQLError {
    return new GraphQLError(
      `Expected value of type "${returnType}" but got: ${inspect(result)}.`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  collectAndExecuteSubfields(
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    result: unknown,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    // Collect sub-fields to execute to complete this value.
    const { groupedFieldSet, newDeferUsages } = collectSubfields(
      this.validatedExecutionArgs,
      returnType,
      fieldDetailsList,
    );

    return this.executeCollectedSubfields(
      returnType,
      result,
      path,
      groupedFieldSet,
      newDeferUsages,
      deliveryGroupMap,
    );
  }

  executeCollectedSubfields(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    originalGroupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    if (newDeferUsages.length > 0) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      );
    }

    if (deliveryGroupMap === undefined && newDeferUsages.length === 0) {
      return this.executeFields(
        parentType,
        sourceValue,
        path,
        originalGroupedFieldSet,
        deliveryGroupMap,
      );
    }

    const { newDeliveryGroups, newDeliveryGroupMap } =
      this.getNewDeliveryGroupMap(newDeferUsages, deliveryGroupMap, path);

    const { groupedFieldSet, newGroupedFieldSets } = this.buildSubExecutionPlan(
      originalGroupedFieldSet,
      this.deferUsageSet,
    );

    const data = this.executeFields(
      parentType,
      sourceValue,
      path,
      groupedFieldSet,
      newDeliveryGroupMap,
    );

    this.groups.push(...newDeliveryGroups);

    if (newGroupedFieldSets.size > 0) {
      this.collectExecutionGroups(
        parentType,
        sourceValue,
        path,
        newGroupedFieldSets,
        newDeliveryGroupMap,
      );
    }

    return data;
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

  handleStream(
    index: number,
    path: Path,
    iterator:
      | { handle: Iterator<unknown>; isAsync?: never }
      | { handle: AsyncIterator<unknown>; isAsync: true },
    streamUsage: StreamUsage,
    info: ResolveInfo,
    itemType: GraphQLOutputType,
  ): void {
    const { handle, isAsync } = iterator;
    const queue = this.buildStreamItemQueue(
      index,
      path,
      handle,
      streamUsage.fieldDetailsList,
      info,
      itemType,
      isAsync,
    );

    const itemStream: ItemStream = {
      label: streamUsage.label,
      path,
      queue,
    };

    this.streams.push(itemStream);
  }

  collectExecutionGroups(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
  ): void {
    for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
      const deliveryGroups = getDeliveryGroups(deferUsageSet, deliveryGroupMap);

      const executor = new Executor(this.validatedExecutionArgs, deferUsageSet);

      const executionGroup: ExecutionGroup = {
        groups: deliveryGroups,
        path,
        computation: new Computation(
          () =>
            executor.executeExecutionGroup(
              deliveryGroups,
              parentType,
              sourceValue,
              path,
              groupedFieldSet,
              deliveryGroupMap,
            ),
          () => executor.cancel(),
        ),
      };

      const parentDeferUsages = this.deferUsageSet;

      if (this.validatedExecutionArgs.enableEarlyExecution) {
        if (this.shouldDefer(parentDeferUsages, deferUsageSet)) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          Promise.resolve().then(() => executionGroup.computation.prime());
        } else {
          executionGroup.computation.prime();
        }
      }

      this.tasks.push(executionGroup);
    }
  }

  executeExecutionGroup(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
  ): PromiseOrValue<ExecutionGroupResult> {
    let result;
    try {
      result = this.executeFields(
        parentType,
        sourceValue,
        path,
        groupedFieldSet,
        deliveryGroupMap,
      );
    } catch (error) {
      this.cancel();
      throw error;
    }

    if (isPromise(result)) {
      return result.then(
        (resolved) =>
          this.buildExecutionGroupResult(deliveryGroups, path, resolved),
        (error: unknown) => {
          throw error;
        },
      );
    }

    return this.buildExecutionGroupResult(deliveryGroups, path, result);
  }

  buildStreamItemQueue(
    initialIndex: number,
    streamPath: Path,
    iterator: Iterator<unknown> | AsyncIterator<unknown>,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    itemType: GraphQLOutputType,
    isAsync: boolean | undefined,
  ): Queue<StreamItemResult> {
    const { enableEarlyExecution } = this.validatedExecutionArgs;
    const queue = new Queue<StreamItemResult>(
      async ({ push, stop, started, stopped }) => {
        const cancelStreamItems = new Set<() => void>();

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        stopped.then(() => {
          cancelStreamItems.forEach((cancelStreamItem) => cancelStreamItem());
          returnIteratorCatchingErrors(iterator);
        });
        await (enableEarlyExecution ? Promise.resolve() : started);
        if (queue.isStopped()) {
          return;
        }
        let index = initialIndex;
        while (true) {
          let iteration;
          try {
            if (isAsync) {
              // eslint-disable-next-line no-await-in-loop
              iteration = await iterator.next();
              if (queue.isStopped()) {
                return;
              }
            } else {
              iteration = (iterator as Iterator<unknown>).next();
            }
          } catch (rawError) {
            throw locatedError(
              rawError,
              toNodes(fieldDetailsList),
              pathToArray(streamPath),
            );
          }

          if (iteration.done) {
            stop();
            return;
          }

          const itemPath = addPath(streamPath, index, undefined);

          const executor = new Executor(this.validatedExecutionArgs);

          let streamItemResult = executor.completeStreamItem(
            itemPath,
            iteration.value,
            fieldDetailsList,
            info,
            itemType,
          );
          if (isPromise(streamItemResult)) {
            if (enableEarlyExecution) {
              const cancelStreamItem = () => executor.cancel();
              cancelStreamItems.add(cancelStreamItem);
              streamItemResult = streamItemResult.finally(() => {
                cancelStreamItems.delete(cancelStreamItem);
              });
            } else {
              // eslint-disable-next-line no-await-in-loop
              streamItemResult = await streamItemResult;
              if (queue.isStopped()) {
                return;
              }
            }
          }
          const pushResult = push(streamItemResult);
          if (isPromise(pushResult)) {
            // eslint-disable-next-line no-await-in-loop
            await pushResult;
            if (queue.isStopped()) {
              return;
            }
          }
          index += 1;
        }
      },
      // set initialCapacity to 100 by default
      100,
    );
    return queue;
  }

  completeStreamItem(
    itemPath: Path,
    item: unknown,
    fieldDetailsList: FieldDetailsList,
    info: ResolveInfo,
    itemType: GraphQLOutputType,
  ): PromiseOrValue<StreamItemResult> {
    if (isPromise(item)) {
      return this.completePromisedValue(
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        item,
        undefined,
      )
        .then(
          (resolvedItem) => this.buildStreamItemResult(resolvedItem),
          (rawError: unknown) => {
            this.handleFieldError(
              rawError,
              itemType,
              fieldDetailsList,
              itemPath,
            );
            return this.buildStreamItemResult(null);
          },
        )
        .then(undefined, (error: unknown) => {
          this.cancel();
          throw error;
        });
    }

    let result: PromiseOrValue<unknown>;
    try {
      try {
        result = this.completeValue(
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          item,
          undefined,
        );
      } catch (rawError) {
        this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
        return this.buildStreamItemResult(null);
      }
    } catch (error) {
      this.cancel();
      throw error;
    }

    if (isPromise(result)) {
      return result
        .then(
          (resolved) => this.buildStreamItemResult(resolved),
          (rawError: unknown) => {
            this.handleFieldError(
              rawError,
              itemType,
              fieldDetailsList,
              itemPath,
            );
            return this.buildStreamItemResult(null);
          },
        )
        .then(undefined, (error: unknown) => {
          this.cancel();
          throw error;
        });
    }

    return this.buildStreamItemResult(result);
  }

  buildExecutionGroupResult(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    path: Path | undefined,
    result: ObjMap<unknown>,
  ): ExecutionGroupResult {
    this.finish();
    const data = result;
    const errors = this.collectedErrors.errors;
    return {
      value: errors.length
        ? { deliveryGroups, path: pathToArray(path), errors, data }
        : { deliveryGroups, path: pathToArray(path), data },
      work: this.getIncrementalWork(),
    };
  }

  getIncrementalWork(): IncrementalWork {
    const { groups, tasks, streams, collectedErrors } = this;

    if (collectedErrors.errors.length === 0) {
      return { groups, tasks, streams };
    }

    const filteredTasks: Array<ExecutionGroup> = [];
    for (const task of tasks) {
      if (collectedErrors.hasNulledPosition(task.path)) {
        task.computation.cancel();
      } else {
        filteredTasks.push(task);
      }
    }

    const filteredStreams: Array<ItemStream> = [];
    for (const stream of streams) {
      if (collectedErrors.hasNulledPosition(stream.path)) {
        stream.queue.cancel();
      } else {
        filteredStreams.push(stream);
      }
    }

    return {
      groups,
      tasks: filteredTasks,
      streams: filteredStreams,
    };
  }

  buildStreamItemResult(result: unknown): StreamItemResult {
    this.finish();
    const item = result;
    const errors = this.collectedErrors.errors;
    const work = this.getIncrementalWork();
    return errors.length > 0
      ? { value: { item, errors }, work }
      : { value: { item }, work };
  }

  /**
   * Instantiates new DeliveryGroups for the given path, returning an
   * updated map of DeferUsage objects to DeliveryGroups.
   *
   * Note: As defer directives may be used with operations returning lists,
   * a DeferUsage object may correspond to many DeliveryGroups.
   */
  getNewDeliveryGroupMap(
    newDeferUsages: ReadonlyArray<DeferUsage>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
    path: Path | undefined,
  ): {
    newDeliveryGroups: ReadonlyArray<DeliveryGroup>;
    newDeliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>;
  } {
    const newDeliveryGroups: Array<DeliveryGroup> = [];
    const newDeliveryGroupMap = new Map(deliveryGroupMap);

    // For each new deferUsage object:
    for (const newDeferUsage of newDeferUsages) {
      const parentDeferUsage = newDeferUsage.parentDeferUsage;

      const parent =
        parentDeferUsage === undefined
          ? undefined
          : deliveryGroupFromDeferUsage(parentDeferUsage, newDeliveryGroupMap);

      // Create a new DeliveryGroup object
      const deliveryGroup: DeliveryGroup = {
        path,
        label: newDeferUsage.label,
        parent,
      };

      // Add it to the list of new groups
      newDeliveryGroups.push(deliveryGroup);

      // Update the map
      newDeliveryGroupMap.set(newDeferUsage, deliveryGroup);
    }

    return {
      newDeliveryGroups,
      newDeliveryGroupMap,
    };
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
    executionPlan = buildExecutionPlan(originalGroupedFieldSet, deferUsageSet);
    (
      originalGroupedFieldSet as unknown as { _executionPlan: ExecutionPlan }
    )._executionPlan = executionPlan;
    return executionPlan;
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
}

function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}

function getDeliveryGroups(
  deferUsageSet: DeferUsageSet,
  deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
): ReadonlyArray<DeliveryGroup> {
  return Array.from(deferUsageSet).map((deferUsage) =>
    deliveryGroupFromDeferUsage(deferUsage, deliveryGroupMap),
  );
}

function deliveryGroupFromDeferUsage(
  deferUsage: DeferUsage,
  deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
): DeliveryGroup {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return deliveryGroupMap.get(deferUsage)!;
}

function returnIteratorCatchingErrors(
  iterator: Iterator<unknown> | AsyncIterator<unknown>,
): void {
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
