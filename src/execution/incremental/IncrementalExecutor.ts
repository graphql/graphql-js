/* eslint-disable max-params */
import { invariant } from '../../jsutils/invariant.js';
import { isPromise } from '../../jsutils/isPromise.js';
import { memoize1 } from '../../jsutils/memoize1.js';
import { memoize2 } from '../../jsutils/memoize2.js';
import type { ObjMap } from '../../jsutils/ObjMap.js';
import type { Path } from '../../jsutils/Path.js';
import { addPath, pathToArray } from '../../jsutils/Path.js';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../../error/GraphQLError.js';
import { locatedError } from '../../error/locatedError.js';

import type { FieldNode } from '../../language/ast.js';
import { OperationTypeNode } from '../../language/ast.js';

import type {
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from '../../type/definition.js';

import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from '../collectFields.js';
import { collectSubfields as _collectSubfields } from '../collectFields.js';
import type {
  ExecutionResult,
  FormattedExecutionResult,
  ValidatedExecutionArgs,
} from '../Executor.js';
import { Executor } from '../Executor.js';
import type { StreamUsage } from '../getStreamUsage.js';
import type {
  DeferUsageSet,
  ExecutionPlan,
} from '../incremental/buildExecutionPlan.js';
import { buildExecutionPlan } from '../incremental/buildExecutionPlan.js';
import { returnIteratorCatchingErrors } from '../returnIteratorCatchingErrors.js';

import { Computation } from './Computation.js';
import { IncrementalPublisher } from './IncrementalPublisher.js';
import { Queue } from './Queue.js';
import type { Group, Stream, Task, Work } from './WorkQueue.js';

const buildExecutionPlanFromInitial = memoize1(
  (groupedFieldSet: GroupedFieldSet) => buildExecutionPlan(groupedFieldSet),
);

const buildExecutionPlanFromDeferred = memoize2(
  (groupedFieldSet: GroupedFieldSet, deferUsageSet: DeferUsageSet) =>
    buildExecutionPlan(groupedFieldSet, deferUsageSet),
);

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 *   - `incremental` is a list of the results from defer/stream directives.
 */
export interface ExperimentalIncrementalExecutionResults<
  TInitialData = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TInitialData, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<
      TDeferredData,
      TStreamItem,
      TExtensions
    >,
    void,
    void
  >;
}

export interface FormattedExperimentalIncrementalExecutionResults<
  TInitial = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: FormattedInitialIncrementalExecutionResult<
    TInitial,
    TExtensions
  >;
  subsequentResults: AsyncGenerator<
    FormattedSubsequentIncrementalExecutionResult<
      TDeferredData,
      TStreamItem,
      TExtensions
    >,
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
  TInitialData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TInitialData, TExtensions> {
  data: TInitialData;
  pending: ReadonlyArray<PendingResult>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface SubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<
    IncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  completed?: ReadonlyArray<CompletedResult>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface FormattedSubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<
    FormattedIncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  completed?: ReadonlyArray<FormattedCompletedResult>;
  extensions?: TExtensions;
}

export interface IncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  data: TDeferredData;
  extensions?: TExtensions;
}

export interface FormattedIncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data: TDeferredData;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export interface IncrementalStreamResult<
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  items: ReadonlyArray<TStreamItem>;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TStreamItem = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items: ReadonlyArray<TStreamItem>;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export type IncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TDeferredData, TExtensions>
  | IncrementalStreamResult<TStreamItem, TExtensions>;

export type FormattedIncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TDeferredData, TExtensions>
  | FormattedIncrementalStreamResult<TStreamItem, TExtensions>;

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

/** @internal */
interface ExecutionGroup extends Task<
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

export interface ItemStream extends Stream<
  ExecutionGroupValue,
  StreamItemValue,
  DeliveryGroup,
  ItemStream
> {
  path: Path;
  label: string | undefined;
  initialCount: number;
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
export class IncrementalExecutor<
  TExperimental = ExperimentalIncrementalExecutionResults,
> extends Executor<ReadonlyMap<DeferUsage, DeliveryGroup>, TExperimental> {
  deferUsageSet?: DeferUsageSet | undefined;
  groups: Array<DeliveryGroup>;
  tasks: Array<ExecutionGroup>;
  streams: Array<ItemStream>;

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    sharedResolverAbortSignal?: AbortSignal,
    deferUsageSet?: DeferUsageSet,
  ) {
    super(validatedExecutionArgs, sharedResolverAbortSignal);
    this.deferUsageSet = deferUsageSet;
    this.groups = [];
    this.tasks = [];
    this.streams = [];
  }

  createSubExecutor(
    deferUsageSet?: DeferUsageSet,
  ): IncrementalExecutor<TExperimental> {
    return new IncrementalExecutor(
      this.validatedExecutionArgs,
      this.sharedResolverAbortSignal,
      deferUsageSet,
    );
  }

  override cancel(reason?: unknown): void {
    super.cancel(reason);
    for (const task of this.tasks) {
      task.computation.cancel();
    }
    for (const stream of this.streams) {
      stream.queue.abort();
    }
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  override buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | TExperimental {
    const work = this.getIncrementalWork();
    const { tasks, streams } = work;
    if (tasks?.length === 0 && streams?.length === 0) {
      return super.buildResponse(data);
    }

    const errors = this.collectedErrors.errors;
    invariant(data !== null);
    const incrementalPublisher = new IncrementalPublisher();
    return incrementalPublisher.buildResponse(
      data,
      errors,
      work,
      this.validatedExecutionArgs.externalAbortSignal,
      () => this.resolverAbortController?.abort(),
    ) as TExperimental;
  }

  override executeCollectedRootFields(
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

    const { groupedFieldSet, newGroupedFieldSets } =
      this.buildRootExecutionPlan(originalGroupedFieldSet);

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

  buildRootExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
  ): ExecutionPlan {
    return buildExecutionPlanFromInitial(originalGroupedFieldSet);
  }

  override executeCollectedSubfields(
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

  buildSubExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
  ): ExecutionPlan {
    return this.deferUsageSet === undefined
      ? buildExecutionPlanFromInitial(originalGroupedFieldSet)
      : buildExecutionPlanFromDeferred(
          originalGroupedFieldSet,
          this.deferUsageSet,
        );
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
          this.cancel();
          throw error;
        },
      );
    }

    return this.buildExecutionGroupResult(deliveryGroups, path, result);
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

  override handleStream(
    index: number,
    path: Path,
    iterator:
      | { handle: Iterator<unknown>; isAsync?: never }
      | { handle: AsyncIterator<unknown>; isAsync: true },
    streamUsage: StreamUsage,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): boolean {
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
      initialCount: index,
    };

    this.streams.push(itemStream);
    return true;
  }

  buildStreamItemQueue(
    initialIndex: number,
    streamPath: Path,
    iterator: Iterator<unknown> | AsyncIterator<unknown>,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
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

          const executor = this.createSubExecutor();

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
    info: GraphQLResolveInfo,
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

  buildStreamItemResult(result: unknown): StreamItemResult {
    this.finish();
    const item = result;
    const errors = this.collectedErrors.errors;
    const work = this.getIncrementalWork();
    return errors.length > 0
      ? { value: { item, errors }, work }
      : { value: { item }, work };
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
