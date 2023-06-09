import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import { pathToArray } from '../jsutils/Path.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.ts';
import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.ts';
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
export function yieldSubsequentPayloads(
  subsequentPayloads: Set<IncrementalDataRecord>,
): AsyncGenerator<SubsequentIncrementalExecutionResult, void, void> {
  let isDone = false;
  async function next(): Promise<
    IteratorResult<SubsequentIncrementalExecutionResult, void>
  > {
    if (isDone) {
      return { value: undefined, done: true };
    }
    await Promise.race(Array.from(subsequentPayloads).map((p) => p.promise));
    if (isDone) {
      // a different call to next has exhausted all payloads
      return { value: undefined, done: true };
    }
    const incremental = getCompletedIncrementalResults(subsequentPayloads);
    const hasNext = subsequentPayloads.size > 0;
    if (!incremental.length && hasNext) {
      return next();
    }
    if (!hasNext) {
      isDone = true;
    }
    return {
      value: incremental.length ? { incremental, hasNext } : { hasNext },
      done: false,
    };
  }
  function returnStreamIterators() {
    const promises: Array<Promise<IteratorResult<unknown>>> = [];
    subsequentPayloads.forEach((incrementalDataRecord) => {
      if (
        isStreamItemsRecord(incrementalDataRecord) &&
        incrementalDataRecord.asyncIterator?.return
      ) {
        promises.push(incrementalDataRecord.asyncIterator.return());
      }
    });
    return Promise.all(promises);
  }
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next,
    async return(): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > {
      await returnStreamIterators();
      isDone = true;
      return { value: undefined, done: true };
    },
    async throw(
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> {
      await returnStreamIterators();
      isDone = true;
      return Promise.reject(error);
    },
  };
}
function getCompletedIncrementalResults(
  subsequentPayloads: Set<IncrementalDataRecord>,
): Array<IncrementalResult> {
  const incrementalResults: Array<IncrementalResult> = [];
  for (const incrementalDataRecord of subsequentPayloads) {
    const incrementalResult: IncrementalResult = {};
    if (!incrementalDataRecord.isCompleted) {
      continue;
    }
    subsequentPayloads.delete(incrementalDataRecord);
    if (isStreamItemsRecord(incrementalDataRecord)) {
      const items = incrementalDataRecord.items;
      if (incrementalDataRecord.isCompletedAsyncIterator) {
        // async iterable resolver just finished but there may be pending payloads
        continue;
      }
      (incrementalResult as IncrementalStreamResult).items = items;
    } else {
      const data = incrementalDataRecord.data;
      (incrementalResult as IncrementalDeferResult).data = data ?? null;
    }
    incrementalResult.path = incrementalDataRecord.path;
    if (incrementalDataRecord.label != null) {
      incrementalResult.label = incrementalDataRecord.label;
    }
    if (incrementalDataRecord.errors.length > 0) {
      incrementalResult.errors = incrementalDataRecord.errors;
    }
    incrementalResults.push(incrementalResult);
  }
  return incrementalResults;
}
export function filterSubsequentPayloads(
  subsequentPayloads: Set<IncrementalDataRecord>,
  nullPath: Path,
  currentIncrementalDataRecord: IncrementalDataRecord | undefined,
): void {
  const nullPathArray = pathToArray(nullPath);
  subsequentPayloads.forEach((incrementalDataRecord) => {
    if (incrementalDataRecord === currentIncrementalDataRecord) {
      // don't remove payload from where error originates
      return;
    }
    for (let i = 0; i < nullPathArray.length; i++) {
      if (incrementalDataRecord.path[i] !== nullPathArray[i]) {
        // incrementalDataRecord points to a path unaffected by this payload
        return;
      }
    }
    // incrementalDataRecord path points to nulled error field
    if (
      isStreamItemsRecord(incrementalDataRecord) &&
      incrementalDataRecord.asyncIterator?.return
    ) {
      incrementalDataRecord.asyncIterator.return().catch(() => {
        // ignore error
      });
    }
    subsequentPayloads.delete(incrementalDataRecord);
  });
}
/** @internal */
export class DeferredFragmentRecord {
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
  }) {
    this.type = 'defer';
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.parentContext = opts.parentContext;
    this.errors = [];
    this._subsequentPayloads = opts.subsequentPayloads;
    this._subsequentPayloads.add(this);
    this.isCompleted = false;
    this.data = null;
    const { promise, resolve } = promiseWithResolvers<ObjMap<unknown> | null>();
    this._resolve = resolve;
    this.promise = promise.then((data) => {
      this.data = data;
      this.isCompleted = true;
    });
  }
  addData(data: PromiseOrValue<ObjMap<unknown> | null>) {
    const parentData = this.parentContext?.promise;
    if (parentData) {
      this._resolve?.(parentData.then(() => data));
      return;
    }
    this._resolve?.(data);
  }
}
/** @internal */
export class StreamItemsRecord {
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
  }) {
    this.type = 'stream';
    this.items = null;
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.parentContext = opts.parentContext;
    this.asyncIterator = opts.asyncIterator;
    this.errors = [];
    this._subsequentPayloads = opts.subsequentPayloads;
    this._subsequentPayloads.add(this);
    this.isCompleted = false;
    this.items = null;
    const { promise, resolve } = promiseWithResolvers<Array<unknown> | null>();
    this._resolve = resolve;
    this.promise = promise.then((items) => {
      this.items = items;
      this.isCompleted = true;
    });
  }
  addItems(items: PromiseOrValue<Array<unknown> | null>) {
    const parentData = this.parentContext?.promise;
    if (parentData) {
      this._resolve?.(parentData.then(() => items));
      return;
    }
    this._resolve?.(items);
  }
  setIsCompletedAsyncIterator() {
    this.isCompletedAsyncIterator = true;
  }
}
export type IncrementalDataRecord = DeferredFragmentRecord | StreamItemsRecord;
function isStreamItemsRecord(
  incrementalDataRecord: IncrementalDataRecord,
): incrementalDataRecord is StreamItemsRecord {
  return incrementalDataRecord.type === 'stream';
}
