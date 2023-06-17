import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import { pathToArray } from '../jsutils/Path.ts';
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
export class IncrementalPublisher {
  private _initialResult: {
    children: Set<IncrementalDataRecord>;
    isCompleted: boolean;
  };
  private _released: Set<IncrementalDataRecord>;
  private _pending: Set<IncrementalDataRecord>;
  // these are assigned within the Promise executor called synchronously within the constructor
  private _signalled!: Promise<unknown>;
  private _resolve!: () => void;
  constructor() {
    this._initialResult = {
      children: new Set(),
      isCompleted: false,
    };
    this._released = new Set();
    this._pending = new Set();
    this._reset();
  }
  hasNext(): boolean {
    return this._pending.size > 0;
  }
  subscribe(): AsyncGenerator<
    SubsequentIncrementalExecutionResult,
    void,
    void
  > {
    let isDone = false;
    const _next = async (): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (isDone) {
          return { value: undefined, done: true };
        }
        for (const item of this._released) {
          this._pending.delete(item);
        }
        const released = this._released;
        this._released = new Set();
        const result = this._getIncrementalResult(released);
        if (!this.hasNext()) {
          isDone = true;
        }
        if (result !== undefined) {
          return { value: result, done: false };
        }
        // eslint-disable-next-line no-await-in-loop
        await this._signalled;
      }
    };
    const returnStreamIterators = async (): Promise<void> => {
      const promises: Array<Promise<IteratorResult<unknown>>> = [];
      this._pending.forEach((incrementalDataRecord) => {
        if (
          isStreamItemsRecord(incrementalDataRecord) &&
          incrementalDataRecord.asyncIterator?.return
        ) {
          promises.push(incrementalDataRecord.asyncIterator.return());
        }
      });
      await Promise.all(promises);
    };
    const _return = async (): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > => {
      isDone = true;
      await returnStreamIterators();
      return { value: undefined, done: true };
    };
    const _throw = async (
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> => {
      isDone = true;
      await returnStreamIterators();
      return Promise.reject(error);
    };
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: _next,
      return: _return,
      throw: _throw,
    };
  }
  prepareNewDeferredFragmentRecord(opts: {
    label: string | undefined;
    path: Path | undefined;
    parentContext: IncrementalDataRecord | undefined;
  }): DeferredFragmentRecord {
    const deferredFragmentRecord = new DeferredFragmentRecord(opts);
    const parentContext = opts.parentContext;
    if (parentContext) {
      parentContext.children.add(deferredFragmentRecord);
    } else {
      this._initialResult.children.add(deferredFragmentRecord);
    }
    return deferredFragmentRecord;
  }
  prepareNewStreamItemsRecord(opts: {
    label: string | undefined;
    path: Path | undefined;
    asyncIterator?: AsyncIterator<unknown>;
    parentContext: IncrementalDataRecord | undefined;
  }): StreamItemsRecord {
    const streamItemsRecord = new StreamItemsRecord(opts);
    const parentContext = opts.parentContext;
    if (parentContext) {
      parentContext.children.add(streamItemsRecord);
    } else {
      this._initialResult.children.add(streamItemsRecord);
    }
    return streamItemsRecord;
  }
  completeDeferredFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
    data: ObjMap<unknown> | null,
  ): void {
    deferredFragmentRecord.data = data;
    deferredFragmentRecord.isCompleted = true;
    this._release(deferredFragmentRecord);
  }
  completeStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    items: Array<unknown> | null,
  ) {
    streamItemsRecord.items = items;
    streamItemsRecord.isCompleted = true;
    this._release(streamItemsRecord);
  }
  setIsCompletedAsyncIterator(streamItemsRecord: StreamItemsRecord) {
    streamItemsRecord.isCompletedAsyncIterator = true;
  }
  addFieldError(
    incrementalDataRecord: IncrementalDataRecord,
    error: GraphQLError,
  ) {
    incrementalDataRecord.errors.push(error);
  }
  publishInitial() {
    for (const child of this._initialResult.children) {
      this._publish(child);
    }
  }
  filter(
    nullPath: Path,
    erroringIncrementalDataRecord: IncrementalDataRecord | undefined,
  ) {
    const nullPathArray = pathToArray(nullPath);
    const asyncIterators = new Set<AsyncIterator<unknown>>();
    const children =
      erroringIncrementalDataRecord === undefined
        ? this._initialResult.children
        : erroringIncrementalDataRecord.children;
    for (const child of this._getDescendants(children)) {
      if (!this._matchesPath(child.path, nullPathArray)) {
        continue;
      }
      this._delete(child);
      const parent =
        child.parentContext === undefined
          ? this._initialResult
          : child.parentContext;
      parent.children.delete(child);
      if (isStreamItemsRecord(child)) {
        if (child.asyncIterator !== undefined) {
          asyncIterators.add(child.asyncIterator);
        }
      }
    }
    asyncIterators.forEach((asyncIterator) => {
      asyncIterator.return?.().catch(() => {
        // ignore error
      });
    });
  }
  private _trigger() {
    this._resolve();
    this._reset();
  }
  private _reset() {
    // promiseWithResolvers uses void only as a generic type parameter
    // see: https://typescript-eslint.io/rules/no-invalid-void-type/
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise: signalled, resolve } = promiseWithResolvers<void>();
    this._resolve = resolve;
    this._signalled = signalled;
  }
  private _introduce(item: IncrementalDataRecord) {
    this._pending.add(item);
  }
  private _release(item: IncrementalDataRecord): void {
    if (this._pending.has(item)) {
      this._released.add(item);
      this._trigger();
    }
  }
  private _push(item: IncrementalDataRecord): void {
    this._released.add(item);
    this._pending.add(item);
    this._trigger();
  }
  private _delete(item: IncrementalDataRecord) {
    this._released.delete(item);
    this._pending.delete(item);
    this._trigger();
  }
  private _getIncrementalResult(
    completedRecords: ReadonlySet<IncrementalDataRecord>,
  ): SubsequentIncrementalExecutionResult | undefined {
    const incrementalResults: Array<IncrementalResult> = [];
    let encounteredCompletedAsyncIterator = false;
    for (const incrementalDataRecord of completedRecords) {
      const incrementalResult: IncrementalResult = {};
      for (const child of incrementalDataRecord.children) {
        this._publish(child);
      }
      if (isStreamItemsRecord(incrementalDataRecord)) {
        const items = incrementalDataRecord.items;
        if (incrementalDataRecord.isCompletedAsyncIterator) {
          // async iterable resolver just finished but there may be pending payloads
          encounteredCompletedAsyncIterator = true;
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
    return incrementalResults.length
      ? { incremental: incrementalResults, hasNext: this.hasNext() }
      : encounteredCompletedAsyncIterator && !this.hasNext()
      ? { hasNext: false }
      : undefined;
  }
  private _publish(incrementalDataRecord: IncrementalDataRecord) {
    if (incrementalDataRecord.isCompleted) {
      this._push(incrementalDataRecord);
    } else {
      this._introduce(incrementalDataRecord);
    }
  }
  private _getDescendants(
    children: ReadonlySet<IncrementalDataRecord>,
    descendants = new Set<IncrementalDataRecord>(),
  ): ReadonlySet<IncrementalDataRecord> {
    for (const child of children) {
      descendants.add(child);
      this._getDescendants(child.children, descendants);
    }
    return descendants;
  }
  private _matchesPath(
    testPath: Array<string | number>,
    basePath: Array<string | number>,
  ): boolean {
    for (let i = 0; i < basePath.length; i++) {
      if (basePath[i] !== testPath[i]) {
        // testPath points to a path unaffected at basePath
        return false;
      }
    }
    return true;
  }
}
/** @internal */
export class DeferredFragmentRecord {
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
  }) {
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.parentContext = opts.parentContext;
    this.errors = [];
    this.children = new Set();
    this.isCompleted = false;
    this.data = null;
  }
}
/** @internal */
export class StreamItemsRecord {
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
  }) {
    this.items = null;
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.parentContext = opts.parentContext;
    this.asyncIterator = opts.asyncIterator;
    this.errors = [];
    this.children = new Set();
    this.isCompleted = false;
    this.items = null;
  }
}
export type IncrementalDataRecord = DeferredFragmentRecord | StreamItemsRecord;
function isStreamItemsRecord(
  incrementalDataRecord: IncrementalDataRecord,
): incrementalDataRecord is StreamItemsRecord {
  return incrementalDataRecord instanceof StreamItemsRecord;
}
