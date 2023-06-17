import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.js';
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
 * `_initialResult`: a record containing the state of the initial result, as follows:
 * `isCompleted`: indicates whether the initial result has completed.
 * `children`: the set of Incremental Data records that can be be published when the initial
 * result is completed.
 *
 * Each Incremental Data record also contains similar metadata, i.e. these records also contain
 * similar `isCompleted` and `children` properties.
 *
 * @internal
 */
export declare class IncrementalPublisher {
  private _initialResult;
  private _released;
  private _pending;
  private _signalled;
  private _resolve;
  constructor();
  hasNext(): boolean;
  subscribe(): AsyncGenerator<SubsequentIncrementalExecutionResult, void, void>;
  prepareNewDeferredFragmentRecord(opts: {
    label: string | undefined;
    path: Path | undefined;
    parentContext: IncrementalDataRecord | undefined;
  }): DeferredFragmentRecord;
  prepareNewStreamItemsRecord(opts: {
    label: string | undefined;
    path: Path | undefined;
    asyncIterator?: AsyncIterator<unknown>;
    parentContext: IncrementalDataRecord | undefined;
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
  publishInitial(): void;
  filter(
    nullPath: Path,
    erroringIncrementalDataRecord: IncrementalDataRecord | undefined,
  ): void;
  private _trigger;
  private _reset;
  private _introduce;
  private _release;
  private _push;
  private _delete;
  private _getIncrementalResult;
  private _publish;
  private _getDescendants;
  private _matchesPath;
}
/** @internal */
export declare class DeferredFragmentRecord {
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  data: ObjMap<unknown> | null;
  parentContext: IncrementalDataRecord | undefined;
  children: Set<IncrementalDataRecord>;
  isCompleted: boolean;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    parentContext: IncrementalDataRecord | undefined;
  });
}
/** @internal */
export declare class StreamItemsRecord {
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  items: Array<unknown> | null;
  parentContext: IncrementalDataRecord | undefined;
  children: Set<IncrementalDataRecord>;
  asyncIterator: AsyncIterator<unknown> | undefined;
  isCompletedAsyncIterator?: boolean;
  isCompleted: boolean;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    asyncIterator?: AsyncIterator<unknown>;
    parentContext: IncrementalDataRecord | undefined;
  });
}
export type IncrementalDataRecord = DeferredFragmentRecord | StreamItemsRecord;
