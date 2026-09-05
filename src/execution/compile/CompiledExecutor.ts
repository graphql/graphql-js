/** @category Execution */

/* eslint-disable max-params */

import { inspect } from '../../jsutils/inspect.ts';
import { invariant } from '../../jsutils/invariant.ts';
import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';
import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isPromise, isPromiseLike } from '../../jsutils/isPromise.ts';
import { memoize1 } from '../../jsutils/memoize1.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';
import { addPath, pathToArray } from '../../jsutils/Path.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import type { GraphQLError } from '../../error/GraphQLError.ts';
import { GraphQLError as GraphQLErrorClass } from '../../error/GraphQLError.ts';
import { locatedError } from '../../error/locatedError.ts';

import type { FieldNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';

import type {
  GraphQLAbstractType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLResolveInfoHelpers,
} from '../../type/definition.ts';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../../type/definition.ts';

import { AbortedGraphQLExecutionError } from '../AbortedGraphQLExecutionError.ts';
import { withCancellation } from '../cancellablePromise.ts';
import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from '../collectFields.ts';
import { collectIteratorPromises } from '../collectIteratorPromises.ts';
import type { SharedExecutionContext } from '../createSharedExecutionContext.ts';
import { createSharedExecutionContext } from '../createSharedExecutionContext.ts';
import type { ValidatedExecutionArgs } from '../ExecutionArgs.ts';
import type { StreamUsage } from '../getStreamUsage.ts';
import { runAsyncWorkFinishedHook } from '../hooks.ts';
import type { DeferUsageSet } from '../incremental/buildExecutionPlan.ts';
import { buildExecutionPlan } from '../incremental/buildExecutionPlan.ts';
import { Computation } from '../incremental/Computation.ts';
import type {
  DeliveryGroup,
  ExecutionGroupResult,
  ExecutionGroupValue,
  ExperimentalIncrementalExecutionResults,
  IncrementalWork,
  ItemStream,
  StreamItemResult,
  StreamItemValue,
} from '../incremental/IncrementalExecutor.ts';
import { IncrementalPublisher } from '../incremental/IncrementalPublisher.ts';
import { Queue } from '../incremental/Queue.ts';
import type { Task } from '../incremental/WorkQueue.ts';
import { returnIteratorCatchingErrors } from '../returnIteratorCatchingErrors.ts';

import type {
  CompiledExecutionRuntime,
  CompiledFieldExecutionPlan,
} from './compileFieldExecutionPlan.ts';
import { getCompiledDirectiveValues } from './getCompiledDirectiveValues.ts';

type ExecutionMode = 'throw' | 'incremental' | 'ignore';

type ExecutionGroup = Task<
  ExecutionGroupValue,
  StreamItemValue,
  DeliveryGroup,
  ItemStream
> & {
  path: Path | undefined;
};

type StreamItemCompleter = (
  executor: CompiledExecutor,
  itemPath: Path,
  item: unknown,
  index: number,
) => PromiseOrValue<StreamItemResult>;

type PreplannedExecutionGroupExecutor = (
  executor: CompiledExecutor,
  runner: CompiledExecutionRunner,
  source: unknown,
  target: ObjMap<unknown>,
  parentNullTarget: CompletionTarget,
  deliveryGroupMap: IncrementalPositionContext,
) => void;

interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

type RootBox<T = unknown> = ObjMap<unknown> & { data: T };

interface ObjectCompletionTarget {
  container: ObjMap<unknown>;
  key: string;
  path: Path | undefined;
}

interface ArrayCompletionTarget {
  container: Array<unknown>;
  key: number;
  path: Path | undefined;
}

type CompletionTarget = ObjectCompletionTarget | ArrayCompletionTarget;

interface StreamIterator {
  handle: Iterator<unknown>;
  isAsync?: never;
}

interface AsyncStreamIterator {
  handle: AsyncIterator<unknown>;
  isAsync: true;
}

type StreamIteratorHandle = StreamIterator | AsyncStreamIterator;

type IncrementalPositionContext =
  | ReadonlyMap<DeferUsage, DeliveryGroup>
  | undefined;

interface FieldSetJob {
  kind: 'FIELD_SET';
  parentType: GraphQLObjectType;
  source: unknown;
  path: Path | undefined;
  groupedFieldSet: GroupedFieldSet;
  target: ObjMap<unknown>;
  parentNullTarget: CompletionTarget;
  serially: boolean;
  newDeferUsages: ReadonlyArray<DeferUsage>;
  deliveryGroupMap: IncrementalPositionContext;
}

interface FieldJob {
  kind: 'FIELD';
  parentType: GraphQLObjectType;
  source: unknown;
  responseName: string;
  fieldDetailsList: FieldDetailsList;
  plan: CompiledFieldExecutionPlan;
  path: Path;
  target: ObjMap<unknown>;
  parentNullTarget: CompletionTarget;
  deliveryGroupMap: IncrementalPositionContext;
}

interface CompleteJob {
  kind: 'COMPLETE';
  returnType: GraphQLOutputType;
  fieldDetailsList: FieldDetailsList;
  info: GraphQLResolveInfo;
  path: Path;
  result: unknown;
  target: CompletionTarget;
  nullTarget: CompletionTarget;
  deliveryGroupMap: IncrementalPositionContext;
}

type Job = FieldSetJob | FieldJob | CompleteJob;

interface AsyncListRead {
  values: ReadonlyArray<unknown>;
  iterator: AsyncIterator<unknown>;
  nextIndex: number;
  done: boolean;
}

const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';

const defaultAbortReason = new Error('This operation was aborted');
const resolverAbortWithoutReason = Symbol('resolverAbortWithoutReason');

/** @internal */
export class CompiledExecutor<
  TMode extends ExecutionMode = ExecutionMode,
> implements CompiledExecutionRuntime {
  validatedExecutionArgs: ValidatedExecutionArgs;
  mode: TMode;
  deferUsageSet: DeferUsageSet | undefined;
  aborted: boolean;
  abortReason: unknown;
  abortResultPromise: (() => void) | undefined;
  resolverAbortController: AbortController | undefined;
  private _getAbortSignal: (() => AbortSignal | undefined) | undefined;
  private _getAsyncHelpers: (() => GraphQLResolveInfoHelpers) | undefined;
  private _collectedErrors: CollectedErrors | undefined;
  private _sharedExecutionContext: SharedExecutionContext | undefined;
  private _groups: Array<DeliveryGroup> | undefined;
  private _tasks: Array<ExecutionGroup> | undefined;
  private _streams: Array<ItemStream> | undefined;
  private _resolverAbortReason: unknown;
  private _resolverAbortFinished: boolean;

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    mode: TMode,
    sharedExecutionContext?: SharedExecutionContext,
    deferUsageSet?: DeferUsageSet,
  ) {
    this.validatedExecutionArgs = validatedExecutionArgs;
    this.mode = mode;
    this.deferUsageSet = deferUsageSet;
    this.aborted = false;
    this.abortReason = defaultAbortReason;
    this._resolverAbortReason = resolverAbortWithoutReason;
    this._resolverAbortFinished = false;
    this._sharedExecutionContext = sharedExecutionContext;
  }

  get getAbortSignal(): () => AbortSignal | undefined {
    return (this._getAbortSignal ??= () =>
      this.sharedExecutionContext.getAbortSignal());
  }

  get getAsyncHelpers(): () => GraphQLResolveInfoHelpers {
    return (this._getAsyncHelpers ??= () =>
      this.sharedExecutionContext.getAsyncHelpers());
  }

  get collectedErrors(): CollectedErrors {
    return (this._collectedErrors ??= new CollectedErrors());
  }

  get sharedExecutionContext(): SharedExecutionContext {
    return (this._sharedExecutionContext ??= createSharedExecutionContext(() =>
      this.getResolverAbortSignal(),
    ));
  }

  get groups(): Array<DeliveryGroup> {
    return (this._groups ??= []);
  }

  get tasks(): Array<ExecutionGroup> {
    return (this._tasks ??= []);
  }

  get streams(): Array<ItemStream> {
    return (this._streams ??= []);
  }

  applyNulledTargets(): void {
    this._collectedErrors?.applyNulledTargets();
  }

  finishAsyncRootExecution(
    completed: Promise<void>,
    rootBox: RootBox<ObjMap<unknown> | null>,
    maybeRemoveExternalAbortListener?: () => void,
  ): Promise<ExecutionResult | ExperimentalIncrementalExecutionResults> {
    const promise = completed.then(
      () => {
        maybeRemoveExternalAbortListener?.();
        return this.finish(this.buildResponse(rootBox.data));
      },
      (error: unknown) => {
        maybeRemoveExternalAbortListener?.();
        this.collectedErrors.add(ensureGraphQLError(error), undefined);
        return this.finish(this.buildResponse(null));
      },
    );
    if (this.validatedExecutionArgs.hooks?.asyncWorkFinished !== undefined) {
      this.sharedExecutionContext.asyncWorkTracker.add(promise);
    }
    if (this.validatedExecutionArgs.externalAbortSignal === undefined) {
      return promise;
    }
    const { promise: cancellablePromise, abort } = withCancellation(promise);
    this.abortResultPromise = () => {
      abort(this.createAbortedExecutionError(promise));
    };
    if (this.aborted) {
      this.abortResultPromise();
    }
    return cancellablePromise;
  }

  abort(reason?: unknown): void {
    this.aborted = true;
    if (reason !== undefined) {
      this.abortReason = reason;
    }
    this.abortResultPromise?.();
    this.abortResolverSignal(this.abortReason);
    const tasks = this._tasks;
    if (tasks !== undefined) {
      for (const task of tasks) {
        const aborted = task.computation.abort(reason);
        invariant(!isPromise(aborted));
      }
    }
    const streams = this._streams;
    if (streams !== undefined) {
      for (const stream of streams) {
        const aborted = stream.queue.abort(reason);
        invariant(!isPromise(aborted));
      }
    }
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

  buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | ExperimentalIncrementalExecutionResults {
    if (this.mode === 'incremental' && data !== null) {
      const work = this.getIncrementalWork();
      const hasIncrementalWork =
        (work.tasks?.length ?? 0) > 0 || (work.streams?.length ?? 0) > 0;
      if (!hasIncrementalWork) {
        this.finishSharedExecution();
        const errors = this._collectedErrors?.errors ?? emptyCollectedErrors;
        return errors.length ? { errors, data } : { data };
      }
      const errors = this._collectedErrors?.errors ?? emptyCollectedErrors;
      return new IncrementalPublisher().buildResponse(
        data,
        errors,
        work,
        this.validatedExecutionArgs.externalAbortSignal,
        this.getFinishSharedExecution(),
      );
    }

    this.finishSharedExecution();
    const errors = this._collectedErrors?.errors ?? emptyCollectedErrors;
    return errors.length ? { errors, data } : { data };
  }

  getFinishSharedExecution(): () => void {
    const asyncWorkFinishedHook =
      this.validatedExecutionArgs.hooks?.asyncWorkFinished;
    if (asyncWorkFinishedHook === undefined) {
      return () => {
        this.abortResolverSignal();
      };
    }

    const sharedExecutionContext = this.sharedExecutionContext;
    return () => {
      this.abortResolverSignal();
      runAsyncWorkFinishedHook(
        this.validatedExecutionArgs,
        sharedExecutionContext,
        asyncWorkFinishedHook,
      );
    };
  }

  finishSharedExecution(): void {
    const asyncWorkFinishedHook =
      this.validatedExecutionArgs.hooks?.asyncWorkFinished;
    this.abortResolverSignal();
    if (asyncWorkFinishedHook !== undefined) {
      runAsyncWorkFinishedHook(
        this.validatedExecutionArgs,
        this.sharedExecutionContext,
        asyncWorkFinishedHook,
      );
    }
  }

  handleLeafFieldError(
    rawError: unknown,
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    fieldPath: Path,
    target: ObjMap<unknown>,
    responseName: string,
    parentNullTarget: CompletionTarget,
  ): void {
    const fieldTarget: CompletionTarget = {
      container: target,
      key: responseName,
      path: fieldPath,
    };
    this.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      this.getNullableTarget(returnType, fieldTarget, parentNullTarget),
    );
  }

  getNullableTarget(
    returnType: GraphQLOutputType,
    ownTarget: CompletionTarget,
    parentNullTarget: CompletionTarget,
  ): CompletionTarget {
    return isNonNullType(returnType) ? parentNullTarget : ownTarget;
  }

  handleCompletionError(
    rawError: unknown,
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    ownTarget: CompletionTarget,
    nullTarget: CompletionTarget,
  ): void {
    const error = locatedError(
      rawError,
      toNodes(fieldDetailsList),
      pathToArray(path),
    );
    const target =
      this.validatedExecutionArgs.errorPropagation && isNonNullType(returnType)
        ? nullTarget
        : ownTarget;
    this.collectedErrors.add(error, target.path, target);
  }

  ensureValidRuntimeType(
    runtimeTypeName: unknown,
    returnType: GraphQLAbstractType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    result: unknown,
  ): GraphQLObjectType {
    if (runtimeTypeName == null) {
      throw new GraphQLErrorClass(
        `Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}". Either the "${returnType}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        { nodes: toNodes(fieldDetailsList) },
      );
    }
    if (typeof runtimeTypeName !== 'string') {
      throw new GraphQLErrorClass(
        `Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}" with ` +
          `value ${inspect(result)}, received "${inspect(
            runtimeTypeName,
          )}", which is not a valid Object type name.`,
      );
    }
    const runtimeType =
      this.validatedExecutionArgs.schema.getType(runtimeTypeName);
    if (runtimeType == null) {
      throw new GraphQLErrorClass(
        `Abstract type "${returnType}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        { nodes: toNodes(fieldDetailsList) },
      );
    }
    if (!isObjectType(runtimeType)) {
      throw new GraphQLErrorClass(
        `Abstract type "${returnType}" was resolved to a non-object type "${runtimeTypeName}".`,
        { nodes: toNodes(fieldDetailsList) },
      );
    }
    if (
      !this.validatedExecutionArgs.schema.isSubType(returnType, runtimeType)
    ) {
      throw new GraphQLErrorClass(
        `Runtime Object type "${runtimeType}" is not a possible type for "${returnType}".`,
        { nodes: toNodes(fieldDetailsList) },
      );
    }
    return runtimeType;
  }

  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldDetailsList: FieldDetailsList,
  ): GraphQLError {
    return new GraphQLErrorClass(
      `Expected value of type "${returnType}" but got: ${inspect(result)}.`,
      { nodes: toNodes(fieldDetailsList) },
    );
  }

  getIncrementalWork(): IncrementalWork {
    const groups = this._groups;
    const tasks = this._tasks;
    const streams = this._streams;
    const collectedErrors = this._collectedErrors;
    if (collectedErrors === undefined || collectedErrors.errors.length === 0) {
      const work: IncrementalWork = {};
      if (groups !== undefined) {
        work.groups = groups;
      }
      if (tasks !== undefined) {
        work.tasks = tasks;
      }
      if (streams !== undefined) {
        work.streams = streams;
      }
      return work;
    }

    const cancellationReason = new Error(
      'Cancelled secondary to null within original result',
    );
    const filteredTasks: Array<ExecutionGroup> = [];
    const filteredStreams: Array<ItemStream> = [];

    if (tasks !== undefined) {
      for (const task of tasks) {
        if (collectedErrors.hasNulledPosition(task.path)) {
          const aborted = task.computation.abort(cancellationReason);
          invariant(!isPromise(aborted));
        } else {
          filteredTasks.push(task);
        }
      }
    }

    if (streams !== undefined) {
      for (const stream of streams) {
        if (collectedErrors.hasNulledPosition(stream.path)) {
          const aborted = stream.queue.abort(cancellationReason);
          invariant(!isPromise(aborted));
        } else {
          filteredStreams.push(stream);
        }
      }
    }

    const work: IncrementalWork = {};
    if (groups !== undefined) {
      work.groups = groups;
    }
    if (tasks !== undefined) {
      work.tasks = filteredTasks;
    }
    if (streams !== undefined) {
      work.streams = filteredStreams;
    }
    return work;
  }

  throwUnexpectedIncremental(): never {
    const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    this.abort(reason);
    throw reason;
  }

  executeRootSelectionSet(
    this: CompiledExecutor<'throw'> | CompiledExecutor<'ignore'>,
    serially?: boolean,
  ): PromiseOrValue<ExecutionResult>;
  executeRootSelectionSet(
    this: CompiledExecutor<'incremental'>,
    serially?: boolean,
  ): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults>;
  executeRootSelectionSet(
    serially?: boolean,
  ): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
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

    const rootBox: RootBox<ObjMap<unknown> | null> = {
      data: Object.create(null),
    };
    try {
      const { schema, rootValue, operation, variableValues } =
        this.validatedExecutionArgs;
      const operationType = operation.operation;
      const rootType = schema.getRootType(operationType);
      if (rootType == null) {
        throw new GraphQLErrorClass(
          `Schema is not configured to execute ${operationType} operation.`,
          { nodes: operation },
        );
      }

      const { groupedFieldSet, newDeferUsages } =
        this.validatedExecutionArgs.fieldCollectors.collectRootFields(
          variableValues,
          rootType,
        );

      const data = Object.create(null);
      rootBox.data = data;
      const shouldExecuteSerially =
        serially ?? operationType === OperationTypeNode.MUTATION;
      const runner = new WorkQueueExecutionRunner(this);
      runner.enqueue({
        kind: 'FIELD_SET',
        parentType: rootType,
        source: rootValue,
        path: undefined,
        groupedFieldSet,
        target: data,
        parentNullTarget: {
          container: rootBox,
          key: 'data',
          path: undefined,
        },
        serially: shouldExecuteSerially,
        newDeferUsages,
        deliveryGroupMap: undefined,
      });
      const completed = runner.runUntilNulled(undefined);
      if (completed !== undefined) {
        return this.finishAsyncRootExecution(
          completed,
          rootBox,
          removeExternalAbortListener,
        );
      }
      removeExternalAbortListener?.();
    } catch (error) {
      removeExternalAbortListener?.();
      this.collectedErrors.add(ensureGraphQLError(error), undefined);
      return this.finish(this.buildResponse(null));
    }
    return this.finish(this.buildResponse(rootBox.data));
  }

  executeLeafField(
    parentType: GraphQLObjectType,
    source: unknown,
    path: Path | undefined,
    responseName: string,
    fieldDetailsList: FieldDetailsList,
    plan: CompiledFieldExecutionPlan,
    leafType: GraphQLLeafType,
    target: ObjMap<unknown>,
    parentNullTarget: CompletionTarget,
    runner: WorkQueueExecutionRunner,
  ): void {
    const fieldPath = addPath(path, responseName, parentType.name);
    let result: unknown;
    try {
      result = plan.resolveFieldValue(
        this,
        parentType,
        source,
        fieldDetailsList,
        fieldPath,
      );
    } catch (rawError) {
      const fieldTarget: CompletionTarget = {
        container: target,
        key: responseName,
        path: fieldPath,
      };
      this.handleCompletionError(
        rawError,
        plan.returnType,
        fieldDetailsList,
        fieldPath,
        fieldTarget,
        this.getNullableTarget(plan.returnType, fieldTarget, parentNullTarget),
      );
      return;
    }

    if (isPromiseLike(result)) {
      target[responseName] = undefined;
      const fieldTarget: CompletionTarget = {
        container: target,
        key: responseName,
        path: fieldPath,
      };
      const nullTarget = this.getNullableTarget(
        plan.returnType,
        fieldTarget,
        parentNullTarget,
      );
      runner.awaitValue(
        result,
        (resolved) => {
          this.completeLeafResult(
            leafType,
            plan.completedNonNull,
            plan.returnType,
            resolved,
            fieldDetailsList,
            parentType,
            plan.fieldDef.name,
            fieldPath,
            fieldTarget,
            nullTarget,
          );
        },
        (rawError: unknown) => {
          this.handleCompletionError(
            rawError,
            plan.returnType,
            fieldDetailsList,
            fieldPath,
            fieldTarget,
            nullTarget,
          );
        },
        fieldPath,
      );
      return;
    }

    this.completeSynchronousLeafField(
      leafType,
      plan.completedNonNull,
      plan.returnType,
      plan.fieldDef.name,
      target,
      responseName,
      parentNullTarget,
      parentType,
      fieldPath,
      fieldDetailsList,
      result,
    );
  }

  completeSynchronousLeafField(
    leafType: GraphQLLeafType,
    completedNonNull: boolean,
    returnType: GraphQLOutputType,
    fieldName: string,
    target: ObjMap<unknown>,
    responseName: string,
    parentNullTarget: CompletionTarget,
    parentType: GraphQLObjectType,
    fieldPath: Path,
    fieldDetailsList: FieldDetailsList,
    result: unknown,
  ): void {
    if (result == null) {
      if (completedNonNull && this.validatedExecutionArgs.errorPropagation) {
        this.handleLeafFieldError(
          new Error(
            `Cannot return null for non-nullable field ${parentType}.${fieldName}.`,
          ),
          returnType,
          fieldDetailsList,
          fieldPath,
          target,
          responseName,
          parentNullTarget,
        );
      } else {
        target[responseName] = null;
      }
      return;
    }

    if (result instanceof Error) {
      this.handleLeafFieldError(
        result,
        returnType,
        fieldDetailsList,
        fieldPath,
        target,
        responseName,
        parentNullTarget,
      );
      return;
    }
    try {
      const coerced = leafType.coerceOutputValue(result);
      if (coerced == null) {
        throw new Error(
          `Expected \`${inspect(leafType)}.coerceOutputValue(${inspect(result)})\` to ` +
            `return non-nullable value, returned: ${inspect(coerced)}`,
        );
      }
      target[responseName] = coerced;
    } catch (rawError) {
      this.handleLeafFieldError(
        rawError,
        returnType,
        fieldDetailsList,
        fieldPath,
        target,
        responseName,
        parentNullTarget,
      );
    }
  }

  completeLeafResult(
    leafType: GraphQLLeafType,
    completedNonNull: boolean,
    returnType: GraphQLOutputType,
    result: unknown,
    fieldDetailsList: FieldDetailsList,
    parentType: GraphQLObjectType,
    fieldName: string,
    path: Path,
    target: CompletionTarget,
    nullTarget: CompletionTarget,
  ): void {
    if (result instanceof Error) {
      this.handleCompletionError(
        result,
        returnType,
        fieldDetailsList,
        path,
        target,
        nullTarget,
      );
      return;
    }

    if (result == null) {
      if (completedNonNull && this.validatedExecutionArgs.errorPropagation) {
        this.handleCompletionError(
          new Error(
            `Cannot return null for non-nullable field ${parentType}.${fieldName}.`,
          ),
          returnType,
          fieldDetailsList,
          path,
          target,
          nullTarget,
        );
      } else {
        setTarget(target, null);
      }
      return;
    }
    try {
      const coerced = leafType.coerceOutputValue(result);
      if (coerced == null) {
        throw new Error(
          `Expected \`${inspect(leafType)}.coerceOutputValue(${inspect(result)})\` to ` +
            `return non-nullable value, returned: ${inspect(coerced)}`,
        );
      }
      setTarget(target, coerced);
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        returnType,
        fieldDetailsList,
        path,
        target,
        nullTarget,
      );
    }
  }

  executeObjectFieldWithoutIsTypeOf(
    parentType: GraphQLObjectType,
    source: unknown,
    path: Path | undefined,
    responseName: string,
    fieldDetailsList: FieldDetailsList,
    plan: CompiledFieldExecutionPlan,
    objectType: GraphQLObjectType,
    target: ObjMap<unknown>,
    parentNullTarget: CompletionTarget,
    deliveryGroupMap: IncrementalPositionContext,
    runner: WorkQueueExecutionRunner,
  ): void {
    const fieldPath = addPath(path, responseName, parentType.name);
    const fieldTarget: CompletionTarget = {
      container: target,
      key: responseName,
      path: fieldPath,
    };
    const nullTarget = this.getNullableTarget(
      plan.returnType,
      fieldTarget,
      parentNullTarget,
    );

    let result: unknown;
    try {
      result = plan.resolveFieldValue(
        this,
        parentType,
        source,
        fieldDetailsList,
        fieldPath,
      );
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        plan.returnType,
        fieldDetailsList,
        fieldPath,
        fieldTarget,
        nullTarget,
      );
      return;
    }

    if (isPromiseLike(result)) {
      target[responseName] = undefined;
      runner.awaitValue(
        result,
        (resolved) => {
          this.completeObjectFieldWithoutIsTypeOf(
            plan.returnType,
            objectType,
            plan.completedNonNull,
            resolved,
            fieldDetailsList,
            fieldPath,
            fieldTarget,
            nullTarget,
            deliveryGroupMap,
            runner,
            parentType,
            plan.fieldDef.name,
          );
        },
        (rawError) => {
          this.handleCompletionError(
            rawError,
            plan.returnType,
            fieldDetailsList,
            fieldPath,
            fieldTarget,
            nullTarget,
          );
        },
        nullTarget.path,
      );
      return;
    }

    this.completeObjectFieldWithoutIsTypeOf(
      plan.returnType,
      objectType,
      plan.completedNonNull,
      result,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
      deliveryGroupMap,
      runner,
      parentType,
      plan.fieldDef.name,
    );
  }

  processFieldSet(job: FieldSetJob, runner: WorkQueueExecutionRunner): void {
    if (this.aborted) {
      throw new Error('Aborted!');
    }

    let groupedFieldSet = job.groupedFieldSet;
    let deliveryGroupMap = job.deliveryGroupMap;
    const newDeferUsages = job.newDeferUsages;

    if (this.mode === 'throw' && newDeferUsages.length > 0) {
      this.throwUnexpectedIncremental();
    }

    if (
      this.mode === 'incremental' &&
      (newDeferUsages.length > 0 || deliveryGroupMap !== undefined)
    ) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      );
      const newDelivery = this.getNewDeliveryGroupMap(
        newDeferUsages,
        deliveryGroupMap,
        job.path,
      );
      deliveryGroupMap = newDelivery.newDeliveryGroupMap;
      this.groups.push(...newDelivery.newDeliveryGroups);

      const plan =
        this.deferUsageSet === undefined
          ? buildExecutionPlan(groupedFieldSet)
          : buildExecutionPlan(groupedFieldSet, this.deferUsageSet);
      groupedFieldSet = plan.groupedFieldSet;
      if (plan.newGroupedFieldSets.size > 0) {
        this.collectExecutionGroups(
          job.parentType,
          job.source,
          job.path,
          plan.newGroupedFieldSets,
          deliveryGroupMap,
        );
      }
    }

    if (job.serially) {
      const entries = Array.from(groupedFieldSet);
      const executableEntries: Array<
        [string, FieldDetailsList, CompiledFieldExecutionPlan]
      > = [];
      for (const [responseName, fieldDetailsList] of entries) {
        const plan = getCompiledFieldPlan(fieldDetailsList);
        if (plan !== undefined) {
          executableEntries.push([responseName, fieldDetailsList, plan]);
        }
      }
      this.executeSerialFields(
        job,
        executableEntries,
        deliveryGroupMap,
        runner,
      );
      return;
    }

    for (const [responseName, fieldDetailsList] of groupedFieldSet) {
      const plan = getCompiledFieldPlan(fieldDetailsList);
      if (plan === undefined) {
        continue;
      }
      if (plan.leafType !== undefined) {
        this.executeLeafField(
          job.parentType,
          job.source,
          job.path,
          responseName,
          fieldDetailsList,
          plan,
          plan.leafType,
          job.target,
          job.parentNullTarget,
          runner,
        );
      } else if (
        isObjectType(plan.nullableReturnType) &&
        plan.nullableReturnType.isTypeOf === undefined
      ) {
        this.executeObjectFieldWithoutIsTypeOf(
          job.parentType,
          job.source,
          job.path,
          responseName,
          fieldDetailsList,
          plan,
          plan.nullableReturnType,
          job.target,
          job.parentNullTarget,
          deliveryGroupMap,
          runner,
        );
      } else {
        job.target[responseName] = undefined;
        runner.enqueue({
          kind: 'FIELD',
          parentType: job.parentType,
          source: job.source,
          responseName,
          fieldDetailsList,
          plan,
          path: addPath(job.path, responseName, job.parentType.name),
          target: job.target,
          parentNullTarget: job.parentNullTarget,
          deliveryGroupMap,
        });
      }
    }
  }

  processField(job: FieldJob, runner: WorkQueueExecutionRunner): void {
    if (this.aborted) {
      throw new Error('Aborted!');
    }

    const plan = job.plan;
    const fieldDef = plan.fieldDef;
    const returnType = fieldDef.type;
    const fieldTarget: CompletionTarget = {
      container: job.target,
      key: job.responseName,
      path: job.path,
    };
    const nullTarget = this.getNullableTarget(
      returnType,
      fieldTarget,
      job.parentNullTarget,
    );

    let info: GraphQLResolveInfo | undefined;
    let result: unknown;
    try {
      const resolved = plan.resolveField(
        this,
        job.parentType,
        job.source,
        job.fieldDetailsList,
        job.path,
      );
      info = resolved.info;
      result = resolved.result;
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        returnType,
        job.fieldDetailsList,
        job.path,
        fieldTarget,
        nullTarget,
      );
      return;
    }

    const getInfoForCompletion = () => {
      if (info !== undefined) {
        return info;
      }
      info = plan.buildResolveInfo(
        this,
        job.parentType,
        job.fieldDetailsList,
        job.path,
      );
      return info;
    };

    const nullableReturnType = plan.nullableReturnType;
    const completedNonNull = plan.completedNonNull;

    if (isPromiseLike(result)) {
      if (
        isObjectType(nullableReturnType) &&
        nullableReturnType.isTypeOf === undefined
      ) {
        runner.awaitValue(
          result,
          (resolved) => {
            this.completeObjectFieldWithoutIsTypeOf(
              returnType,
              nullableReturnType,
              completedNonNull,
              resolved,
              job.fieldDetailsList,
              job.path,
              fieldTarget,
              nullTarget,
              job.deliveryGroupMap,
              runner,
              job.parentType,
              fieldDef.name,
            );
          },
          (rawError) => {
            this.handleCompletionError(
              rawError,
              returnType,
              job.fieldDetailsList,
              job.path,
              fieldTarget,
              nullTarget,
            );
          },
          nullTarget.path,
        );
      } else {
        const completionInfo = getInfoForCompletion();
        runner.awaitValue(
          result,
          (resolved) => {
            runner.enqueue({
              kind: 'COMPLETE',
              returnType,
              fieldDetailsList: job.fieldDetailsList,
              info: completionInfo,
              path: job.path,
              result: resolved,
              target: fieldTarget,
              nullTarget,
              deliveryGroupMap: job.deliveryGroupMap,
            });
          },
          (rawError) => {
            this.handleCompletionError(
              rawError,
              returnType,
              job.fieldDetailsList,
              job.path,
              fieldTarget,
              nullTarget,
            );
          },
          nullTarget.path,
        );
      }
      return;
    }

    if (
      isObjectType(nullableReturnType) &&
      nullableReturnType.isTypeOf === undefined
    ) {
      this.completeObjectFieldWithoutIsTypeOf(
        returnType,
        nullableReturnType,
        completedNonNull,
        result,
        job.fieldDetailsList,
        job.path,
        fieldTarget,
        nullTarget,
        job.deliveryGroupMap,
        runner,
        job.parentType,
        fieldDef.name,
      );
      return;
    }

    runner.enqueue({
      kind: 'COMPLETE',
      returnType,
      fieldDetailsList: job.fieldDetailsList,
      info: getInfoForCompletion(),
      path: job.path,
      result,
      target: fieldTarget,
      nullTarget,
      deliveryGroupMap: job.deliveryGroupMap,
    });
  }

  completeObjectFieldWithoutIsTypeOf(
    returnType: GraphQLOutputType,
    objectType: GraphQLObjectType,
    completedNonNull: boolean,
    result: unknown,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    fieldTarget: CompletionTarget,
    nullTarget: CompletionTarget,
    deliveryGroupMap: IncrementalPositionContext,
    runner: WorkQueueExecutionRunner,
    parentType: GraphQLObjectType,
    fieldName: string,
  ): void {
    if (result instanceof Error) {
      this.handleCompletionError(
        result,
        returnType,
        fieldDetailsList,
        path,
        fieldTarget,
        nullTarget,
      );
      return;
    }

    if (result == null) {
      if (completedNonNull && this.validatedExecutionArgs.errorPropagation) {
        this.handleCompletionError(
          new Error(
            `Cannot return null for non-nullable field ${parentType}.${fieldName}.`,
          ),
          returnType,
          fieldDetailsList,
          path,
          fieldTarget,
          nullTarget,
        );
      } else {
        setTarget(fieldTarget, null);
      }
      return;
    }

    const object = Object.create(null);
    setTarget(fieldTarget, object);
    const { groupedFieldSet, newDeferUsages } =
      this.validatedExecutionArgs.fieldCollectors.collectSubfields(
        this.validatedExecutionArgs.variableValues,
        objectType,
        fieldDetailsList,
      );
    runner.enqueue({
      kind: 'FIELD_SET',
      parentType: objectType,
      source: result,
      path,
      groupedFieldSet,
      target: object,
      parentNullTarget: nullTarget,
      serially: false,
      newDeferUsages,
      deliveryGroupMap,
    });
  }

  processComplete(job: CompleteJob, runner: WorkQueueExecutionRunner): void {
    if (this.aborted) {
      throw new Error('Aborted!');
    }

    let returnType = job.returnType;
    let completedNonNull = false;
    while (isNonNullType(returnType)) {
      completedNonNull = true;
      returnType = returnType.ofType;
    }

    const result = job.result;
    if (isPromiseLike(result)) {
      runner.awaitValue(
        result,
        (resolved) => {
          runner.enqueue({
            kind: 'COMPLETE',
            returnType: job.returnType,
            fieldDetailsList: job.fieldDetailsList,
            info: job.info,
            path: job.path,
            result: resolved,
            target: job.target,
            nullTarget: job.nullTarget,
            deliveryGroupMap: job.deliveryGroupMap,
          });
        },
        (rawError) => {
          this.handleCompletionError(
            rawError,
            job.returnType,
            job.fieldDetailsList,
            job.path,
            job.target,
            job.nullTarget,
          );
        },
        job.nullTarget.path,
      );
      return;
    }

    if (result instanceof Error) {
      this.handleCompletionError(
        result,
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
      return;
    }

    if (result == null) {
      if (completedNonNull && this.validatedExecutionArgs.errorPropagation) {
        this.handleCompletionError(
          new Error(
            `Cannot return null for non-nullable field ${job.info.parentType}.${job.info.fieldName}.`,
          ),
          job.returnType,
          job.fieldDetailsList,
          job.path,
          job.target,
          job.nullTarget,
        );
      } else {
        setTarget(job.target, null);
      }
      return;
    }

    if (isLeafType(returnType)) {
      this.completeLeafInto(returnType, result, job);
      return;
    }

    if (isListType(returnType)) {
      this.completeListInto(returnType, result, job, runner);
      return;
    }

    if (isAbstractType(returnType)) {
      this.completeAbstractInto(returnType, result, job, runner);
      return;
    }
    this.completeObjectInto(returnType, result, job, runner);
  }

  completeLeafInto(
    returnType: GraphQLLeafType,
    result: unknown,
    job: CompleteJob,
  ): void {
    try {
      const coerced = returnType.coerceOutputValue(result);
      if (coerced == null) {
        throw new Error(
          `Expected \`${inspect(returnType)}.coerceOutputValue(${inspect(result)})\` to ` +
            `return non-nullable value, returned: ${inspect(coerced)}`,
        );
      }
      setTarget(job.target, coerced);
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
    }
  }

  completeObjectInto(
    returnType: GraphQLObjectType,
    result: unknown,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
  ): void {
    if (returnType.isTypeOf) {
      let isTypeOf: unknown;
      try {
        isTypeOf = returnType.isTypeOf(
          result,
          this.validatedExecutionArgs.contextValue,
          job.info,
        );
      } catch (rawError) {
        this.handleCompletionError(
          rawError,
          job.returnType,
          job.fieldDetailsList,
          job.path,
          job.target,
          job.nullTarget,
        );
        return;
      }

      if (isPromiseLike(isTypeOf)) {
        runner.awaitValue(
          isTypeOf,
          (resolvedIsTypeOf) => {
            if (resolvedIsTypeOf !== true) {
              this.handleCompletionError(
                this.invalidReturnTypeError(
                  returnType,
                  result,
                  job.fieldDetailsList,
                ),
                job.returnType,
                job.fieldDetailsList,
                job.path,
                job.target,
                job.nullTarget,
              );
              return;
            }
            this.enqueueObjectSubfields(returnType, result, job, runner);
          },
          (rawError) => {
            this.handleCompletionError(
              rawError,
              job.returnType,
              job.fieldDetailsList,
              job.path,
              job.target,
              job.nullTarget,
            );
          },
          job.nullTarget.path,
        );
        return;
      }

      if (isTypeOf !== true) {
        this.handleCompletionError(
          this.invalidReturnTypeError(returnType, result, job.fieldDetailsList),
          job.returnType,
          job.fieldDetailsList,
          job.path,
          job.target,
          job.nullTarget,
        );
        return;
      }
    }

    this.enqueueObjectSubfields(returnType, result, job, runner);
  }

  enqueueObjectSubfields(
    returnType: GraphQLObjectType,
    result: unknown,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
  ): void {
    const object = Object.create(null);
    setTarget(job.target, object);
    const { groupedFieldSet, newDeferUsages } =
      this.validatedExecutionArgs.fieldCollectors.collectSubfields(
        this.validatedExecutionArgs.variableValues,
        returnType,
        job.fieldDetailsList,
      );
    runner.enqueue({
      kind: 'FIELD_SET',
      parentType: returnType,
      source: result,
      path: job.path,
      groupedFieldSet,
      target: object,
      parentNullTarget: job.nullTarget,
      serially: false,
      newDeferUsages,
      deliveryGroupMap: job.deliveryGroupMap,
    });
  }

  completeAbstractInto(
    returnType: GraphQLAbstractType,
    result: unknown,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
  ): void {
    const resolveTypeFn =
      returnType.resolveType ?? this.validatedExecutionArgs.typeResolver;
    let runtimeTypeName: unknown;
    try {
      runtimeTypeName = resolveTypeFn(
        result,
        this.validatedExecutionArgs.contextValue,
        job.info,
        returnType,
      );
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
      return;
    }

    if (isPromiseLike(runtimeTypeName)) {
      runner.awaitValue(
        runtimeTypeName,
        (resolvedRuntimeTypeName) => {
          if (this.aborted) {
            throw new Error('Aborted!');
          }
          let runtimeType: GraphQLObjectType;
          try {
            runtimeType = this.ensureValidRuntimeType(
              resolvedRuntimeTypeName,
              returnType,
              job.fieldDetailsList,
              job.info,
              result,
            );
          } catch (rawError) {
            this.handleCompletionError(
              rawError,
              job.returnType,
              job.fieldDetailsList,
              job.path,
              job.target,
              job.nullTarget,
            );
            return;
          }
          this.completeObjectInto(runtimeType, result, job, runner);
        },
        (rawError) => {
          this.handleCompletionError(
            rawError,
            job.returnType,
            job.fieldDetailsList,
            job.path,
            job.target,
            job.nullTarget,
          );
        },
        job.nullTarget.path,
      );
      return;
    }

    let runtimeType: GraphQLObjectType;
    try {
      runtimeType = this.ensureValidRuntimeType(
        runtimeTypeName,
        returnType,
        job.fieldDetailsList,
        job.info,
        result,
      );
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
      return;
    }
    this.completeObjectInto(runtimeType, result, job, runner);
  }

  completeListInto(
    returnType: GraphQLList<GraphQLOutputType>,
    result: unknown,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
  ): void {
    const itemType = returnType.ofType;
    const completedResults: Array<unknown> = [];
    setTarget(job.target, completedResults);
    let streamUsage: StreamUsage | undefined;
    try {
      streamUsage =
        typeof job.path.key === 'number'
          ? undefined
          : this.getStreamUsage(job.fieldDetailsList);
    } catch (rawError) {
      this.handleCompletionError(
        rawError,
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
      return;
    }

    if (isAsyncIterable(result)) {
      if (streamUsage === undefined) {
        runner.awaitValue(
          this.completeAsyncListItems(
            itemType,
            result,
            completedResults,
            job,
            runner,
          ),
          ignoreCompletionValue,
          (rawError) => {
            this.handleCompletionError(
              rawError,
              job.returnType,
              job.fieldDetailsList,
              job.path,
              job.target,
              job.nullTarget,
            );
          },
          job.nullTarget.path,
        );
        return;
      }

      runner.awaitValue(
        this.readAsyncListInitial(
          result,
          streamUsage,
          job.path,
          job.fieldDetailsList,
        ),
        (read) => {
          this.completeListItems(
            itemType,
            read.values,
            completedResults,
            job,
            runner,
            0,
          );
          if (!read.done && streamUsage !== undefined) {
            this.handleStream(
              read.nextIndex,
              job.path,
              { handle: read.iterator, isAsync: true },
              streamUsage,
              job.info,
              itemType,
            );
          }
        },
        (rawError) => {
          this.handleCompletionError(
            rawError,
            job.returnType,
            job.fieldDetailsList,
            job.path,
            job.target,
            job.nullTarget,
          );
        },
        undefined,
      );
      return;
    }

    if (streamUsage === undefined && Array.isArray(result)) {
      this.completeListItems(
        itemType,
        result,
        completedResults,
        job,
        runner,
        0,
      );
      return;
    }

    if (!isIterableObject(result)) {
      this.handleCompletionError(
        new GraphQLErrorClass(
          `Expected Iterable, but did not find one for field "${job.info.parentType}.${job.info.fieldName}".`,
        ),
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
      return;
    }

    const iterator = result[Symbol.iterator]();
    const values: Array<unknown> = [];
    let index = 0;
    try {
      while (true) {
        if (
          streamUsage?.initialCount === index &&
          this.handleStream(
            index,
            job.path,
            { handle: iterator },
            streamUsage,
            job.info,
            itemType,
          )
        ) {
          break;
        }

        const iteration = iterator.next();
        if (iteration.done) {
          break;
        }
        values.push(iteration.value);
        index++;
      }
    } catch (rawError) {
      this.sharedExecutionContext.asyncWorkTracker.addValues(
        collectIteratorPromises(iterator),
      );
      this.handleCompletionError(
        rawError,
        job.returnType,
        job.fieldDetailsList,
        job.path,
        job.target,
        job.nullTarget,
      );
      return;
    }

    this.completeListItems(itemType, values, completedResults, job, runner, 0);
  }

  async completeAsyncListItems(
    itemType: GraphQLOutputType,
    items: AsyncIterable<unknown>,
    completedResults: Array<unknown>,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
  ): Promise<void> {
    const iterator = items[Symbol.asyncIterator]();
    let iteration: IteratorResult<unknown> | undefined;
    let index = 0;

    try {
      while (true) {
        try {
          // eslint-disable-next-line no-await-in-loop
          iteration = await iterator.next();
        } catch (rawError) {
          throw locatedError(
            rawError,
            toNodes(job.fieldDetailsList),
            pathToArray(job.path),
          );
        }

        if (this.aborted || iteration.done) {
          break;
        }

        this.completeListItems(
          itemType,
          [iteration.value],
          completedResults,
          job,
          runner,
          index,
        );
        runner.drain();

        if (this.collectedErrors.hasNulledPosition(job.path)) {
          this.sharedExecutionContext.asyncWorkTracker.add(
            returnIteratorCatchingErrors(iterator),
          );
          return;
        }

        index++;
      }
    } catch (error) {
      this.sharedExecutionContext.asyncWorkTracker.add(
        returnIteratorCatchingErrors(iterator),
      );
      throw error;
    }

    if (this.aborted) {
      if (iteration?.done !== true) {
        this.sharedExecutionContext.asyncWorkTracker.add(
          returnIteratorCatchingErrors(iterator),
        );
      }
      throw new Error('Aborted!');
    }
  }

  completeListItems(
    itemType: GraphQLOutputType,
    values: ReadonlyArray<unknown>,
    completedResults: Array<unknown>,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
    offset: number,
  ): void {
    const leafInfo = getLeafCompletionInfo(itemType);
    if (leafInfo !== undefined) {
      this.completeLeafListItems(
        itemType,
        leafInfo.leafType,
        leafInfo.completedNonNull,
        values,
        completedResults,
        job,
        runner,
        offset,
      );
      return;
    }

    const end = offset + values.length;
    if (completedResults.length < end) {
      completedResults.length = end;
    }
    for (let i = values.length - 1; i >= 0; i--) {
      const index = offset + i;
      const itemPath = addPath(job.path, index, undefined);
      const itemTarget: CompletionTarget = {
        container: completedResults,
        key: index,
        path: itemPath,
      };
      runner.enqueue({
        kind: 'COMPLETE',
        returnType: itemType,
        fieldDetailsList: job.fieldDetailsList,
        info: job.info,
        path: itemPath,
        result: values[i],
        target: itemTarget,
        nullTarget: this.getNullableTarget(
          itemType,
          itemTarget,
          job.nullTarget,
        ),
        deliveryGroupMap: job.deliveryGroupMap,
      });
    }
  }

  completeLeafListItems(
    itemType: GraphQLOutputType,
    leafType: GraphQLLeafType,
    completedNonNull: boolean,
    values: ReadonlyArray<unknown>,
    completedResults: Array<unknown>,
    job: CompleteJob,
    runner: WorkQueueExecutionRunner,
    offset: number,
  ): void {
    const end = offset + values.length;
    if (completedResults.length < end) {
      completedResults.length = end;
    }
    for (let i = 0; i < values.length; i++) {
      const index = offset + i;
      const value = values[i];
      if (isPromiseLike(value)) {
        runner.awaitValue(
          value,
          (resolved) => {
            this.completeLeafListItemAtIndex(
              itemType,
              leafType,
              completedNonNull,
              resolved,
              job,
              completedResults,
              index,
            );
          },
          (rawError) => {
            this.handleLeafListItemError(
              rawError,
              itemType,
              job,
              completedResults,
              index,
            );
          },
          undefined,
        );
      } else {
        this.completeLeafListItemAtIndex(
          itemType,
          leafType,
          completedNonNull,
          value,
          job,
          completedResults,
          index,
        );
      }
    }
  }

  completeLeafListItemAtIndex(
    itemType: GraphQLOutputType,
    leafType: GraphQLLeafType,
    completedNonNull: boolean,
    result: unknown,
    job: CompleteJob,
    completedResults: Array<unknown>,
    index: number,
  ): void {
    if (result instanceof Error) {
      this.handleLeafListItemError(
        result,
        itemType,
        job,
        completedResults,
        index,
      );
      return;
    }

    if (result == null) {
      const path = addPath(job.path, index, undefined);
      const target: CompletionTarget = {
        container: completedResults,
        key: index,
        path,
      };
      const nullTarget = this.getNullableTarget(
        itemType,
        target,
        job.nullTarget,
      );
      if (completedNonNull && this.validatedExecutionArgs.errorPropagation) {
        this.handleCompletionError(
          new Error(
            `Cannot return null for non-nullable field ${job.info.parentType}.${job.info.fieldName}.`,
          ),
          itemType,
          job.fieldDetailsList,
          path,
          target,
          nullTarget,
        );
      } else {
        setTarget(target, null);
      }
      return;
    }
    try {
      const coerced = leafType.coerceOutputValue(result);
      if (coerced == null) {
        throw new Error(
          `Expected \`${inspect(leafType)}.coerceOutputValue(${inspect(result)})\` to ` +
            `return non-nullable value, returned: ${inspect(coerced)}`,
        );
      }
      completedResults[index] = coerced;
    } catch (rawError) {
      this.handleLeafListItemError(
        rawError,
        itemType,
        job,
        completedResults,
        index,
      );
    }
  }

  handleLeafListItemError(
    rawError: unknown,
    itemType: GraphQLOutputType,
    job: CompleteJob,
    completedResults: Array<unknown>,
    index: number,
  ): void {
    const path = addPath(job.path, index, undefined);
    const target: CompletionTarget = {
      container: completedResults,
      key: index,
      path,
    };
    this.handleCompletionError(
      rawError,
      itemType,
      job.fieldDetailsList,
      path,
      target,
      this.getNullableTarget(itemType, target, job.nullTarget),
    );
  }

  async readAsyncListInitial(
    items: AsyncIterable<unknown>,
    streamUsage: StreamUsage | undefined,
    path: Path,
    fieldDetailsList: FieldDetailsList,
  ): Promise<AsyncListRead> {
    const values: Array<unknown> = [];
    const iterator = items[Symbol.asyncIterator]();
    let index = 0;
    const maxInitialCount = streamUsage?.initialCount;
    try {
      // eslint-disable-next-line no-unmodified-loop-condition
      while (maxInitialCount === undefined || index < maxInitialCount) {
        // eslint-disable-next-line no-await-in-loop
        const iteration = await iterator.next();
        if (this.aborted || iteration.done) {
          return {
            values,
            iterator,
            nextIndex: index,
            done: true,
          };
        }
        values.push(iteration.value);
        index++;
      }
    } catch (rawError) {
      throw locatedError(
        rawError,
        toNodes(fieldDetailsList),
        pathToArray(path),
      );
    }
    return {
      values,
      iterator,
      nextIndex: index,
      done: false,
    };
  }

  handleStream(
    index: number,
    path: Path,
    iterator: StreamIteratorHandle,
    streamUsage: StreamUsage,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    completeItem?: StreamItemCompleter,
  ): boolean {
    if (this.mode === 'ignore') {
      return false;
    }
    if (this.mode === 'throw') {
      this.throwUnexpectedIncremental();
    }

    const queue = this.buildStreamItemQueue(
      index,
      path,
      iterator,
      streamUsage.fieldDetailsList,
      info,
      itemType,
      completeItem,
    );
    this.streams.push({
      label: streamUsage.label,
      path,
      queue,
      initialCount: index,
    });
    return true;
  }

  buildStreamItemQueue(
    initialIndex: number,
    streamPath: Path,
    iterator: StreamIteratorHandle,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    completeItem?: StreamItemCompleter,
  ): Queue<StreamItemResult> {
    const { enableEarlyExecution } = this.validatedExecutionArgs;
    const sharedExecutionContext = this.sharedExecutionContext;
    return new Queue<StreamItemResult>(
      async ({ push, stop, onStop, started }) => {
        const abortStreamItems = new Set<(reason?: unknown) => void>();
        let finishedNormally = false;
        let stopRequested = false;

        onStop((reason) => {
          stopRequested = true;
          if (!finishedNormally) {
            for (const abortStreamItem of abortStreamItems) {
              abortStreamItem(reason);
            }
            if (iterator.isAsync === true) {
              sharedExecutionContext.asyncWorkTracker.add(
                returnIteratorCatchingErrors(iterator.handle),
              );
            } else {
              sharedExecutionContext.asyncWorkTracker.addValues(
                collectIteratorPromises(iterator.handle),
              );
            }
          }
        });

        await (enableEarlyExecution ? Promise.resolve() : started);
        if (stopRequested) {
          return;
        }

        let index = initialIndex;
        while (true) {
          let iteration;
          try {
            if (iterator.isAsync === true) {
              // eslint-disable-next-line no-await-in-loop
              iteration = await iterator.handle.next();
              if (stopRequested) {
                return;
              }
            } else {
              iteration = iterator.handle.next();
            }
          } catch (rawError) {
            throw locatedError(
              rawError,
              toNodes(fieldDetailsList),
              pathToArray(streamPath),
            );
          }

          if (iteration.done) {
            finishedNormally = true;
            // eslint-disable-next-line no-void
            void stop();
            return;
          }

          const itemPath = addPath(streamPath, index, undefined);
          const executor = this.createSubExecutor();
          let streamItemResult =
            completeItem === undefined
              ? executor.completeStreamItem(
                  itemPath,
                  iteration.value,
                  fieldDetailsList,
                  info,
                  itemType,
                )
              : completeItem(executor, itemPath, iteration.value, index);
          if (isPromise(streamItemResult)) {
            if (enableEarlyExecution) {
              const abortStreamItem = (reason?: unknown) =>
                executor.abort(reason);
              abortStreamItems.add(abortStreamItem);
              streamItemResult = streamItemResult.finally(() => {
                abortStreamItems.delete(abortStreamItem);
              });
            } else {
              // eslint-disable-next-line no-await-in-loop
              streamItemResult = await streamItemResult;
              if (stopRequested) {
                return;
              }
            }
          }

          const pushResult = push(streamItemResult);
          if (isPromise(pushResult)) {
            // eslint-disable-next-line no-await-in-loop
            await pushResult;
            if (stopRequested) {
              return;
            }
          }
          index++;
        }
      },
      100,
    );
  }

  completeStreamItem(
    itemPath: Path,
    item: unknown,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): PromiseOrValue<StreamItemResult> {
    const rootBox: RootBox = { data: undefined };
    const runner = new WorkQueueExecutionRunner(this);
    const target: CompletionTarget = {
      container: rootBox,
      key: 'data',
      path: itemPath,
    };
    runner.enqueue({
      kind: 'COMPLETE',
      returnType: itemType,
      fieldDetailsList,
      info,
      path: itemPath,
      result: item,
      target,
      nullTarget: this.getNullableTarget(itemType, target, target),
      deliveryGroupMap: undefined,
    });
    const completed = runner.runUntilNulled(itemPath);
    if (isPromise(completed)) {
      return completed.then(() =>
        this.buildStreamItemResult(rootBox.data, itemPath, itemType),
      );
    }
    return this.buildStreamItemResult(rootBox.data, itemPath, itemType);
  }

  buildStreamItemResult(
    result: unknown,
    itemPath: Path,
    itemType: GraphQLOutputType,
  ): StreamItemResult {
    if (
      this.validatedExecutionArgs.errorPropagation &&
      isNonNullType(itemType) &&
      this.collectedErrors.hasNulledPosition(itemPath)
    ) {
      throw this.collectedErrors.firstError();
    }
    const errors = this.collectedErrors.errors;
    const work = this.getIncrementalWork();
    return this.finish(
      errors.length > 0
        ? { value: { item: result, errors }, work }
        : { value: { item: result }, work },
    );
  }

  executeExecutionGroup(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
  ): PromiseOrValue<ExecutionGroupResult> {
    const data = Object.create(null);
    const runner = new WorkQueueExecutionRunner(this);
    runner.enqueue({
      kind: 'FIELD_SET',
      parentType,
      source: sourceValue,
      path,
      groupedFieldSet,
      target: data,
      parentNullTarget: { container: { data }, key: 'data', path },
      serially: false,
      newDeferUsages: [],
      deliveryGroupMap,
    });
    const completed = runner.runUntilNulled(path);
    if (isPromise(completed)) {
      return completed.then(() =>
        this.buildExecutionGroupResult(deliveryGroups, path, data),
      );
    }
    return this.buildExecutionGroupResult(deliveryGroups, path, data);
  }

  buildExecutionGroupResult(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    path: Path | undefined,
    data: ObjMap<unknown>,
  ): ExecutionGroupResult {
    if (this.collectedErrors.hasNulledPosition(path)) {
      throw this.collectedErrors.firstError();
    }
    const errors = this.collectedErrors.errors;
    return this.finish({
      value: errors.length
        ? { deliveryGroups, path: pathToArray(path), errors, data }
        : { deliveryGroups, path: pathToArray(path), data },
      work: this.getIncrementalWork(),
    });
  }

  executePreplannedExecutionGroup(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    path: Path | undefined,
    sourceValue: unknown,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
    executeFields: PreplannedExecutionGroupExecutor,
  ): PromiseOrValue<ExecutionGroupResult> {
    const data = Object.create(null);
    const rootBox: RootBox<ObjMap<unknown> | null> = { data };
    const runner = new CompiledExecutionRunner(this);
    executeFields(
      this,
      runner,
      sourceValue,
      data,
      {
        container: rootBox,
        key: 'data',
        path,
      },
      deliveryGroupMap,
    );
    const completed = runner.runUntilNulled(path);
    if (isPromise(completed)) {
      return completed.then(() =>
        this.buildExecutionGroupResult(deliveryGroups, path, data),
      );
    }
    return this.buildExecutionGroupResult(deliveryGroups, path, data);
  }

  deferPreplannedExecutionGroup(
    deferUsageSet: DeferUsageSet,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
    path: Path | undefined,
    sourceValue: unknown,
    executeFields: PreplannedExecutionGroupExecutor,
  ): void {
    const deliveryGroups = getDeliveryGroups(deferUsageSet, deliveryGroupMap);
    const executor = this.createSubExecutor(deferUsageSet);
    const executionGroup: ExecutionGroup = {
      groups: deliveryGroups,
      path,
      computation: new Computation(
        () =>
          executor.executePreplannedExecutionGroup(
            deliveryGroups,
            path,
            sourceValue,
            deliveryGroupMap,
            executeFields,
          ),
        (reason) => executor.abort(reason),
      ),
    };

    if (this.validatedExecutionArgs.enableEarlyExecution) {
      if (this.shouldDefer(this.deferUsageSet, deferUsageSet)) {
        this.sharedExecutionContext.asyncWorkTracker.add(
          Promise.resolve().then(() => executionGroup.computation.prime()),
        );
      } else {
        executionGroup.computation.prime();
      }
    }
    this.tasks.push(executionGroup);
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
      const executor = this.createSubExecutor(deferUsageSet);
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
          (reason) => executor.abort(reason),
        ),
      };

      if (this.validatedExecutionArgs.enableEarlyExecution) {
        if (this.shouldDefer(this.deferUsageSet, deferUsageSet)) {
          this.sharedExecutionContext.asyncWorkTracker.add(
            Promise.resolve().then(() => executionGroup.computation.prime()),
          );
        } else {
          executionGroup.computation.prime();
        }
      }
      this.tasks.push(executionGroup);
    }
  }

  createSubExecutor(deferUsageSet?: DeferUsageSet): CompiledExecutor<TMode> {
    return new CompiledExecutor(
      this.validatedExecutionArgs,
      this.mode,
      this.sharedExecutionContext,
      deferUsageSet,
    );
  }

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
    for (const newDeferUsage of newDeferUsages) {
      const parentDeferUsage = newDeferUsage.parentDeferUsage;
      const parent =
        parentDeferUsage === undefined
          ? undefined
          : getDeliveryGroup(parentDeferUsage, newDeliveryGroupMap);
      const deliveryGroup: DeliveryGroup = {
        path,
        label: newDeferUsage.label,
        parent,
      };
      newDeliveryGroups.push(deliveryGroup);
      newDeliveryGroupMap.set(newDeferUsage, deliveryGroup);
    }
    return { newDeliveryGroups, newDeliveryGroupMap };
  }

  shouldDefer(
    parentDeferUsages: undefined | DeferUsageSet,
    deferUsages: DeferUsageSet,
  ): boolean {
    return (
      parentDeferUsages === undefined ||
      !Array.from(deferUsages).every((deferUsage) =>
        parentDeferUsages.has(deferUsage),
      )
    );
  }

  isCurrentDeferUsageSet(deferUsageSet: DeferUsageSet): boolean {
    const currentDeferUsageSet = this.deferUsageSet;
    if (currentDeferUsageSet?.size !== deferUsageSet.size) {
      return false;
    }
    for (const deferUsage of deferUsageSet) {
      if (!currentDeferUsageSet.has(deferUsage)) {
        return false;
      }
    }
    return true;
  }

  getStreamUsage(fieldDetailsList: FieldDetailsList): StreamUsage | undefined {
    const { operation, variableValues } = this.validatedExecutionArgs;
    const compiledFieldPlan = requireCompiledFieldPlan(fieldDetailsList);
    const compiledStreamDirective = compiledFieldPlan.compiledStreamDirective;
    if (compiledStreamDirective === null) {
      return;
    }

    const stream = getCompiledDirectiveValues(
      compiledStreamDirective,
      variableValues,
    );

    if (!stream || stream.if === false) {
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

    return {
      initialCount: stream.initialCount,
      label: typeof stream.label === 'string' ? stream.label : undefined,
      fieldDetailsList: fieldDetailsList.map((fieldDetails) => ({
        ...fieldDetails,
        deferUsage: undefined,
      })),
    };
  }

  executeSerialFields(
    fieldSetJob: FieldSetJob,
    entries: ReadonlyArray<
      [string, FieldDetailsList, CompiledFieldExecutionPlan]
    >,
    deliveryGroupMap: IncrementalPositionContext,
    runner: WorkQueueExecutionRunner,
  ): void {
    let index = 0;
    const runNext = () => {
      if (index >= entries.length) {
        return;
      }
      const [responseName, fieldDetailsList, plan] = entries[index++];
      runner.runWhenDrained(runNext);
      runner.enqueue({
        kind: 'FIELD',
        parentType: fieldSetJob.parentType,
        source: fieldSetJob.source,
        responseName,
        fieldDetailsList,
        plan,
        path: addPath(
          fieldSetJob.path,
          responseName,
          fieldSetJob.parentType.name,
        ),
        target: fieldSetJob.target,
        parentNullTarget: fieldSetJob.parentNullTarget,
        deliveryGroupMap,
      });
    };
    runNext();
  }

  protected abortResolverSignal(
    reason: unknown = resolverAbortWithoutReason,
  ): void {
    this._resolverAbortFinished = true;
    this._resolverAbortReason = reason;
    if (reason === resolverAbortWithoutReason) {
      this.resolverAbortController?.abort();
    } else {
      this.resolverAbortController?.abort(reason);
    }
  }

  private getResolverAbortSignal(): AbortSignal {
    const resolverAbortController = (this.resolverAbortController ??=
      new AbortController());
    if (
      this._resolverAbortFinished &&
      !resolverAbortController.signal.aborted
    ) {
      if (this._resolverAbortReason === resolverAbortWithoutReason) {
        resolverAbortController.abort();
      } else {
        resolverAbortController.abort(this._resolverAbortReason);
      }
    }
    return resolverAbortController.signal;
  }
}

