/** @category Execution */

import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.ts';
import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { isPromise, isPromiseLike } from '../jsutils/isPromise.ts';
import { memoize2 } from '../jsutils/memoize2.ts';
import { memoize3 } from '../jsutils/memoize3.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import { promiseForObject } from '../jsutils/promiseForObject.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';
import { promiseReduce } from '../jsutils/promiseReduce.ts';

import { ensureGraphQLError } from '../error/ensureGraphQLError.ts';
import type { GraphQLFormattedError } from '../error/GraphQLError.ts';
import { GraphQLError } from '../error/GraphQLError.ts';
import { locatedError } from '../error/locatedError.ts';

import type { FieldNode } from '../language/ast.ts';
import { OperationTypeNode } from '../language/ast.ts';

import type {
  GraphQLAbstractType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLResolveInfoHelpers,
} from '../type/definition.ts';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.ts';
import type { GraphQLSchema } from '../type/schema.ts';

import { AbortedGraphQLExecutionError } from './AbortedGraphQLExecutionError.ts';
import { buildResolveInfo } from './buildResolveInfo.ts';
import { withCancellation } from './cancellablePromise.ts';
import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from './collectFields.ts';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields.ts';
import { collectIteratorPromises } from './collectIteratorPromises.ts';
import type { SharedExecutionContext } from './createSharedExecutionContext.ts';
import { createSharedExecutionContext } from './createSharedExecutionContext.ts';
import type { ValidatedExecutionArgs } from './ExecutionArgs.ts';
import type { StreamUsage } from './getStreamUsage.ts';
import { getStreamUsage as _getStreamUsage } from './getStreamUsage.ts';
import { runAsyncWorkFinishedHook } from './hooks.ts';
import { returnIteratorCatchingErrors } from './returnIteratorCatchingErrors.ts';
import { getArgumentValues } from './values.ts';

/* eslint-disable max-params */
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
 *
 * @internal
 */

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 *
 * @internal
 */
export const collectSubfields: (
  validatedExecutionArgs: ValidatedExecutionArgs,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
) => ReturnType<typeof _collectSubfields> = memoize3(
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

/** @internal */
export const getStreamUsage: typeof _getStreamUsage = memoize2(
  (
    validatedExecutionArgs: ValidatedExecutionArgs,
    fieldDetailsList: FieldDetailsList,
  ) => _getStreamUsage(validatedExecutionArgs, fieldDetailsList),
);

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

  add(error: GraphQLError, path: Path | undefined): void {
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
 * Represents the response produced by executing a GraphQL operation.
 * @typeParam TData - Shape of the execution data payload.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  /** Errors raised while parsing, validating, or executing the operation. */
  errors?: ReadonlyArray<GraphQLError>;
  /** Data returned by execution, or null when execution could not produce data. */
  data?: TData | null;
  /** Additional non-standard metadata included in the execution result. */
  extensions?: TExtensions;
}

/**
 * A JSON-serializable GraphQL execution result.
 * @typeParam TData - Shape of the formatted data payload.
 * @typeParam TExtensions - Shape of the formatted extensions payload.
 */
export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  /** Errors raised while parsing, validating, or executing the operation. */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /** Data returned by execution, or null when execution could not produce data. */
  data?: TData | null;
  /** Additional non-standard metadata included in the formatted result. */
  extensions?: TExtensions;
}

const defaultAbortReason = new Error('This operation was aborted');

/** @internal */
export class Executor<
  TPositionContext = undefined, // No position context by default
  TAlternativeInitialResponse = ExecutionResult, // No alternative by default
