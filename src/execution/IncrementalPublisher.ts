import { isPromise } from '../jsutils/isPromise.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { pathToArray } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

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

export function buildIncrementalResponse(
  context: IncrementalPublisherContext,
  result: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError>,
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
): ExperimentalIncrementalExecutionResults {
  const incrementalPublisher = new IncrementalPublisher(context);
  return incrementalPublisher.buildResponse(
    result,
    errors,
    incrementalDataRecords,
  );
}

interface IncrementalPublisherContext {
  cancellableStreams: Set<StreamRecord>;
}

/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * @internal
 */
class IncrementalPublisher {
  private _context: IncrementalPublisherContext;
  private _nextId: number;
  private _pending: Set<SubsequentResultRecord>;
  private _completedResultQueue: Array<IncrementalDataRecordResult>;
  private _newPending: Set<SubsequentResultRecord>;
  private _incremental: Array<IncrementalResult>;
  private _completed: Array<CompletedResult>;
  // these are assigned within the Promise executor called synchronously within the constructor
  private _signalled!: Promise<unknown>;
  private _resolve!: () => void;

  constructor(context: IncrementalPublisherContext) {
    this._context = context;
    this._nextId = 0;
    this._pending = new Set();
    this._completedResultQueue = [];
    this._newPending = new Set();
    this._incremental = [];
    this._completed = [];
    this._reset();
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError>,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ExperimentalIncrementalExecutionResults {
    this._addIncrementalDataRecords(incrementalDataRecords);
    this._pruneEmpty();

    const pending = this._pendingSourcesToResults();

    const initialResult: InitialIncrementalExecutionResult =
      errors.length === 0
        ? { data, pending, hasNext: true }
        : { errors, data, pending, hasNext: true };

    return {
      initialResult,
      subsequentResults: this._subscribe(),
    };
  }

  private _addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isDeferredGroupedFieldSetRecord(incrementalDataRecord)) {
        for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
          this._addDeferredFragmentRecord(deferredFragmentRecord);
        }

