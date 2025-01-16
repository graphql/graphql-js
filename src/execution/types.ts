import type { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.js';

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
  TData = ObjMap<unknown>,
  TItems = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TInitial, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TData, TItems, TExtensions>,
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
  TData = ObjMap<unknown>,
  TItems = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<IncrementalResult<TData, TItems, TExtensions>>;
  completed?: ReadonlyArray<CompletedResult>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface FormattedSubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TItems = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<
    FormattedIncrementalResult<TData, TItems, TExtensions>
  >;
  completed?: ReadonlyArray<FormattedCompletedResult>;
  extensions?: TExtensions;
}

interface ExecutionGroupResult<TData = ObjMap<unknown>> {
  errors?: ReadonlyArray<GraphQLError>;
  data: TData;
}

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionGroupResult<TData> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
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

interface StreamItemsRecordResult<TItems = ReadonlyArray<unknown>> {
  errors?: ReadonlyArray<GraphQLError>;
  items: TItems;
}

export interface IncrementalStreamResult<
  TItems = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> extends StreamItemsRecordResult<TItems> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TItems = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items: TItems;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export type IncrementalResult<
  TData = ObjMap<unknown>,
  TItems = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TItems, TExtensions>;

export type FormattedIncrementalResult<
  TData = ObjMap<unknown>,
  TItems = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TItems, TExtensions>;

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
  path: ReadonlyArray<string | number>;
  label?: string;
  errors?: ReadonlyArray<GraphQLError>;
}

export function isPendingExecutionGroup(
  incrementalDataRecord: IncrementalDataRecord,
): incrementalDataRecord is PendingExecutionGroup {
  return 'deferredFragmentRecords' in incrementalDataRecord;
}

export type CompletedExecutionGroup =
  | SuccessfulExecutionGroup
  | FailedExecutionGroup;

export function isCompletedExecutionGroup(
  incrementalDataRecordResult: IncrementalDataRecordResult,
): incrementalDataRecordResult is CompletedExecutionGroup {
  return 'pendingExecutionGroup' in incrementalDataRecordResult;
}

export interface SuccessfulExecutionGroup {
  pendingExecutionGroup: PendingExecutionGroup;
  path: Array<string | number>;
  result: ExecutionGroupResult;
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord> | undefined;
  errors?: never;
}

interface FailedExecutionGroup {
  pendingExecutionGroup: PendingExecutionGroup;
  path: Array<string | number>;
  errors: ReadonlyArray<GraphQLError>;
  result?: never;
}

export function isFailedExecutionGroup(
  completedExecutionGroup: CompletedExecutionGroup,
): completedExecutionGroup is FailedExecutionGroup {
  return completedExecutionGroup.errors !== undefined;
}

type ThunkIncrementalResult<T> =
  | BoxedPromiseOrValue<T>
  | (() => BoxedPromiseOrValue<T>);

export interface PendingExecutionGroup {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  result: ThunkIncrementalResult<CompletedExecutionGroup>;
}

export type DeliveryGroup = DeferredFragmentRecord | StreamRecord;

/** @internal */
export class DeferredFragmentRecord {
  path: Path | undefined;
  label: string | undefined;
  id?: string | undefined;
  parent: DeferredFragmentRecord | undefined;
  pendingExecutionGroups: Set<PendingExecutionGroup>;
  successfulExecutionGroups: Set<SuccessfulExecutionGroup>;
  children: Set<DeliveryGroup>;

  constructor(
    path: Path | undefined,
    label: string | undefined,
    parent: DeferredFragmentRecord | undefined,
  ) {
    this.path = path;
    this.label = label;
    this.parent = parent;
    this.pendingExecutionGroups = new Set();
    this.successfulExecutionGroups = new Set();
    this.children = new Set();
  }
}

export function isDeferredFragmentRecord(
  deliveryGroup: DeliveryGroup,
): deliveryGroup is DeferredFragmentRecord {
  return deliveryGroup instanceof DeferredFragmentRecord;
}

export interface StreamItemResult {
  item?: unknown;
  incrementalDataRecords?: ReadonlyArray<IncrementalDataRecord> | undefined;
  errors?: ReadonlyArray<GraphQLError> | undefined;
}

export type StreamItemRecord = ThunkIncrementalResult<StreamItemResult>;

export interface StreamRecord {
  path: Path;
  label: string | undefined;
  id?: string | undefined;
  streamItemQueue: Array<StreamItemRecord>;
}

export interface StreamItemsResult {
  streamRecord: StreamRecord;
  errors?: ReadonlyArray<GraphQLError>;
  result?: StreamItemsRecordResult;
  incrementalDataRecords?: ReadonlyArray<IncrementalDataRecord> | undefined;
}

export interface CancellableStreamRecord extends StreamRecord {
  earlyReturn: () => Promise<unknown>;
}

export function isCancellableStreamRecord(
  deliveryGroup: DeliveryGroup,
): deliveryGroup is CancellableStreamRecord {
  return 'earlyReturn' in deliveryGroup;
}

export type IncrementalDataRecord = PendingExecutionGroup | StreamRecord;

export type IncrementalDataRecordResult =
  | CompletedExecutionGroup
  | StreamItemsResult;
