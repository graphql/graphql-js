import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
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
export declare function yieldSubsequentPayloads(
  subsequentPayloads: Set<IncrementalDataRecord>,
): AsyncGenerator<SubsequentIncrementalExecutionResult, void, void>;
export declare function filterSubsequentPayloads(
  subsequentPayloads: Set<IncrementalDataRecord>,
  nullPath: Path,
  currentIncrementalDataRecord: IncrementalDataRecord | undefined,
): void;
/** @internal */
export declare class DeferredFragmentRecord {
  type: 'defer';
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  promise: Promise<void>;
  data: ObjMap<unknown> | null;
  parentContext: IncrementalDataRecord | undefined;
  isCompleted: boolean;
  _subsequentPayloads: Set<IncrementalDataRecord>;
  _resolve?: (arg: PromiseOrValue<ObjMap<unknown> | null>) => void;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    parentContext: IncrementalDataRecord | undefined;
    subsequentPayloads: Set<IncrementalDataRecord>;
  });
  addData(data: PromiseOrValue<ObjMap<unknown> | null>): void;
}
/** @internal */
export declare class StreamItemsRecord {
  type: 'stream';
  errors: Array<GraphQLError>;
  label: string | undefined;
  path: Array<string | number>;
  items: Array<unknown> | null;
  promise: Promise<void>;
  parentContext: IncrementalDataRecord | undefined;
  asyncIterator: AsyncIterator<unknown> | undefined;
  isCompletedAsyncIterator?: boolean;
  isCompleted: boolean;
  _subsequentPayloads: Set<IncrementalDataRecord>;
  _resolve?: (arg: PromiseOrValue<Array<unknown> | null>) => void;
  constructor(opts: {
    label: string | undefined;
    path: Path | undefined;
    asyncIterator?: AsyncIterator<unknown>;
    parentContext: IncrementalDataRecord | undefined;
    subsequentPayloads: Set<IncrementalDataRecord>;
  });
  addItems(items: PromiseOrValue<Array<unknown> | null>): void;
  setIsCompletedAsyncIterator(): void;
}
export type IncrementalDataRecord = DeferredFragmentRecord | StreamItemsRecord;
