import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.js';
import type { GroupedFieldSet } from './buildFieldPlan.js';
interface IncrementalUpdate<TData = unknown, TExtensions = ObjMap<unknown>> {
  pending: ReadonlyArray<PendingResult>;
  incremental: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  completed: ReadonlyArray<CompletedResult>;
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
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TData, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TData, TExtensions>,
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
> extends Partial<IncrementalUpdate<TData, TExtensions>> {
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
  errors?: ReadonlyArray<GraphQLError>;
  data: TData;
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
export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items: TData;
  id: string;
  subPath?: ReadonlyArray<string | number>;
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
  path: ReadonlyArray<string | number>;
  label?: string;
  errors?: ReadonlyArray<GraphQLError>;
}
/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * The internal publishing state is managed as follows:
 *
 * '_released': the set of Subsequent Result records that are ready to be sent to the client,
 * i.e. their parents have completed and they have also completed.
 *
 * `_pending`: the set of Subsequent Result records that are definitely pending, i.e. their
 * parents have completed so that they can no longer be filtered. This includes all Subsequent
 * Result records in `released`, as well as the records that have not yet completed.
 *
 * @internal
 */
export declare class IncrementalPublisher {
  private _nextId;
  private _released;
  private _pending;
  private _signalled;
  private _resolve;
  constructor();
  reportNewDeferFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
    parentIncrementalResultRecord:
      | InitialResultRecord
      | DeferredFragmentRecord
      | StreamItemsRecord,
  ): void;
  reportNewDeferredGroupedFieldSetRecord(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): void;
  reportNewStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    parentIncrementalDataRecord: IncrementalDataRecord,
  ): void;
  completeDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
    data: ObjMap<unknown>,
  ): void;
  markErroredDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
    error: GraphQLError,
  ): void;
  completeDeferredFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): void;
  completeStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    items: Array<unknown>,
  ): void;
  markErroredStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    error: GraphQLError,
  ): void;
  setIsFinalRecord(streamItemsRecord: StreamItemsRecord): void;
  setIsCompletedAsyncIterator(streamItemsRecord: StreamItemsRecord): void;
  addFieldError(
    incrementalDataRecord: IncrementalDataRecord,
    error: GraphQLError,
  ): void;
  buildDataResponse(
    initialResultRecord: InitialResultRecord,
    data: ObjMap<unknown> | null,
  ): ExecutionResult | ExperimentalIncrementalExecutionResults;
  buildErrorResponse(
    initialResultRecord: InitialResultRecord,
    error: GraphQLError,
  ): ExecutionResult;
  filter(
    nullPath: Path | undefined,
    erroringIncrementalDataRecord: IncrementalDataRecord,
  ): void;
  private _pendingSourcesToResults;
  private _getNextId;
  private _subscribe;
  private _trigger;
  private _reset;
  private _introduce;
  private _release;
  private _push;
  private _getIncrementalResult;
  private _processPending;
  private _getIncrementalDeferResult;
  private _completedRecordToResult;
  private _publish;
  private _getChildren;
  private _getDescendants;
  private _nullsChildSubsequentResultRecord;
  private _matchesPath;
}
/** @internal */
export declare class InitialResultRecord {
  errors: Array<GraphQLError>;
  children: Set<SubsequentResultRecord>;
  constructor();
}
/** @internal */
export declare class DeferredGroupedFieldSetRecord {
  path: ReadonlyArray<string | number>;
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
  errors: Array<GraphQLError>;
  data: ObjMap<unknown> | undefined;
  sent: boolean;
  constructor(opts: {
    path: Path | undefined;
    deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
    groupedFieldSet: GroupedFieldSet;
    shouldInitiateDefer: boolean;
  });
}
/** @internal */
export declare class DeferredFragmentRecord {
  path: ReadonlyArray<string | number>;
  label: string | undefined;
  id: string | undefined;
  children: Set<SubsequentResultRecord>;
  deferredGroupedFieldSetRecords: Set<DeferredGroupedFieldSetRecord>;
  errors: Array<GraphQLError>;
  filtered: boolean;
  pendingSent?: boolean;
  _pending: Set<DeferredGroupedFieldSetRecord>;
  constructor(opts: { path: Path | undefined; label: string | undefined });
}
/** @internal */
export declare class StreamRecord {
  label: string | undefined;
  path: ReadonlyArray<string | number>;
  id: string | undefined;
  errors: Array<GraphQLError>;
  earlyReturn?: (() => Promise<unknown>) | undefined;
  pendingSent?: boolean;
  constructor(opts: {
    label: string | undefined;
    path: Path;
    earlyReturn?: (() => Promise<unknown>) | undefined;
  });
}
/** @internal */
export declare class StreamItemsRecord {
  errors: Array<GraphQLError>;
  streamRecord: StreamRecord;
  path: ReadonlyArray<string | number>;
  items: Array<unknown> | undefined;
  children: Set<SubsequentResultRecord>;
  isFinalRecord?: boolean;
  isCompletedAsyncIterator?: boolean;
  isCompleted: boolean;
  filtered: boolean;
  constructor(opts: { streamRecord: StreamRecord; path: Path | undefined });
}
export type IncrementalDataRecord =
  | InitialResultRecord
  | DeferredGroupedFieldSetRecord
  | StreamItemsRecord;
type SubsequentResultRecord = DeferredFragmentRecord | StreamItemsRecord;
export {};
