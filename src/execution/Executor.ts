import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isPromise } from '../jsutils/isPromise.js';
import { memoize2 } from '../jsutils/memoize2.js';
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
import { buildResolveInfo } from './execute.js';
import type { StreamUsage } from './getStreamUsage.js';
import { getStreamUsage as _getStreamUsage } from './getStreamUsage.js';
import { returnIteratorCatchingErrors } from './returnIteratorCatchingErrors.js';
import type { VariableValues } from './values.js';
import { getArgumentValues } from './values.js';

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
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
export const collectSubfields = memoize3(
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

export const getStreamUsage = memoize2(
  (
    validatedExecutionArgs: ValidatedExecutionArgs,
    fieldDetailsList: FieldDetailsList,
  ) => _getStreamUsage(validatedExecutionArgs, fieldDetailsList),
);

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

/** @internal */
export class Executor<
  TPositionContext = undefined, // No position context by default
  TAlternativeInitialResponse = ExecutionResult, // No alternative by default
> {
  validatedExecutionArgs: ValidatedExecutionArgs;
  finished: boolean;
  collectedErrors: CollectedErrors;
  internalAbortController: AbortController;
  resolverAbortController: AbortController | undefined;
  sharedResolverAbortSignal: AbortSignal;

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    sharedResolverAbortSignal?: AbortSignal,
  ) {
    this.validatedExecutionArgs = validatedExecutionArgs;
    this.finished = false;
    this.collectedErrors = new CollectedErrors();
    this.internalAbortController = new AbortController();

    if (sharedResolverAbortSignal === undefined) {
      this.resolverAbortController = new AbortController();
      this.sharedResolverAbortSignal = this.resolverAbortController.signal;
    } else {
      this.sharedResolverAbortSignal = sharedResolverAbortSignal;
    }
  }

  executeQueryOrMutationOrSubscriptionEvent(): PromiseOrValue<
    ExecutionResult | TAlternativeInitialResponse
  > {
    const externalAbortSignal = this.validatedExecutionArgs.externalAbortSignal;
    let removeExternalAbortListener: (() => void) | undefined;
    if (externalAbortSignal) {
      externalAbortSignal.throwIfAborted();
      const onExternalAbort = () => this.cancel(externalAbortSignal.reason);
      removeExternalAbortListener = () =>
        externalAbortSignal.removeEventListener('abort', onExternalAbort);
      externalAbortSignal.addEventListener('abort', onExternalAbort);
    }

    const onFinish = () => {
      this.finish();
      removeExternalAbortListener?.();
    };

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
            onFinish();
            return this.buildResponse(data);
          },
          (error: unknown) => {
            onFinish();
            this.collectedErrors.add(error as GraphQLError, undefined);
            return this.buildResponse(null);
          },
        );
        return cancellablePromise(promise, this.internalAbortController.signal);
      }
      onFinish();
      return this.buildResponse(result);
    } catch (error) {
      onFinish();
      this.collectedErrors.add(error as GraphQLError, undefined);
      return this.buildResponse(null);
    }
  }

  cancel(reason?: unknown): void {
    if (!this.finished) {
      this.finish();
      this.internalAbortController.abort(reason);
      this.resolverAbortController?.abort(reason);
    }
  }

  finish(): void {
    if (!this.finished) {
      this.finished = true;
    }
    this.internalAbortController.signal.throwIfAborted();
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | TAlternativeInitialResponse {
    this.resolverAbortController?.abort();
    const errors = this.collectedErrors.errors;
    return errors.length ? { errors, data } : { data };
  }

  executeCollectedRootFields(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    _newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<ObjMap<unknown>> {
    return this.executeRootGroupedFieldSet(
      operation,
      rootType,
      rootValue,
      originalGroupedFieldSet,
      undefined,
    );
  }

  executeRootGroupedFieldSet(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
    groupedFieldSet: GroupedFieldSet,
    positionContext?: TPositionContext,
  ): PromiseOrValue<ObjMap<unknown>> {
    switch (operation) {
      case OperationTypeNode.QUERY:
        return this.executeFields(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          positionContext,
        );
      case OperationTypeNode.MUTATION:
        return this.executeFieldsSerially(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          positionContext,
        );
      case OperationTypeNode.SUBSCRIPTION:
        // TODO: deprecate `subscribe` and move all logic here
        // Temporary solution until we finish merging execute and subscribe together
        return this.executeFields(
          rootType,
          rootValue,
          undefined,
          groupedFieldSet,
          positionContext,
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
    positionContext: TPositionContext | undefined,
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
      () => this.sharedResolverAbortSignal,
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
    info: GraphQLResolveInfo,
    path: Path,
    result: Promise<unknown>,
    positionContext: TPositionContext | undefined,
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
            positionContext,
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

  /* c8 ignore next 12 */
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
    info: GraphQLResolveInfo,
    itemPath: Path,
    positionContext: TPositionContext | undefined,
  ): boolean {
    if (isPromise(item)) {
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
    item: Promise<unknown>,
    itemType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemPath: Path,
    positionContext: TPositionContext | undefined,
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
    positionContext: TPositionContext | undefined,
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