> {
  validatedExecutionArgs: ValidatedExecutionArgs;
  aborted: boolean;
  abortReason: unknown;
  sharedExecutionContext: SharedExecutionContext;
  collectedErrors: CollectedErrors;
  abortResultPromise: (() => void) | undefined;
  resolverAbortController: AbortController | undefined;
  getAbortSignal: () => AbortSignal | undefined;
  getAsyncHelpers: () => GraphQLResolveInfoHelpers;
  promiseAll: <T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ) => Promise<Array<T>>;

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    sharedExecutionContext?: SharedExecutionContext,
  ) {
    this.validatedExecutionArgs = validatedExecutionArgs;
    this.aborted = false;
    this.abortReason = defaultAbortReason;
    this.collectedErrors = new CollectedErrors();

    if (sharedExecutionContext === undefined) {
      this.resolverAbortController = new AbortController();
      this.sharedExecutionContext = createSharedExecutionContext(
        this.resolverAbortController.signal,
      );
    } else {
      this.sharedExecutionContext = sharedExecutionContext;
    }
    const { getAbortSignal, getAsyncHelpers, promiseAll } =
      this.sharedExecutionContext;
    this.getAbortSignal = getAbortSignal;
    this.getAsyncHelpers = getAsyncHelpers;
    this.promiseAll = promiseAll;
  }

  executeRootSelectionSet(
    serially?: boolean,
  ): PromiseOrValue<ExecutionResult | TAlternativeInitialResponse> {
    const externalAbortSignal = this.validatedExecutionArgs.externalAbortSignal;
    let removeExternalAbortListener: (() => void) | undefined;
    if (externalAbortSignal) {
      externalAbortSignal.throwIfAborted();
      const onExternalAbort = () => {
        this.abort(externalAbortSignal.reason);
      };
      removeExternalAbortListener = () =>
        externalAbortSignal.removeEventListener('abort', onExternalAbort);
      externalAbortSignal.addEventListener('abort', onExternalAbort);
    }

    const maybeRemoveExternalAbortListener = () => {
      removeExternalAbortListener?.();
    };

    let result: PromiseOrValue<ObjMap<unknown>>;
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

      result = this.executeCollectedRootFields(
        rootType,
        rootValue,
        groupedFieldSet,
        serially ?? operationType === OperationTypeNode.MUTATION,
        newDeferUsages,
      );

      if (isPromise(result)) {
        const promise = result.then(
          (data) => {
            maybeRemoveExternalAbortListener();
            return this.buildResponse(data);
          },
          (error: unknown) => {
            maybeRemoveExternalAbortListener();
            this.collectedErrors.add(ensureGraphQLError(error), undefined);
            return this.buildResponse(null);
          },
        );
        this.sharedExecutionContext.asyncWorkTracker.add(promise);
        const { promise: cancellablePromise, abort: abortResultPromise } =
          withCancellation(promise.then((resolved) => this.finish(resolved)));
        this.abortResultPromise = () => {
          abortResultPromise(this.createAbortedExecutionError(promise));
        };
        if (this.aborted) {
          this.abortResultPromise();
        }
        return cancellablePromise;
      }
      maybeRemoveExternalAbortListener();
    } catch (error) {
      maybeRemoveExternalAbortListener();
      this.collectedErrors.add(ensureGraphQLError(error), undefined);
      return this.finish(this.buildResponse(null));
    }
    return this.finish(this.buildResponse(result));
  }

  abort(reason?: unknown): void {
    if (this.aborted) {
      return;
    }
    this.aborted = true;
    if (reason !== undefined) {
      this.abortReason = reason;
    }
    this.abortResultPromise?.();
    this.resolverAbortController?.abort(this.abortReason);
  }

  finish<T>(result: T): T {
    if (this.aborted) {
      throw this.createAbortedExecutionError(result);
    }
    this.aborted = true;
    return result;
  }

  createAbortedExecutionError<T>(
    result: PromiseOrValue<T>,
  ): AbortedGraphQLExecutionError<T> {
    return new AbortedGraphQLExecutionError(this.abortReason, result);
  }

  getFinishSharedExecution(): () => void {
    const resolverAbortController = this.resolverAbortController;
    const asyncWorkFinishedHook =
      this.validatedExecutionArgs.hooks?.asyncWorkFinished;
    if (asyncWorkFinishedHook === undefined) {
      return () => resolverAbortController?.abort();
    }

    const validatedExecutionArgs = this.validatedExecutionArgs;
    const sharedExecutionContext = this.sharedExecutionContext;
    return () => {
      resolverAbortController?.abort();
      runAsyncWorkFinishedHook(
        validatedExecutionArgs,
        sharedExecutionContext,
        asyncWorkFinishedHook,
      );
    };
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   *
   * @internal
   */
  buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | TAlternativeInitialResponse {
    this.getFinishSharedExecution()();
    const errors = this.collectedErrors.errors;
    return errors.length ? { errors, data } : { data };
  }

  executeCollectedRootFields(
    rootType: GraphQLObjectType,
    rootValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    serially: boolean,
    _newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<ObjMap<unknown>> {
    return this.executeRootGroupedFieldSet(
      rootType,
      rootValue,
      originalGroupedFieldSet,
      serially,
      undefined,
    );
  }

  executeRootGroupedFieldSet(
    rootType: GraphQLObjectType,
    rootValue: unknown,
    groupedFieldSet: GroupedFieldSet,
    serially: boolean,
    positionContext?: TPositionContext,
  ): PromiseOrValue<ObjMap<unknown>> {
    return serially
      ? this.executeFieldsSerially(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          positionContext,
        )
      : this.executeFields(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          positionContext,
        );
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   *
   * @internal
   */
  executeFieldsSerially(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    positionContext: TPositionContext | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    return promiseReduce(
      groupedFieldSet,
      (results, [responseName, fieldDetailsList]) => {
        if (this.aborted) {
          throw new Error('Aborted!');
        }
        const fieldPath = addPath(path, responseName, parentType.name);
        const result = this.executeField(
          parentType,
          sourceValue,
          fieldDetailsList,
          fieldPath,
          positionContext,
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
   *
   * @internal
   */
  executeFields(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    positionContext: TPositionContext | undefined,
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
          positionContext,
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
        this.sharedExecutionContext.asyncWorkTracker.addValues(
          Object.values(results),
        );
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
    return promiseForObject(results, this.promiseAll);
  }

  /**
   * Implements the "Executing fields" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * coercing scalars, or execute the sub-selection-set for objects.
   *
   * @internal
   */
  executeField(
    parentType: GraphQLObjectType,
    source: unknown,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    positionContext: TPositionContext | undefined,
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

    const info = buildResolveInfo(
      validatedExecutionArgs,
      fieldDef,
      toNodes(fieldDetailsList),
      parentType,
      path,
      this.getAbortSignal,
      this.getAsyncHelpers,
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

      if (isPromiseLike(result)) {
        return this.completePromisedValue(
          returnType,
          fieldDetailsList,
          info,
          path,
          result,
          positionContext,
        );
      }

      const completed = this.completeValue(
        returnType,
        fieldDetailsList,
        info,
        path,
        result,
        positionContext,
      );

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError: unknown) => {
          this.handleFieldError(rawError, returnType, fieldDetailsList, path);
          return null;
        });
      }
      return completed;
    } catch (rawError) {
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
   *
   * @internal
   */
  completeValue(
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    positionContext: TPositionContext | undefined,
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
        positionContext,
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
        positionContext,
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
        positionContext,
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
        positionContext,
      );
      /* node:coverage ignore next 7 */
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
    info: GraphQLResolveInfo,
    path: Path,
    result: PromiseLike<unknown>,
    positionContext: TPositionContext | undefined,
  ): Promise<unknown> {
    try {
      const resolved = await result;
      if (this.aborted) {
        throw new Error('Aborted!');
      }
      let completed = this.completeValue(
        returnType,
        fieldDetailsList,
        info,
        path,
        resolved,
        positionContext,
      );

      if (isPromise(completed)) {
        completed = await completed;
      }
      return completed;
    } catch (rawError) {
      this.handleFieldError(rawError, returnType, fieldDetailsList, path);
      return null;
    }
  }

  /**
   * Complete a async iterator value by completing the result and calling
   * recursively until all the results are completed.
   *
   * @internal
   */
  async completeAsyncIterableValue(
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    items: AsyncIterable<unknown>,
    positionContext: TPositionContext | undefined,
  ): Promise<ReadonlyArray<unknown>> {
    // do not stream inner lists of multi-dimensional lists
    const streamUsage =
      typeof path.key === 'number'
        ? undefined
        : getStreamUsage(this.validatedExecutionArgs, fieldDetailsList);

    let containsPromise = false;
    const completedResults: Array<unknown> = [];
    const asyncIterator = items[Symbol.asyncIterator]();
    let index = 0;
    let iteration;
    try {
      while (true) {
        if (
          streamUsage?.initialCount === index &&
          this.handleStream(
            index,
            path,
            { handle: asyncIterator, isAsync: true },
            streamUsage,
            info,
            itemType,
          )
        ) {
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
        if (this.aborted || iteration.done) {
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
            positionContext,
          )
        ) {
          containsPromise = true;
        }
        index++;
      }
    } catch (error) {
      this.sharedExecutionContext.asyncWorkTracker.add(
        returnIteratorCatchingErrors(asyncIterator),
      );
      if (containsPromise) {
        this.sharedExecutionContext.asyncWorkTracker.addValues(
          completedResults,
        );
      }
      throw error;
    }

    // Throwing on completion outside of the loop may allow engines to better optimize
    if (this.aborted) {
      if (!iteration?.done) {
        this.sharedExecutionContext.asyncWorkTracker.add(
          returnIteratorCatchingErrors(asyncIterator),
        );
      }
      throw new Error('Aborted!');
    }

    return containsPromise
      ? this.promiseAll(completedResults)
      : completedResults;
  }

  /* node:coverage ignore next 12 */
  handleStream(
    _index: number,
    _path: Path,
    _iterator:
      | { handle: Iterator<unknown>; isAsync?: never }
      | { handle: AsyncIterator<unknown>; isAsync: true },
    _streamUsage: StreamUsage,
    _info: GraphQLResolveInfo,
    _itemType: GraphQLOutputType,
  ): boolean {
    return false;
  }

  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   *
   * @internal
   */
  completeListValue(
    returnType: GraphQLList<GraphQLOutputType>,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    positionContext: TPositionContext | undefined,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const itemType = returnType.ofType;

    if (isAsyncIterable(result)) {
      return this.completeAsyncIterableValue(
        itemType,
        fieldDetailsList,
        info,
        path,
        result,
        positionContext,
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
      positionContext,
    );
  }

  completeIterableValue(
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    items: Iterable<unknown>,
    positionContext: TPositionContext | undefined,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    // do not stream inner lists of multi-dimensional lists
    const streamUsage =
      typeof path.key === 'number'
        ? undefined
        : getStreamUsage(this.validatedExecutionArgs, fieldDetailsList);

    // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.
    let containsPromise = false;
    const completedResults: Array<unknown> = [];
    let index = 0;
    const iterator = items[Symbol.iterator]();
    try {
      while (true) {
        if (
          streamUsage?.initialCount === index &&
          this.handleStream(
            index,
            path,
            { handle: iterator },
            streamUsage,
            info,
            itemType,
          )
        ) {
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
            positionContext,
          )
        ) {
          containsPromise = true;
        }

        index++;
      }
    } catch (error) {
      const asyncWorkTracker = this.sharedExecutionContext.asyncWorkTracker;
      if (containsPromise) {
        asyncWorkTracker.addValues(completedResults);
      }
      asyncWorkTracker.addValues(collectIteratorPromises(iterator));
      throw error;
    }

    return containsPromise
      ? this.promiseAll(completedResults)
      : completedResults;
  }

  completeMaybePromisedListItemValue(
    item: unknown,
    completedResults: Array<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemPath: Path,
    positionContext: TPositionContext | undefined,
  ): boolean {
    if (isPromiseLike(item)) {
      completedResults.push(
        this.completePromisedListItemValue(
          item,
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          positionContext,
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
        positionContext,
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
   *
   * @internal
   */
  completeListItemValue(
    item: unknown,
    completedResults: Array<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemPath: Path,
    positionContext: TPositionContext | undefined,
  ): boolean {
    try {
      const completedItem = this.completeValue(
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        item,
        positionContext,
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
    item: PromiseLike<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemPath: Path,
    positionContext: TPositionContext | undefined,
  ): Promise<unknown> {
    try {
      const resolved = await item;
      if (this.aborted) {
        throw new Error('Aborted!');
      }
      let completed = this.completeValue(
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        resolved,
        positionContext,
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
   *
   * @internal
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
   *
   * @internal
   */
  completeAbstractValue(
    returnType: GraphQLAbstractType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    positionContext: TPositionContext | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    const validatedExecutionArgs = this.validatedExecutionArgs;
    const { schema, contextValue } = validatedExecutionArgs;
    const resolveTypeFn =
      returnType.resolveType ?? validatedExecutionArgs.typeResolver;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

    if (isPromiseLike(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) => {
        if (this.aborted) {
          throw new Error('Aborted!');
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
          positionContext,
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
      positionContext,
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
   *
   * @internal
   */
  completeObjectValue(
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    positionContext: TPositionContext | undefined,
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

      if (isPromiseLike(isTypeOf)) {
        return isTypeOf.then((resolvedIsTypeOf) => {
          if (this.aborted) {
            throw new Error('Aborted!');
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
            positionContext,
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
      positionContext,
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
    positionContext: TPositionContext | undefined,
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
      positionContext,
    );
  }

  executeCollectedSubfields(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    originalGroupedFieldSet: GroupedFieldSet,
    _newDeferUsages: ReadonlyArray<DeferUsage>,
    _positionContext: TPositionContext | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    return this.executeFields(
      parentType,
      sourceValue,
      path,
      originalGroupedFieldSet,
      undefined,
    );
  }
}

function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