        const result = incrementalDataRecord.result;
        if (isPromise(result)) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          result.then((resolved) => {
            this._enqueueCompletedDeferredGroupedFieldSet(resolved);
          });
        } else {
          this._enqueueCompletedDeferredGroupedFieldSet(result);
        }

        continue;
      }

      const streamRecord = incrementalDataRecord.streamRecord;
      if (streamRecord.id === undefined) {
        this._newPending.add(streamRecord);
      }

      const result = incrementalDataRecord.getResult();
      if (isPromise(result)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        result.then((resolved) => {
          this._enqueueCompletedStreamItems(resolved);
        });
      } else {
        this._enqueueCompletedStreamItems(result);
      }
    }
  }

  private _addDeferredFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): void {
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      // Below is equivalent and slightly faster version of:
      //   if (this._pending.has(deferredFragmentRecord)) { ... }
      // as all released deferredFragmentRecords have ids.
      if (deferredFragmentRecord.id !== undefined) {
        return;
      }

      this._newPending.add(deferredFragmentRecord);
      return;
    }

    if (parent.children.has(deferredFragmentRecord)) {
      return;
    }

    parent.children.add(deferredFragmentRecord);

    this._addDeferredFragmentRecord(parent);
  }

  private _pruneEmpty() {
    const maybeEmptyNewPending = this._newPending;
    this._newPending = new Set();
    for (const node of maybeEmptyNewPending) {
      if (isDeferredFragmentRecord(node)) {
        if (node.deferredGroupedFieldSetRecords.length > 0) {
          this._newPending.add(node);
          continue;
        }
        for (const child of node.children) {
          this._addNonEmptyNewPending(child);
        }
      } else {
        this._newPending.add(node);
      }
    }
  }

  private _addNonEmptyNewPending(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): void {
    if (deferredFragmentRecord.deferredGroupedFieldSetRecords.length > 0) {
      this._newPending.add(deferredFragmentRecord);
      return;
    }
    /* c8 ignore next 5 */
    // TODO: add test case for this, if when skipping an empty deferred fragment, the empty fragment has nested children.
    for (const child of deferredFragmentRecord.children) {
      this._addNonEmptyNewPending(child);
    }
  }

  private _enqueueCompletedDeferredGroupedFieldSet(
    result: DeferredGroupedFieldSetResult,
  ): void {
    let hasPendingParent = false;
    for (const deferredFragmentRecord of result.deferredFragmentRecords) {
      if (deferredFragmentRecord.id !== undefined) {
        hasPendingParent = true;
      }
      deferredFragmentRecord.results.push(result);
    }
    if (hasPendingParent) {
      this._completedResultQueue.push(result);
      this._trigger();
    }
  }

  private _enqueueCompletedStreamItems(result: StreamItemsResult): void {
    this._completedResultQueue.push(result);
    this._trigger();
  }

  private _pendingSourcesToResults(): Array<PendingResult> {
    const pendingResults: Array<PendingResult> = [];
    for (const pendingSource of this._newPending) {
      const id = String(this._getNextId());
      this._pending.add(pendingSource);
      pendingSource.id = id;
      const pendingResult: PendingResult = {
        id,
        path: pathToArray(pendingSource.path),
      };
      if (pendingSource.label !== undefined) {
        pendingResult.label = pendingSource.label;
      }
      pendingResults.push(pendingResult);
    }
    this._newPending.clear();
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
      while (!isDone) {
        let pending: Array<PendingResult> = [];

        let completedResult: IncrementalDataRecordResult | undefined;
        while (
          (completedResult = this._completedResultQueue.shift()) !== undefined
        ) {
          if (isDeferredGroupedFieldSetResult(completedResult)) {
            this._handleCompletedDeferredGroupedFieldSet(completedResult);
          } else {
            this._handleCompletedStreamItems(completedResult);
          }

          pending = [...pending, ...this._pendingSourcesToResults()];
        }

        if (this._incremental.length > 0 || this._completed.length > 0) {
          const hasNext = this._pending.size > 0;

          if (!hasNext) {
            isDone = true;
          }

          const subsequentIncrementalExecutionResult: SubsequentIncrementalExecutionResult =
            { hasNext };

          if (pending.length > 0) {
            subsequentIncrementalExecutionResult.pending = pending;
          }
          if (this._incremental.length > 0) {
            subsequentIncrementalExecutionResult.incremental =
              this._incremental;
          }
          if (this._completed.length > 0) {
            subsequentIncrementalExecutionResult.completed = this._completed;
          }

          this._incremental = [];
          this._completed = [];

          return { value: subsequentIncrementalExecutionResult, done: false };
        }

        // eslint-disable-next-line no-await-in-loop
        await this._signalled;
      }

      await returnStreamIterators().catch(() => {
        // ignore errors
      });

      return { value: undefined, done: true };
    };

    const returnStreamIterators = async (): Promise<void> => {
      const promises: Array<Promise<unknown>> = [];
      for (const streamRecord of this._context.cancellableStreams) {
        if (streamRecord.earlyReturn !== undefined) {
          promises.push(streamRecord.earlyReturn());
        }
      }
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

  private _handleCompletedDeferredGroupedFieldSet(
    deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
  ): void {
    if (
      isNonReconcilableDeferredGroupedFieldSetResult(
        deferredGroupedFieldSetResult,
      )
    ) {
      for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
        const id = deferredFragmentRecord.id;
        if (id !== undefined) {
          this._completed.push({
            id,
            errors: deferredGroupedFieldSetResult.errors,
          });
          this._pending.delete(deferredFragmentRecord);
        }
      }
      return;
    }
    for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
      deferredFragmentRecord.reconcilableResults.push(
        deferredGroupedFieldSetResult,
      );
    }

    this._addIncrementalDataRecords(
      deferredGroupedFieldSetResult.incrementalDataRecords,
    );

    for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
      const id = deferredFragmentRecord.id;
      // TODO: add test case for this.
      // Presumably, this can occur if an error causes a fragment to be completed early,
      // while an asynchronous deferred grouped field set result is enqueued.
      /* c8 ignore next 3 */
      if (id === undefined) {
        continue;
      }
      const fragmentResults = deferredFragmentRecord.reconcilableResults;
      if (
        deferredFragmentRecord.deferredGroupedFieldSetRecords.length !==
        fragmentResults.length
      ) {
        continue;
      }
      for (const fragmentResult of fragmentResults) {
        if (fragmentResult.sent) {
          continue;
        }
        fragmentResult.sent = true;
        const { bestId, subPath } = this._getBestIdAndSubPath(
          id,
          deferredFragmentRecord,
          fragmentResult,
        );
        const incrementalEntry: IncrementalDeferResult = {
          ...fragmentResult.result,
          id: bestId,
        };
        if (subPath !== undefined) {
          incrementalEntry.subPath = subPath;
        }
        this._incremental.push(incrementalEntry);
      }
      this._completed.push({ id });
      this._pending.delete(deferredFragmentRecord);
      for (const child of deferredFragmentRecord.children) {
        this._newPending.add(child);
        for (const childResult of child.results) {
          if (!isPromise(childResult)) {
            this._completedResultQueue.push(childResult);
          }
        }
      }
    }

    this._pruneEmpty();
  }

  private _handleCompletedStreamItems(
    streamItemsResult: StreamItemsResult,
  ): void {
    const streamRecord = streamItemsResult.streamRecord;
    const id = streamRecord.id;
    // TODO: Consider adding invariant or non-null assertion, as this should never happen. Since the stream is converted into a linked list
    // for ordering purposes, if an entry errors, additional entries will not be processed.
    /* c8 ignore next 3 */
    if (id === undefined) {
      return;
    }
    if (streamItemsResult.result === undefined) {
      this._completed.push({ id });
      this._pending.delete(streamRecord);
      this._context.cancellableStreams.delete(streamRecord);
    } else if (streamItemsResult.result === null) {
      this._completed.push({
        id,
        errors: streamItemsResult.errors,
      });
      this._pending.delete(streamRecord);
      this._context.cancellableStreams.delete(streamRecord);
      streamRecord.earlyReturn?.().catch(() => {
        /* c8 ignore next 1 */
        // ignore error
      });
    } else {
      const incrementalEntry: IncrementalStreamResult = {
        id,
        ...streamItemsResult.result,
      };

      this._incremental.push(incrementalEntry);

      if (streamItemsResult.incrementalDataRecords.length > 0) {
        this._addIncrementalDataRecords(
          streamItemsResult.incrementalDataRecords,
        );
        this._pruneEmpty();
      }
    }
  }

  private _getBestIdAndSubPath(
    initialId: string,
    initialDeferredFragmentRecord: DeferredFragmentRecord,
    deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
  ): { bestId: string; subPath: ReadonlyArray<string | number> | undefined } {
    let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
    let bestId = initialId;

    for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
      if (deferredFragmentRecord === initialDeferredFragmentRecord) {
        continue;
      }
      const id = deferredFragmentRecord.id;
      // TODO: add test case for when an fragment has not been released, but might be processed for the shortest path.
      /* c8 ignore next 3 */
      if (id === undefined) {
        continue;
      }
      const fragmentPath = pathToArray(deferredFragmentRecord.path);
      const length = fragmentPath.length;
      if (length > maxLength) {
        maxLength = length;
        bestId = id;
      }
    }
    const subPath = deferredGroupedFieldSetResult.path.slice(maxLength);
    return {
      bestId,
      subPath: subPath.length > 0 ? subPath : undefined,
    };
  }
}

