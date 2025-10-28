/* eslint-disable @typescript-eslint/no-empty-object-type */
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
  TError extends GraphQLFormattedError = GraphQLError,
> {
  errors?: ReadonlyArray<TError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface ExperimentalIncrementalExecutionResults<
  TInitial = ObjMap<unknown>,
  TSubsequent = unknown,
  TExtensions = ObjMap<unknown>,
  TError extends GraphQLFormattedError = GraphQLError,
> {
  initialResult: InitialIncrementalExecutionResult<
    TInitial,
    TExtensions,
    TError
  >;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TSubsequent, TExtensions, TError>,
    void,
    void
  >;
}

export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
  TError extends GraphQLFormattedError = GraphQLError,
> extends ExecutionResult<TData, TExtensions, TError> {
  data: TData;
  pending: ReadonlyArray<PendingResult>;
  hasNext: true;
  extensions?: TExtensions;
}

export interface SubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
  TError extends GraphQLFormattedError = GraphQLError,
> {
  pending?: ReadonlyArray<PendingResult>;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions, TError>>;
  completed?: ReadonlyArray<CompletedResult<TError>>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
  TError extends GraphQLFormattedError = GraphQLError,
> {
  errors?: ReadonlyArray<TError>;
  data: TData;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export interface IncrementalStreamResult<
  TData = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
  TError extends GraphQLFormattedError = GraphQLError,
> {
  errors?: ReadonlyArray<TError>;
  items: TData;
  id: string;
  subPath?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export type IncrementalResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
  TError extends GraphQLFormattedError = GraphQLError,
> =
  | IncrementalDeferResult<TData, TExtensions, TError>
  | IncrementalStreamResult<TData, TExtensions, TError>;

export interface PendingResult {
  id: string;
  path: ReadonlyArray<string | number>;
  label?: string;
}

export interface CompletedResult<
  TError extends GraphQLFormattedError = GraphQLError,
> {
  id: string;
  errors?: ReadonlyArray<TError>;
}

export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions, GraphQLFormattedError> {}

export interface FormattedExperimentalIncrementalExecutionResults<
  TInitial = ObjMap<unknown>,
  TSubsequent = unknown,
  TExtensions = ObjMap<unknown>,
> extends ExperimentalIncrementalExecutionResults<
    TInitial,
    TSubsequent,
    TExtensions,
    GraphQLFormattedError
  > {}

export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends InitialIncrementalExecutionResult<
    TData,
    TExtensions,
    GraphQLFormattedError
  > {}

export interface FormattedSubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> extends SubsequentIncrementalExecutionResult<
    TData,
    TExtensions,
    GraphQLFormattedError
  > {}

export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends IncrementalDeferResult<TData, TExtensions, GraphQLFormattedError> {}

export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> extends IncrementalStreamResult<TData, TExtensions, GraphQLFormattedError> {}

export type FormattedIncrementalResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> = IncrementalResult<TData, TExtensions, GraphQLFormattedError>;

export interface FormattedCompletedResult
  extends CompletedResult<GraphQLFormattedError> {}

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
  result: {
    errors?: ReadonlyArray<GraphQLError>;
    data: ObjMap<unknown>;
  };
  newDeferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord> | undefined;
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
  newDeferredFragmentRecords?:
    | ReadonlyArray<DeferredFragmentRecord>
    | undefined;
  incrementalDataRecords?: ReadonlyArray<IncrementalDataRecord> | undefined;
  errors?: ReadonlyArray<GraphQLError>;
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
  result?: {
    errors?: ReadonlyArray<GraphQLError>;
    items: ReadonlyArray<unknown>;
  };
  newDeferredFragmentRecords?:
    | ReadonlyArray<DeferredFragmentRecord>
    | undefined;
  incrementalDataRecords?: ReadonlyArray<IncrementalDataRecord> | undefined;
}

export type IncrementalDataRecord = PendingExecutionGroup | StreamRecord;

export type IncrementalDataRecordResult =
  | CompletedExecutionGroup
  | StreamItemsResult;
