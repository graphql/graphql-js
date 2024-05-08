import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
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
export declare function buildIncrementalResponse(
  context: IncrementalPublisherContext,
  result: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError> | undefined,
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
): ExperimentalIncrementalExecutionResults;
interface IncrementalPublisherContext {
  cancellableStreams: Set<CancellableStreamRecord> | undefined;
}
export type DeferredGroupedFieldSetResult =
  | ReconcilableDeferredGroupedFieldSetResult
  | NonReconcilableDeferredGroupedFieldSetResult;
interface ReconcilableDeferredGroupedFieldSetResult {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  path: Array<string | number>;
  result: BareDeferredGroupedFieldSetResult;
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord> | undefined;
  sent?: true | undefined;
  errors?: never;
}
interface NonReconcilableDeferredGroupedFieldSetResult {
  errors: ReadonlyArray<GraphQLError>;
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  path: Array<string | number>;
  result?: never;
}
export interface DeferredGroupedFieldSetRecord {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  result: PromiseOrValue<DeferredGroupedFieldSetResult>;
}
export interface SubsequentResultRecord {
  path: Path | undefined;
  label: string | undefined;
  id?: string | undefined;
}
/** @internal */
export declare class DeferredFragmentRecord implements SubsequentResultRecord {
  path: Path | undefined;
  label: string | undefined;
  id?: string | undefined;
  parent: DeferredFragmentRecord | undefined;
  expectedReconcilableResults: number;
  results: Array<DeferredGroupedFieldSetResult>;
  reconcilableResults: Array<ReconcilableDeferredGroupedFieldSetResult>;
  children: Set<DeferredFragmentRecord>;
  constructor(opts: {
    path: Path | undefined;
    label: string | undefined;
    parent: DeferredFragmentRecord | undefined;
  });
}
export interface CancellableStreamRecord extends SubsequentResultRecord {
  earlyReturn: () => Promise<unknown>;
}
interface ReconcilableStreamItemsResult {
  streamRecord: SubsequentResultRecord;
  result: BareStreamItemsResult;
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord> | undefined;
  errors?: never;
}
export declare function isReconcilableStreamItemsResult(
  streamItemsResult: StreamItemsResult,
): streamItemsResult is ReconcilableStreamItemsResult;
interface TerminatingStreamItemsResult {
  streamRecord: SubsequentResultRecord;
  result?: never;
  incrementalDataRecords?: never;
  errors?: never;
}
interface NonReconcilableStreamItemsResult {
  streamRecord: SubsequentResultRecord;
  errors: ReadonlyArray<GraphQLError>;
  result?: never;
}
export type StreamItemsResult =
  | ReconcilableStreamItemsResult
  | TerminatingStreamItemsResult
  | NonReconcilableStreamItemsResult;
export interface StreamItemsRecord {
  streamRecord: SubsequentResultRecord;
  result: PromiseOrValue<StreamItemsResult>;
}
export type IncrementalDataRecord =
  | DeferredGroupedFieldSetRecord
  | StreamItemsRecord;
export type IncrementalDataRecordResult =
  | DeferredGroupedFieldSetResult
  | StreamItemsResult;
export {};