function isDeferredFragmentRecord(
  subsequentResultRecord: SubsequentResultRecord,
): subsequentResultRecord is DeferredFragmentRecord {
  return subsequentResultRecord instanceof DeferredFragmentRecord;
}

function isDeferredGroupedFieldSetRecord(
  incrementalDataRecord: IncrementalDataRecord,
): incrementalDataRecord is DeferredGroupedFieldSetRecord {
  return incrementalDataRecord instanceof DeferredGroupedFieldSetRecord;
}

export type DeferredGroupedFieldSetResult =
  | ReconcilableDeferredGroupedFieldSetResult
  | NonReconcilableDeferredGroupedFieldSetResult;

export function isDeferredGroupedFieldSetResult(
  subsequentResult: DeferredGroupedFieldSetResult | StreamItemsResult,
): subsequentResult is DeferredGroupedFieldSetResult {
  return 'deferredFragmentRecords' in subsequentResult;
}

interface ReconcilableDeferredGroupedFieldSetResult {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  path: Array<string | number>;
  result: BareDeferredGroupedFieldSetResult;
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>;
  sent?: true | undefined;
}

interface NonReconcilableDeferredGroupedFieldSetResult {
  result: null;
  errors: ReadonlyArray<GraphQLError>;
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  path: Array<string | number>;
}

export function isNonReconcilableDeferredGroupedFieldSetResult(
  deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
): deferredGroupedFieldSetResult is NonReconcilableDeferredGroupedFieldSetResult {
  return deferredGroupedFieldSetResult.result === null;
}

/** @internal */
export class DeferredGroupedFieldSetRecord {
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  result: PromiseOrValue<DeferredGroupedFieldSetResult>;