/** @internal */
class WorkQueueExecutionRunner {
  _settled: boolean;
  private _executor: CompiledExecutor;
  private _jobs: Array<Job> | undefined;
  private _pending: number;
  private _resolve: (() => void) | undefined;
  private _reject: ((reason: unknown) => void) | undefined;
  private _onDrained: (() => void) | undefined;

  constructor(executor: CompiledExecutor) {
    this._executor = executor;
    this._pending = 0;
    this._settled = false;
  }

  enqueue(job: Job): void {
    (this._jobs ??= []).push(job);
  }

  drain(): void {
    this._drain();
  }

  runWhenDrained(callback: () => void): void {
    this._onDrained = callback;
  }

  awaitValue<T>(
    promise: PromiseLike<T>,
    onResolve: (value: T) => void,
    onReject: (reason: unknown) => void,
    _boundary: Path | undefined,
  ): void {
    this._pending++;
    try {
      promise.then(
        (value) => this._completeResolved(value, onResolve),
        (reason: unknown) => this._completeRejected(reason, onReject),
      );
    } catch (error) {
      this._pending--;
      onReject(error);
    }
  }

  runUntilNulled(_path: Path | undefined): PromiseOrValue<void> {
    this._drain();
    if (this._pending === 0) {
      return;
    }
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  private _drain(): void {
    try {
      while (true) {
        const jobs = this._jobs;
        let job: Job | undefined;
        if (jobs !== undefined) {
          while ((job = jobs.pop()) !== undefined) {
            switch (job.kind) {
              case 'FIELD_SET':
                this._executor.processFieldSet(job, this);
                break;
              case 'FIELD':
                this._executor.processField(job, this);
                break;
              case 'COMPLETE':
                this._executor.processComplete(job, this);
                break;
            }
          }
        }
        if (this._pending > 0) {
          return;
        }
        const onDrained = this._onDrained;
        if (onDrained !== undefined) {
          this._onDrained = undefined;
          onDrained();
          continue;
        }
        this._executor.applyNulledTargets();
        if (this._resolve !== undefined) {
          this._settled = true;
          this._resolve();
        }
        return;
      }
    } catch (error) {
      this._fail(error);
    }
  }

  private _fail(error: unknown): void {
    this._settled = true;
    if (this._reject !== undefined) {
      this._reject(error);
      return;
    }
    throw error;
  }

  private _completeResolved<T>(value: T, onResolve: (value: T) => void): void {
    if (this._settled) {
      this._pending--;
      return;
    }
    try {
      onResolve(value);
      this._pending--;
      this._drainIfReadyOrQueued();
    } catch (error) {
      this._pending--;
      this._fail(error);
    }
  }

  private _completeRejected(
    reason: unknown,
    onReject: (reason: unknown) => void,
  ): void {
    if (this._settled) {
      this._pending--;
      return;
    }
    onReject(reason);
    this._pending--;
    this._drainIfReadyOrQueued();
  }

  private _drainIfReadyOrQueued(): void {
    if (
      this._pending === 0 ||
      this._onDrained !== undefined ||
      (this._jobs !== undefined && this._jobs.length > 0)
    ) {
      this._drain();
    }
  }
}

/** @internal */
export class CompiledExecutionRunner {
  _settled: boolean;
  private _executor: CompiledExecutor;
  private _pending: number;
  private _resolve: (() => void) | undefined;
  private _reject: ((reason: unknown) => void) | undefined;
  private _onDrained: (() => void) | undefined;

