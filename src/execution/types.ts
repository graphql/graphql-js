import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.js';

import type { Group, Stream, Work } from './WorkQueue.js';
import { Task } from './WorkQueue.js';

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
  TSubsequent = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TInitial, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TSubsequent, TExtensions>,
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

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  data: TData;
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
  TData = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  id: string;
  subPath?: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  items: TData;
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
  id: string;
  errors?: ReadonlyArray<GraphQLFormattedError>;
}

export function isExecutionGroup(
  incrementalDataRecord: IncrementalDataRecord,
): incrementalDataRecord is ExecutionGroup {
  return incrementalDataRecord instanceof Task;
}

export type ExecutionGroup = Task<
  ExecutionGroupValue,
  StreamItemValue,
  DeferredFragmentRecord,
  StreamRecord
>;

/** @internal */
export interface DeferredFragmentRecord extends Group<DeferredFragmentRecord> {
  path: Path | undefined;
  label: string | undefined;
  parent: DeferredFragmentRecord | undefined;
}

export interface StreamRecord
  extends Stream<
    ExecutionGroupValue,
    StreamItemValue,
    DeferredFragmentRecord,
    StreamRecord
  > {
  path: Path;
  label: string | undefined;
}

export interface ExecutionGroupValue {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  path: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  data: ObjMap<unknown>;
}

export type IncrementalWork = Work<
  ExecutionGroupValue,
  StreamItemValue,
  DeferredFragmentRecord,
  StreamRecord
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

export type IncrementalDataRecord = ExecutionGroup | StreamRecord;