  constructor(opts: {
    deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
    executor: () => PromiseOrValue<DeferredGroupedFieldSetResult>;
  }) {
    const { deferredFragmentRecords, executor } = opts;
    this.deferredFragmentRecords = deferredFragmentRecords;

    for (const deferredFragmentRecord of deferredFragmentRecords) {
      deferredFragmentRecord.deferredGroupedFieldSetRecords.push(this);
    }

    // If any of the deferred fragments for this deferred grouped field set
    // have an id, then they have been released to the client as pending
    // and it is safe to execute the deferred grouped field set synchronously.

    // This can occur, for example, when deferred fragments have overlapping
    // fields, and a new deferred grouped field set has been created for the
    // non-overlapping fields.
    this.result = deferredFragmentRecords.some(
      (deferredFragmentRecord) => deferredFragmentRecord.id !== undefined,
    )
      ? executor()
      : Promise.resolve().then(executor);
  }
}

/** @internal */
export class DeferredFragmentRecord {
  path: Path | undefined;
  label: string | undefined;
  deferredGroupedFieldSetRecords: Array<DeferredGroupedFieldSetRecord>;
  results: Array<DeferredGroupedFieldSetResult>;
  reconcilableResults: Array<ReconcilableDeferredGroupedFieldSetResult>;
  parent: DeferredFragmentRecord | undefined;
  children: Set<DeferredFragmentRecord>;
  id?: string | undefined;

  constructor(opts: {
    path: Path | undefined;
    label: string | undefined;
    parent: DeferredFragmentRecord | undefined;
  }) {
    this.path = opts.path;
    this.label = opts.label;
    this.deferredGroupedFieldSetRecords = [];
    this.results = [];
    this.reconcilableResults = [];
    this.parent = opts.parent;
    this.children = new Set();
  }
}

/** @internal */
export class StreamRecord {
  label: string | undefined;
  path: Path;
  earlyReturn: (() => Promise<unknown>) | undefined;
  id?: string | undefined;
  constructor(opts: {
    label: string | undefined;
    path: Path;
    earlyReturn?: (() => Promise<unknown>) | undefined;
  }) {
    const { label, path, earlyReturn } = opts;
    this.label = label;
    this.path = path;
    this.earlyReturn = earlyReturn;
  }
}

interface NonReconcilableStreamItemsResult {
  streamRecord: StreamRecord;
  result: null;
  errors: ReadonlyArray<GraphQLError>;
}

interface NonTerminatingStreamItemsResult {
  streamRecord: StreamRecord;
  result: BareStreamItemsResult;
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>;
}

interface TerminatingStreamItemsResult {
  streamRecord: StreamRecord;
  result?: never;
  incrementalDataRecords?: never;
  errors?: never;
}

export type StreamItemsResult =
  | NonReconcilableStreamItemsResult
  | NonTerminatingStreamItemsResult
  | TerminatingStreamItemsResult;

export function isNonTerminatingStreamItemsResult(
  streamItemsResult: StreamItemsResult,
): streamItemsResult is NonTerminatingStreamItemsResult {
  return streamItemsResult.result != null;
}

/** @internal */
export class StreamItemsRecord {
  streamRecord: StreamRecord;
  nextStreamItems: StreamItemsRecord | undefined;

  private _result: PromiseOrValue<StreamItemsResult>;

  constructor(opts: {
    streamRecord: StreamRecord;
    executor: () => PromiseOrValue<StreamItemsResult>;
  }) {
    const { streamRecord, executor } = opts;
    this.streamRecord = streamRecord;

    this._result = executor();
  }

  getResult(): PromiseOrValue<StreamItemsResult> {
    if (isPromise(this._result)) {
      return this._result.then((resolved) =>
        this._prependNextStreamItems(resolved),
      );
    }

    return this._prependNextStreamItems(this._result);
  }

  private _prependNextStreamItems(
    result: StreamItemsResult,
  ): StreamItemsResult {
    return isNonTerminatingStreamItemsResult(result) &&
      this.nextStreamItems !== undefined
      ? {
          ...result,
          incrementalDataRecords:
            result.incrementalDataRecords.length === 0
              ? [this.nextStreamItems]
              : [this.nextStreamItems, ...result.incrementalDataRecords],
        }
      : result;
  }
}

export type IncrementalDataRecord =
  | DeferredGroupedFieldSetRecord
  | StreamItemsRecord;

export type IncrementalDataRecordResult =
  | DeferredGroupedFieldSetResult
  | StreamItemsResult;

type SubsequentResultRecord = DeferredFragmentRecord | StreamRecord;
