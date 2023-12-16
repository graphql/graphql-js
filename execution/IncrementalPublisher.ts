import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import { pathToArray } from '../jsutils/Path.ts';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.ts';
import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../error/GraphQLError.ts';
import type { GroupedFieldSet } from './buildFieldPlan.ts';
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
export class IncrementalPublisher {
  private _nextId = 0;
  private _released: Set<SubsequentResultRecord>;
  private _pending: Set<SubsequentResultRecord>;
  // these are assigned within the Promise executor called synchronously within the constructor
  private _signalled!: Promise<unknown>;
  private _resolve!: () => void;
  constructor() {
    this._released = new Set();
    this._pending = new Set();
    this._reset();
  }
  reportNewDeferFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
    parentIncrementalResultRecord:
      | InitialResultRecord
      | DeferredFragmentRecord
      | StreamItemsRecord,
  ): void {
    parentIncrementalResultRecord.children.add(deferredFragmentRecord);
  }
  reportNewDeferredGroupedFieldSetRecord(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): void {
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord._pending.add(deferredGroupedFieldSetRecord);
      deferredFragmentRecord.deferredGroupedFieldSetRecords.add(
        deferredGroupedFieldSetRecord,
      );
    }
  }
  reportNewStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    parentIncrementalDataRecord: IncrementalDataRecord,
  ): void {
    if (isDeferredGroupedFieldSetRecord(parentIncrementalDataRecord)) {
      for (const parent of parentIncrementalDataRecord.deferredFragmentRecords) {
        parent.children.add(streamItemsRecord);
      }
    } else {
      parentIncrementalDataRecord.children.add(streamItemsRecord);
    }
  }
  completeDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
    data: ObjMap<unknown>,
  ): void {
    deferredGroupedFieldSetRecord.data = data;
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord._pending.delete(deferredGroupedFieldSetRecord);
      if (deferredFragmentRecord._pending.size === 0) {
        this.completeDeferredFragmentRecord(deferredFragmentRecord);
      }
    }
  }
  markErroredDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
    error: GraphQLError,
  ): void {
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord.errors.push(error);
      this.completeDeferredFragmentRecord(deferredFragmentRecord);
    }
  }
  completeDeferredFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): void {
    this._release(deferredFragmentRecord);
  }
  completeStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    items: Array<unknown>,
  ) {
    streamItemsRecord.items = items;
    streamItemsRecord.isCompleted = true;
    this._release(streamItemsRecord);
  }
  markErroredStreamItemsRecord(
    streamItemsRecord: StreamItemsRecord,
    error: GraphQLError,
  ) {
    streamItemsRecord.streamRecord.errors.push(error);
    this.setIsFinalRecord(streamItemsRecord);
    streamItemsRecord.isCompleted = true;
    streamItemsRecord.streamRecord.earlyReturn?.().catch(() => {
      // ignore error
    });
    this._release(streamItemsRecord);
  }
  setIsFinalRecord(streamItemsRecord: StreamItemsRecord) {
    streamItemsRecord.isFinalRecord = true;
  }
  setIsCompletedAsyncIterator(streamItemsRecord: StreamItemsRecord) {
    streamItemsRecord.isCompletedAsyncIterator = true;
    this.setIsFinalRecord(streamItemsRecord);
  }
  addFieldError(
    incrementalDataRecord: IncrementalDataRecord,
    error: GraphQLError,
  ) {
    incrementalDataRecord.errors.push(error);
  }
  buildDataResponse(
    initialResultRecord: InitialResultRecord,
    data: ObjMap<unknown> | null,
  ): ExecutionResult | ExperimentalIncrementalExecutionResults {
    for (const child of initialResultRecord.children) {
      if (child.filtered) {
        continue;
      }
      this._publish(child);
    }
    const errors = initialResultRecord.errors;
    const initialResult = errors.length === 0 ? { data } : { errors, data };
    const pending = this._pending;
    if (pending.size > 0) {
      const pendingSources = new Set<DeferredFragmentRecord | StreamRecord>();
      for (const subsequentResultRecord of pending) {
        const pendingSource = isStreamItemsRecord(subsequentResultRecord)
          ? subsequentResultRecord.streamRecord
          : subsequentResultRecord;
        pendingSources.add(pendingSource);
      }
      return {
        initialResult: {
          ...initialResult,
          pending: this._pendingSourcesToResults(pendingSources),
          hasNext: true,
        },
        subsequentResults: this._subscribe(),
      };
    }
    return initialResult;
  }
  buildErrorResponse(
    initialResultRecord: InitialResultRecord,
    error: GraphQLError,
  ): ExecutionResult {
    const errors = initialResultRecord.errors;
    errors.push(error);
    return { data: null, errors };
  }
  filter(
    nullPath: Path | undefined,
    erroringIncrementalDataRecord: IncrementalDataRecord,
  ): void {
    const nullPathArray = pathToArray(nullPath);
    const streams = new Set<StreamRecord>();
    const children = this._getChildren(erroringIncrementalDataRecord);
    const descendants = this._getDescendants(children);
    for (const child of descendants) {
      if (!this._nullsChildSubsequentResultRecord(child, nullPathArray)) {
        continue;
      }
      child.filtered = true;
      if (isStreamItemsRecord(child)) {
        streams.add(child.streamRecord);
      }
    }
    streams.forEach((stream) => {
      stream.earlyReturn?.().catch(() => {
        // ignore error
      });
    });
  }
  private _pendingSourcesToResults(
    pendingSources: ReadonlySet<DeferredFragmentRecord | StreamRecord>,
  ): Array<PendingResult> {
    const pendingResults: Array<PendingResult> = [];
    for (const pendingSource of pendingSources) {
      pendingSource.pendingSent = true;
      const id = this._getNextId();
      pendingSource.id = id;
      const pendingResult: PendingResult = {
        id,
        path: pendingSource.path,
      };
      if (pendingSource.label !== undefined) {
        pendingResult.label = pendingSource.label;
      }
      pendingResults.push(pendingResult);
    }
    return pendingResults;
  }
  private _getNextId(): string {
    return String(this._nextId++);
  }
  private _subscribe(): AsyncGenerator<
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
        if (this._pending.size === 0) {
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
      const streams = new Set<StreamRecord>();
      const descendants = this._getDescendants(this._pending);
      for (const subsequentResultRecord of descendants) {
        if (isStreamItemsRecord(subsequentResultRecord)) {
          streams.add(subsequentResultRecord.streamRecord);
        }
      }
      const promises: Array<Promise<unknown>> = [];
      streams.forEach((streamRecord) => {
        if (streamRecord.earlyReturn) {
          promises.push(streamRecord.earlyReturn());
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
  private _introduce(item: SubsequentResultRecord) {
    this._pending.add(item);
  }
  private _release(item: SubsequentResultRecord): void {
    if (this._pending.has(item)) {
      this._released.add(item);
      this._trigger();
    }
  }
  private _push(item: SubsequentResultRecord): void {
    this._released.add(item);
    this._pending.add(item);
    this._trigger();
  }
  private _getIncrementalResult(
    completedRecords: ReadonlySet<SubsequentResultRecord>,
  ): SubsequentIncrementalExecutionResult | undefined {
    const { pending, incremental, completed } =
      this._processPending(completedRecords);
    const hasNext = this._pending.size > 0;
    if (incremental.length === 0 && completed.length === 0 && hasNext) {
      return undefined;
    }
    const result: SubsequentIncrementalExecutionResult = { hasNext };
    if (pending.length) {
      result.pending = pending;
    }
    if (incremental.length) {
      result.incremental = incremental;
    }
    if (completed.length) {
      result.completed = completed;
    }
    return result;
  }
  private _processPending(
    completedRecords: ReadonlySet<SubsequentResultRecord>,
  ): IncrementalUpdate {
    const newPendingSources = new Set<DeferredFragmentRecord | StreamRecord>();
    const incrementalResults: Array<IncrementalResult> = [];
    const completedResults: Array<CompletedResult> = [];
    for (const subsequentResultRecord of completedRecords) {
      for (const child of subsequentResultRecord.children) {
        if (child.filtered) {
          continue;
        }
        const pendingSource = isStreamItemsRecord(child)
          ? child.streamRecord
          : child;
        if (!pendingSource.pendingSent) {
          newPendingSources.add(pendingSource);
        }
        this._publish(child);
      }
      if (isStreamItemsRecord(subsequentResultRecord)) {
        if (subsequentResultRecord.isFinalRecord) {
          newPendingSources.delete(subsequentResultRecord.streamRecord);
          completedResults.push(
            this._completedRecordToResult(subsequentResultRecord.streamRecord),
          );
        }
        if (subsequentResultRecord.isCompletedAsyncIterator) {
          // async iterable resolver just finished but there may be pending payloads
          continue;
        }
        if (subsequentResultRecord.streamRecord.errors.length > 0) {
          continue;
        }
        const incrementalResult: IncrementalStreamResult = {
          // safe because `items` is always defined when the record is completed
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          items: subsequentResultRecord.items!,
          // safe because `id` is defined once the stream has been released as pending
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          id: subsequentResultRecord.streamRecord.id!,
        };
        if (subsequentResultRecord.errors.length > 0) {
          incrementalResult.errors = subsequentResultRecord.errors;
        }
        incrementalResults.push(incrementalResult);
      } else {
        newPendingSources.delete(subsequentResultRecord);
        completedResults.push(
          this._completedRecordToResult(subsequentResultRecord),
        );
        if (subsequentResultRecord.errors.length > 0) {
          continue;
        }
        for (const deferredGroupedFieldSetRecord of subsequentResultRecord.deferredGroupedFieldSetRecords) {
          if (!deferredGroupedFieldSetRecord.sent) {
            deferredGroupedFieldSetRecord.sent = true;
            const incrementalResult: IncrementalDeferResult =
              this._getIncrementalDeferResult(deferredGroupedFieldSetRecord);
            if (deferredGroupedFieldSetRecord.errors.length > 0) {
              incrementalResult.errors = deferredGroupedFieldSetRecord.errors;
            }
            incrementalResults.push(incrementalResult);
          }
        }
      }
    }
    return {
      pending: this._pendingSourcesToResults(newPendingSources),
      incremental: incrementalResults,
      completed: completedResults,
    };
  }
  private _getIncrementalDeferResult(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): IncrementalDeferResult {
    const { data, deferredFragmentRecords } = deferredGroupedFieldSetRecord;
    let maxLength: number | undefined;
    let idWithLongestPath: string | undefined;
    for (const deferredFragmentRecord of deferredFragmentRecords) {
      const id = deferredFragmentRecord.id;
      if (id === undefined) {
        continue;
      }
      const length = deferredFragmentRecord.path.length;
      if (maxLength === undefined || length > maxLength) {
        maxLength = length;
        idWithLongestPath = id;
      }
    }
    const subPath = deferredGroupedFieldSetRecord.path.slice(maxLength);
    const incrementalDeferResult: IncrementalDeferResult = {
      // safe because `data``is always defined when the record is completed
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      data: data!,
      // safe because `id` is always defined once the fragment has been released
      // as pending and at least one fragment has been completed, so must have been
      // released as pending
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: idWithLongestPath!,
    };
    if (subPath.length > 0) {
      incrementalDeferResult.subPath = subPath;
    }
    return incrementalDeferResult;
  }
  private _completedRecordToResult(
    completedRecord: DeferredFragmentRecord | StreamRecord,
  ): CompletedResult {
    const result: CompletedResult = {
      // safe because `id` is defined once the stream has been released as pending
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: completedRecord.id!,
    };
    if (completedRecord.errors.length > 0) {
      result.errors = completedRecord.errors;
    }
    return result;
  }
  private _publish(subsequentResultRecord: SubsequentResultRecord): void {
    if (isStreamItemsRecord(subsequentResultRecord)) {
      if (subsequentResultRecord.isCompleted) {
        this._push(subsequentResultRecord);
        return;
      }
      this._introduce(subsequentResultRecord);
      return;
    }
    if (subsequentResultRecord._pending.size > 0) {
      this._introduce(subsequentResultRecord);
    } else if (
      subsequentResultRecord.deferredGroupedFieldSetRecords.size > 0 ||
      subsequentResultRecord.children.size > 0
    ) {
      this._push(subsequentResultRecord);
    }
  }
  private _getChildren(
    erroringIncrementalDataRecord: IncrementalDataRecord,
  ): ReadonlySet<SubsequentResultRecord> {
    const children = new Set<SubsequentResultRecord>();
    if (isDeferredGroupedFieldSetRecord(erroringIncrementalDataRecord)) {
      for (const erroringIncrementalResultRecord of erroringIncrementalDataRecord.deferredFragmentRecords) {
        for (const child of erroringIncrementalResultRecord.children) {
          children.add(child);
        }
      }
    } else {
      for (const child of erroringIncrementalDataRecord.children) {
        children.add(child);
      }
    }
    return children;
  }
  private _getDescendants(
    children: ReadonlySet<SubsequentResultRecord>,
    descendants = new Set<SubsequentResultRecord>(),
  ): ReadonlySet<SubsequentResultRecord> {
    for (const child of children) {
      descendants.add(child);
      this._getDescendants(child.children, descendants);
    }
    return descendants;
  }
  private _nullsChildSubsequentResultRecord(
    subsequentResultRecord: SubsequentResultRecord,
    nullPath: ReadonlyArray<string | number>,
  ): boolean {
    const incrementalDataRecords = isStreamItemsRecord(subsequentResultRecord)
      ? [subsequentResultRecord]
      : subsequentResultRecord.deferredGroupedFieldSetRecords;
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (this._matchesPath(incrementalDataRecord.path, nullPath)) {
        return true;
      }
    }
    return false;
  }
  private _matchesPath(
    testPath: ReadonlyArray<string | number>,
    basePath: ReadonlyArray<string | number>,
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
function isDeferredGroupedFieldSetRecord(
  incrementalDataRecord: unknown,
): incrementalDataRecord is DeferredGroupedFieldSetRecord {
  return incrementalDataRecord instanceof DeferredGroupedFieldSetRecord;
}
function isStreamItemsRecord(
  subsequentResultRecord: unknown,
): subsequentResultRecord is StreamItemsRecord {
  return subsequentResultRecord instanceof StreamItemsRecord;
}
/** @internal */
export class InitialResultRecord {
  errors: Array<GraphQLError>;
  children: Set<SubsequentResultRecord>;
  constructor() {
    this.errors = [];
    this.children = new Set();
  }
}
/** @internal */
export class DeferredGroupedFieldSetRecord {
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
  }) {
    this.path = pathToArray(opts.path);
    this.deferredFragmentRecords = opts.deferredFragmentRecords;
    this.groupedFieldSet = opts.groupedFieldSet;
    this.shouldInitiateDefer = opts.shouldInitiateDefer;
    this.errors = [];
    this.sent = false;
  }
}
/** @internal */
export class DeferredFragmentRecord {
  path: ReadonlyArray<string | number>;
  label: string | undefined;
  id: string | undefined;
  children: Set<SubsequentResultRecord>;
  deferredGroupedFieldSetRecords: Set<DeferredGroupedFieldSetRecord>;
  errors: Array<GraphQLError>;
  filtered: boolean;
  pendingSent?: boolean;
  _pending: Set<DeferredGroupedFieldSetRecord>;
  constructor(opts: { path: Path | undefined; label: string | undefined }) {
    this.path = pathToArray(opts.path);
    this.label = opts.label;
    this.children = new Set();
    this.filtered = false;
    this.deferredGroupedFieldSetRecords = new Set();
    this.errors = [];
    this._pending = new Set();
  }
}
/** @internal */
export class StreamRecord {
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
  }) {
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.errors = [];
    this.earlyReturn = opts.earlyReturn;
  }
}
/** @internal */
export class StreamItemsRecord {
  errors: Array<GraphQLError>;
  streamRecord: StreamRecord;
  path: ReadonlyArray<string | number>;
  items: Array<unknown> | undefined;
  children: Set<SubsequentResultRecord>;
  isFinalRecord?: boolean;
  isCompletedAsyncIterator?: boolean;
  isCompleted: boolean;
  filtered: boolean;
  constructor(opts: { streamRecord: StreamRecord; path: Path | undefined }) {
    this.streamRecord = opts.streamRecord;
    this.path = pathToArray(opts.path);
    this.children = new Set();
    this.errors = [];
    this.isCompleted = false;
    this.filtered = false;
  }
}
export type IncrementalDataRecord =
  | InitialResultRecord
  | DeferredGroupedFieldSetRecord
  | StreamItemsRecord;
type SubsequentResultRecord = DeferredFragmentRecord | StreamItemsRecord;
