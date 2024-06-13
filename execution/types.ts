import type { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.ts';
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
interface BareDeferredGroupedFieldSetResult<TData = ObjMap<unknown>> {
  errors?: ReadonlyArray<GraphQLError>;
  data: TData;
}
export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends BareDeferredGroupedFieldSetResult<TData> {
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
interface BareStreamItemsResult<TData = ReadonlyArray<unknown>> {
  errors?: ReadonlyArray<GraphQLError>;
  items: TData;
}
export interface IncrementalStreamResult<
  TData = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> extends BareStreamItemsResult<TData> {
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
export function isDeferredGroupedFieldSetRecord(
  incrementalDataRecord: IncrementalDataRecord,
): incrementalDataRecord is DeferredGroupedFieldSetRecord {
  return 'deferredFragmentRecords' in incrementalDataRecord;
}
export type DeferredGroupedFieldSetResult =
  | ReconcilableDeferredGroupedFieldSetResult
  | NonReconcilableDeferredGroupedFieldSetResult;
export function isDeferredGroupedFieldSetResult(
  subsequentResult: DeferredGroupedFieldSetResult | StreamItemsResult,
): subsequentResult is DeferredGroupedFieldSetResult {
  return 'deferredGroupedFieldSetRecord' in subsequentResult;
}
export interface ReconcilableDeferredGroupedFieldSetResult {
  deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord;
  path: Array<string | number>;
  result: BareDeferredGroupedFieldSetResult;
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord> | undefined;
  errors?: never;
}
interface NonReconcilableDeferredGroupedFieldSetResult {
  deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord;
  path: Array<string | number>;
  errors: ReadonlyArray<GraphQLError>;
  result?: never;
}
export function isNonReconcilableDeferredGroupedFieldSetResult(
  deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
): deferredGroupedFieldSetResult is NonReconcilableDeferredGroupedFieldSetResult {
  return deferredGroupedFieldSetResult.errors !== undefined;
}
type ThunkIncrementalResult<T> =
  | BoxedPromiseOrValue<T>
  | (() => BoxedPromiseOrValue<T>);
export interface DeferredGroupedFieldSetRecord {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  result: ThunkIncrementalResult<DeferredGroupedFieldSetResult>;
}
export type SubsequentResultRecord = DeferredFragmentRecord | StreamRecord;
export interface DeferredFragmentRecord {
  path: Path | undefined;
  label: string | undefined;
  id?: string | undefined;
  parent: DeferredFragmentRecord | undefined;
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
  result?: BareStreamItemsResult | undefined;
  incrementalDataRecords?: ReadonlyArray<IncrementalDataRecord> | undefined;
  errors?: ReadonlyArray<GraphQLError> | undefined;
}
export interface CancellableStreamRecord extends StreamRecord {
  earlyReturn: () => Promise<unknown>;
}
export function isCancellableStreamRecord(
  subsequentResultRecord: SubsequentResultRecord,
): subsequentResultRecord is CancellableStreamRecord {
  return 'earlyReturn' in subsequentResultRecord;
}
export type IncrementalDataRecord =
  | DeferredGroupedFieldSetRecord
  | StreamRecord;
export type IncrementalDataRecordResult =
  | DeferredGroupedFieldSetResult
  | StreamItemsResult;