  constructor(executor: CompiledExecutor) {
    this._executor = executor;
    this._pending = 0;
    this._settled = false;
  }

  drain(): void {
    this._drain();
  }

  runWhenDrained(callback: () => void): void {
    this._onDrained = callback;
  }

  runUntilNulled(_path: Path | undefined): PromiseOrValue<void> {
    this._drain();
    if (this._pending === 0) {
      return;
    }
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  _drainIfReady(): void {
    if (this._pending === 0 || this._onDrained !== undefined) {
      this._drain();
    }
  }

  private _drain(): void {
    try {
      while (this._pending === 0) {
        const onDrained = this._onDrained;
        if (onDrained !== undefined) {
          this._onDrained = undefined;
          onDrained();
          continue;
        }
        this._executor.applyNulledTargets();
        if (this._resolve !== undefined) {
          this._settled = true;
          this._resolve();
        }
        return;
      }
    } catch (error) {
      this._fail(error);
    }
  }

  private _fail(error: unknown): void {
    this._settled = true;
    if (this._reject !== undefined) {
      this._reject(error);
      return;
    }
    throw error;
  }
}

class CollectedErrors {
  private _errorPositions: Set<Path | undefined> | undefined;
  private _errors: Array<GraphQLError> | undefined;
  private _nulledTargets: Array<CompletionTarget> | undefined;

