/** @category Incremental Execution */
import type { ObjMap } from "../../jsutils/ObjMap.js";
import type { Path } from "../../jsutils/Path.js";
import type { PromiseOrValue } from "../../jsutils/PromiseOrValue.js";
import type { SetMap } from "../../jsutils/SetMap.js";
import type { GraphQLError, GraphQLFormattedError } from "../../error/GraphQLError.js";
import type { GraphQLObjectType, GraphQLOutputType, GraphQLResolveInfo } from "../../type/definition.js";
import type { DeferUsage, FieldDetailsList, GroupedFieldSet } from "../collectFields.js";
import type { SharedExecutionContext } from "../createSharedExecutionContext.js";
import type { ValidatedExecutionArgs } from "../ExecutionArgs.js";
import type { ExecutionResult, FormattedExecutionResult } from "../Executor.js";
import { Executor } from "../Executor.js";
import type { StreamUsage } from "../getStreamUsage.js";
import type { DeferUsageSet, ExecutionPlan } from "./buildExecutionPlan.js";
import { Computation } from "./Computation.js";
import { Queue } from "./Queue.js";
import type { Group, Stream, Task, Work } from "./WorkQueue.js";
/**
 * Results for an operation that produced incremental payloads.
 * @typeParam TInitialData - Shape of the initial result data payload.
 * @typeParam TDeferredData - Shape of deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface ExperimentalIncrementalExecutionResults<TInitialData = ObjMap<unknown>, TDeferredData = ObjMap<unknown>, TStreamItem = unknown, TExtensions = ObjMap<unknown>> {
    /** Initial execution result delivered before subsequent incremental payloads. */
    initialResult: InitialIncrementalExecutionResult<TInitialData, TExtensions>;
    /** Async stream of incremental payloads delivered after the initial result. */
    subsequentResults: AsyncGenerator<SubsequentIncrementalExecutionResult<TDeferredData, TStreamItem, TExtensions>, void, void>;
}
/**
 * JSON-serializable form of incremental execution results.
 * @typeParam TInitial - Shape of the formatted initial result data payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedExperimentalIncrementalExecutionResults<TInitial = ObjMap<unknown>, TDeferredData = ObjMap<unknown>, TStreamItem = unknown, TExtensions = ObjMap<unknown>> {
    /** Formatted initial execution result. */
    initialResult: FormattedInitialIncrementalExecutionResult<TInitial, TExtensions>;
    /** Async stream of formatted incremental payloads. */
    subsequentResults: AsyncGenerator<FormattedSubsequentIncrementalExecutionResult<TDeferredData, TStreamItem, TExtensions>, void, void>;
}
/**
 * Initial execution result for an operation that produced incremental payloads.
 * @typeParam TData - Shape of the initial data payload.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface InitialIncrementalExecutionResult<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> extends ExecutionResult<TData, TExtensions> {
    /** Data produced by the initial execution payload. */
    data: TData;
    /** Incremental payloads that are still pending after the initial result. */
    pending: ReadonlyArray<PendingResult>;
    /** Indicates that subsequent incremental payloads will follow. */
    hasNext: true;
    /** Additional non-standard metadata included in the initial result. */
    extensions?: TExtensions;
}
/**
 * JSON-serializable form of an initial incremental execution result.
 * @typeParam TInitialData - Shape of the formatted initial data payload.
 * @typeParam TExtensions - Shape of the formatted extensions payload.
 */
