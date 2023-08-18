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
  TData = ObjMap<unknown>,
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
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface SubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface FormattedSubsequentIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  extensions?: TExtensions;
}
export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
export type IncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;
export type FormattedIncrementalResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TData, TExtensions>;
/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * The internal publishing state is managed as follows:
 *
 * '_released': the set of Incremental Data records that are ready to be sent to the client,
 * i.e. their parents have completed and they have also completed.
 *
 * `_pending`: the set of Incremental Data records that are definitely pending, i.e. their
 * parents have completed so that they can no longer be filtered. This includes all Incremental
 * Data records in `released`, as well as Incremental Data records that have not yet completed.
 *
 * @internal
 */
export declare class IncrementalPublisher {
  private _released;
  private _pending;
  private _signalled;
  private _resolve;
  constructor();
  prepareInitialResultRecord(): InitialResultRecord;
  prepareNewDeferredFragmentRecord(opts: {
    label: string | undefined;
    path: Path | undefined;
    parentContext: IncrementalDataRecord;
  }): DeferredFragmentRecord;
  prepareNewStreamItemsRecord(opts: {
    label: string | undefined;
    path: Path | undefined;
    asyncIterator?: AsyncIterator<unknown>;
    parentContext: IncrementalDataRecord;
  }): StreamItemsRecord;
  completeDeferredFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
    data: ObjMap<unknown> | null,
  ): void;
  completeStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    items: Array<unknown> | null,
  ): void;
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
    nullPath: Path,
    erroringIncrementalDataRecord: IncrementalDataRecord,
  ): void;
  private _subscribe;
  private _trigger;
  private _reset;
  private _introduce;
  private _release;
  private _push;
  private _getIncrementalResult;
  private _publish;
  private _getDescendants;
  private _matchesPath;
}
export interface InitialResultRecord {
  errors: Array<GraphQLError>;
  children: Set<SubsequentDataRecord>;
}
/** @internal */
export declare class DeferredFragmentRecord {
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  data: ObjMap<unknown> | null;
  children: Set<SubsequentDataRecord>;
  isCompleted: boolean;
  filtered: boolean;
  constructor(opts: { label: string | undefined; path: Path | undefined });
}
/** @internal */
export declare class StreamItemsRecord {
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  items: Array<unknown> | null;
  children: Set<SubsequentDataRecord>;
  asyncIterator: AsyncIterator<unknown> | undefined;
  isCompletedAsyncIterator?: boolean;
  isCompleted: boolean;
  filtered: boolean;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    asyncIterator?: AsyncIterator<unknown>;
  });
}
export type SubsequentDataRecord = DeferredFragmentRecord | StreamItemsRecord;
export type IncrementalDataRecord = InitialResultRecord | SubsequentDataRecord;