  get errors(): ReadonlyArray<GraphQLError> {
    return this._errors ?? emptyCollectedErrors;
  }

  firstError(): GraphQLError {
    const firstError = this._errors?.[0];
    invariant(firstError !== undefined);
    return firstError;
  }

  add(
    error: GraphQLError,
    path: Path | undefined,
    target?: CompletionTarget,
  ): void {
    if (this.hasNulledPosition(path)) {
      return;
    }
    (this._errorPositions ??= new Set<Path | undefined>()).add(path);
    if (target !== undefined) {
      (this._nulledTargets ??= []).push(target);
    }
    (this._errors ??= []).push(error);
  }

  applyNulledTargets(): void {
    const nulledTargets = this._nulledTargets;
    if (nulledTargets === undefined) {
      return;
    }
    for (const target of nulledTargets) {
      setTarget(target, null);
    }
    nulledTargets.length = 0;
  }

  hasNulledPosition(startPath: Path | undefined): boolean {
    const errorPositions = this._errorPositions;
    if (errorPositions === undefined) {
      return false;
    }
    let path = startPath;
    while (path !== undefined) {
      if (errorPositions.has(path)) {
        return true;
      }
      path = path.prev;
    }
    return errorPositions.has(undefined);
  }
}

const emptyCollectedErrors: ReadonlyArray<GraphQLError> = Object.freeze([]);

function setTarget(target: CompletionTarget, value: unknown): void {
  if (isArrayTarget(target)) {
    target.container[target.key] = value;
    return;
  }
  target.container[target.key] = value;
}

function isArrayTarget(
  target: CompletionTarget,
): target is ArrayCompletionTarget {
  return Array.isArray(target.container);
}

const ignoreCompletionValue = () => undefined;

function getCompiledFieldPlan(
  fieldDetailsList: FieldDetailsList,
): CompiledFieldExecutionPlan | undefined {
  return fieldDetailsList[0].compiledFieldPlan;
}

function requireCompiledFieldPlan(
  fieldDetailsList: FieldDetailsList,
): CompiledFieldExecutionPlan {
  const compiledFieldPlan = getCompiledFieldPlan(fieldDetailsList);
  invariant(compiledFieldPlan !== undefined);
  return compiledFieldPlan;
}

function getDeliveryGroups(
  deferUsageSet: ReadonlySet<DeferUsage>,
  deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
): ReadonlyArray<DeliveryGroup> {
  const deliveryGroups: Array<DeliveryGroup> = [];
  for (const deferUsage of deferUsageSet) {
    deliveryGroups.push(getDeliveryGroup(deferUsage, deliveryGroupMap));
  }
  return deliveryGroups;
}

function getDeliveryGroup(
  deferUsage: DeferUsage,
  deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
): DeliveryGroup {
  const deliveryGroup = deliveryGroupMap.get(deferUsage);
  invariant(deliveryGroup !== undefined);
  return deliveryGroup;
}

function getLeafCompletionInfo(
  returnType: GraphQLOutputType,
): { leafType: GraphQLLeafType; completedNonNull: boolean } | undefined {
  let nullableType = returnType;
  let completedNonNull = false;
  while (isNonNullType(nullableType)) {
    completedNonNull = true;
    nullableType = nullableType.ofType;
  }
  return isLeafType(nullableType)
    ? { leafType: nullableType, completedNonNull }
    : undefined;
}

const toNodes = memoize1(
  (fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> =>
    fieldDetailsList.map((fieldDetails) => fieldDetails.node),
);