export interface FormattedInitialIncrementalExecutionResult<TInitialData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> extends FormattedExecutionResult<TInitialData, TExtensions> {
    /** Formatted data produced by the initial execution payload. */
    data: TInitialData;
    /** Formatted list of incremental payloads still pending after the initial result. */
    pending: ReadonlyArray<PendingResult>;
    /** Indicates whether subsequent incremental payloads will follow. */
    hasNext: boolean;
    /** Additional non-standard metadata included in the formatted initial result. */
    extensions?: TExtensions;
}
/**
 * Subsequent payload produced by incremental execution.
 * @typeParam TDeferredData - Shape of deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface SubsequentIncrementalExecutionResult<TDeferredData = ObjMap<unknown>, TStreamItem = unknown, TExtensions = ObjMap<unknown>> {
    /** Incremental payloads that became pending with this response. */
    pending?: ReadonlyArray<PendingResult>;
    /** Deferred or streamed payloads delivered by this response. */
    incremental?: ReadonlyArray<IncrementalResult<TDeferredData, TStreamItem, TExtensions>>;
    /** Incremental payloads that completed with this response. */
    completed?: ReadonlyArray<CompletedResult>;
    /** Indicates whether more incremental payloads will follow. */
    hasNext: boolean;
    /** Additional non-standard metadata included in this payload. */
    extensions?: TExtensions;
}
/**
 * JSON-serializable form of a subsequent incremental execution payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedSubsequentIncrementalExecutionResult<TDeferredData = ObjMap<unknown>, TStreamItem = unknown, TExtensions = ObjMap<unknown>> {
    /** Indicates whether more incremental payloads will follow. */
    hasNext: boolean;
    /** Formatted incremental payloads that became pending with this response. */
    pending?: ReadonlyArray<PendingResult>;
    /** Formatted deferred or streamed payloads delivered by this response. */
    incremental?: ReadonlyArray<FormattedIncrementalResult<TDeferredData, TStreamItem, TExtensions>>;
    /** Formatted incremental payloads that completed with this response. */
    completed?: ReadonlyArray<FormattedCompletedResult>;
    /** Additional non-standard metadata included in this formatted payload. */
    extensions?: TExtensions;
}
/**
 * Incremental payload produced by a deferred fragment.
 * @typeParam TDeferredData - Shape of deferred fragment data.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface IncrementalDeferResult<TDeferredData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> {
    /** Identifier matching this payload to a pending deferred fragment. */
    id: string;
    /** Path from the deferred fragment location to this payload. */
    subPath?: ReadonlyArray<string | number>;
    /** Errors raised while executing the deferred fragment. */
    errors?: ReadonlyArray<GraphQLError>;
    /** Data produced by the deferred fragment. */
    data: TDeferredData;
    /** Additional non-standard metadata included in this payload. */
    extensions?: TExtensions;
}
/**
 * JSON-serializable form of a deferred fragment payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedIncrementalDeferResult<TDeferredData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> {
    /** Formatted errors raised while executing the deferred fragment. */
    errors?: ReadonlyArray<GraphQLFormattedError>;
    /** Formatted data produced by the deferred fragment. */
    data: TDeferredData;
    /** Identifier matching this payload to a pending deferred fragment. */
    id: string;
    /** Path from the deferred fragment location to this payload. */
    subPath?: ReadonlyArray<string | number>;
    /** Additional non-standard metadata included in this formatted payload. */
    extensions?: TExtensions;
}
/**
 * Incremental payload produced by a streamed list field.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface IncrementalStreamResult<TStreamItem = unknown, TExtensions = ObjMap<unknown>> {
    /** Identifier matching this payload to a pending stream. */
    id: string;
    /** Path from the streamed field location to these items. */
    subPath?: ReadonlyArray<string | number>;
    /** Errors raised while producing streamed items. */
    errors?: ReadonlyArray<GraphQLError>;
    /** Streamed list items delivered by this payload. */
    items: ReadonlyArray<TStreamItem>;
    /** Additional non-standard metadata included in this payload. */
    extensions?: TExtensions;
}
/**
 * JSON-serializable form of a streamed list payload.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedIncrementalStreamResult<TStreamItem = Array<unknown>, TExtensions = ObjMap<unknown>> {
    /** Formatted errors raised while producing streamed items. */
    errors?: ReadonlyArray<GraphQLFormattedError>;
    /** Formatted streamed list items delivered by this payload. */
    items: ReadonlyArray<TStreamItem>;
    /** Identifier matching this payload to a pending stream. */
    id: string;
    /** Path from the streamed field location to these items. */
    subPath?: ReadonlyArray<string | number>;
    /** Additional non-standard metadata included in this formatted payload. */
    extensions?: TExtensions;
}
/**
 * Deferred fragment or streamed list payload produced by incremental execution.
 * @typeParam TDeferredData - Shape of deferred fragment data.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export type IncrementalResult<TDeferredData = ObjMap<unknown>, TStreamItem = unknown, TExtensions = ObjMap<unknown>> = IncrementalDeferResult<TDeferredData, TExtensions> | IncrementalStreamResult<TStreamItem, TExtensions>;
/**
 * JSON-serializable deferred fragment or streamed list payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export type FormattedIncrementalResult<TDeferredData = ObjMap<unknown>, TStreamItem = unknown, TExtensions = ObjMap<unknown>> = FormattedIncrementalDeferResult<TDeferredData, TExtensions> | FormattedIncrementalStreamResult<TStreamItem, TExtensions>;
/** @internal */
export interface PendingResult {
    id: string;
    path: ReadonlyArray<string | number>;
    label?: string;
}
/** @internal */
export interface CompletedResult {
    id: string;
    errors?: ReadonlyArray<GraphQLError>;
}
/** @internal */
export interface FormattedCompletedResult {
    id: string;
    errors?: ReadonlyArray<GraphQLFormattedError>;
}
interface ExecutionGroup extends Task<ExecutionGroupValue, StreamItemValue, DeliveryGroup, ItemStream> {
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
/** @internal */
export interface ItemStream extends Stream<ExecutionGroupValue, StreamItemValue, DeliveryGroup, ItemStream> {
    path: Path;
    label: string | undefined;
    initialCount: number;
}
/** @internal */
export interface ExecutionGroupValue {
    deliveryGroups: ReadonlyArray<DeliveryGroup>;
    path: ReadonlyArray<string | number>;
    errors?: ReadonlyArray<GraphQLError>;
    data: ObjMap<unknown>;
}
/** @internal */
export type IncrementalWork = Work<ExecutionGroupValue, StreamItemValue, DeliveryGroup, ItemStream>;
/** @internal */
export interface ExecutionGroupResult {
    value: ExecutionGroupValue;
    work?: IncrementalWork | undefined;
}
/** @internal */
export interface StreamItemValue {
    errors?: ReadonlyArray<GraphQLError>;
    item: unknown;
}
/** @internal */
export interface StreamItemResult {
    value: StreamItemValue;
    work?: IncrementalWork | undefined;
}
/** @internal */
export declare class IncrementalExecutor<TExperimental = ExperimentalIncrementalExecutionResults> extends Executor<ReadonlyMap<DeferUsage, DeliveryGroup>, TExperimental> {
    deferUsageSet?: DeferUsageSet | undefined;
    groups: Array<DeliveryGroup>;
    tasks: Array<ExecutionGroup>;
    streams: Array<ItemStream>;
    constructor(validatedExecutionArgs: ValidatedExecutionArgs, sharedExecutionContext?: SharedExecutionContext, deferUsageSet?: DeferUsageSet);
    getCreateSubExecutor(): (deferUsageSet?: DeferUsageSet) => IncrementalExecutor<TExperimental>;
    abort(reason?: unknown): void;
    /**
     * Given a completed execution context and data, build the `{ errors, data }`
     * response defined by the "Response" section of the GraphQL specification.
     *
     * @internal
     */
    buildResponse(data: ObjMap<unknown> | null): ExecutionResult | TExperimental;
    executeCollectedRootFields(rootType: GraphQLObjectType, rootValue: unknown, originalGroupedFieldSet: GroupedFieldSet, serially: boolean, newDeferUsages: ReadonlyArray<DeferUsage>): PromiseOrValue<ObjMap<unknown>>;
    buildRootExecutionPlan(originalGroupedFieldSet: GroupedFieldSet): ExecutionPlan;
    executeCollectedSubfields(parentType: GraphQLObjectType, sourceValue: unknown, path: Path | undefined, originalGroupedFieldSet: GroupedFieldSet, newDeferUsages: ReadonlyArray<DeferUsage>, deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined): PromiseOrValue<ObjMap<unknown>>;
    buildSubExecutionPlan(originalGroupedFieldSet: GroupedFieldSet): ExecutionPlan;
    collectExecutionGroups(parentType: GraphQLObjectType, sourceValue: unknown, path: Path | undefined, newGroupedFieldSets: SetMap<DeferUsage, GroupedFieldSet>, deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>): void;
    executeExecutionGroup(deliveryGroups: ReadonlyArray<DeliveryGroup>, parentType: GraphQLObjectType, sourceValue: unknown, path: Path | undefined, groupedFieldSet: GroupedFieldSet, deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>): PromiseOrValue<ExecutionGroupResult>;
    buildExecutionGroupResult(deliveryGroups: ReadonlyArray<DeliveryGroup>, path: Path | undefined, result: ObjMap<unknown>): ExecutionGroupResult;
    getIncrementalWork(): IncrementalWork;
    /**
     * Instantiates new DeliveryGroups for the given path, returning an
     * updated map of DeferUsage objects to DeliveryGroups.
     *
     * Note: As defer directives may be used with operations returning lists,
     * a DeferUsage object may correspond to many DeliveryGroups.
     *
     * @internal
     */
    getNewDeliveryGroupMap(newDeferUsages: ReadonlyArray<DeferUsage>, deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined, path: Path | undefined): {
        newDeliveryGroups: ReadonlyArray<DeliveryGroup>;
        newDeliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>;
    };
    shouldDefer(parentDeferUsages: undefined | DeferUsageSet, deferUsages: DeferUsageSet): boolean;
    handleStream(index: number, path: Path, iterator: {
        handle: Iterator<unknown>;
        isAsync?: never;
    } | {
        handle: AsyncIterator<unknown>;
        isAsync: true;
    }, streamUsage: StreamUsage, info: GraphQLResolveInfo, itemType: GraphQLOutputType): boolean;
    buildStreamItemQueue(initialIndex: number, streamPath: Path, iterator: Iterator<unknown> | AsyncIterator<unknown>, fieldDetailsList: FieldDetailsList, info: GraphQLResolveInfo, itemType: GraphQLOutputType, isAsync: boolean | undefined): Queue<StreamItemResult>;
    completeStreamItem(itemPath: Path, item: unknown, fieldDetailsList: FieldDetailsList, info: GraphQLResolveInfo, itemType: GraphQLOutputType): PromiseLike<StreamItemResult> | StreamItemResult;
    buildStreamItemResult(result: unknown): StreamItemResult;
}
export {};
