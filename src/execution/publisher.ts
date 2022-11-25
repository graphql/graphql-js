interface Source {
  parentContext: this | undefined;
  isCompletedIterator?: boolean | undefined;
  iterator?: AsyncIterator<unknown> | undefined;
}

interface HasParent<T> {
  parentContext: T;
}

function hasParent<T>(value: T): value is T & HasParent<T> {
  return (value as HasParent<T>).parentContext !== undefined;
}

type ToIncrementalResult<TSource extends Source, TIncremental> = (
  source: TSource,
) => TIncremental;

type ToPayload<TIncremental, TPayload> = (
  incremental: ReadonlyArray<TIncremental>,
  hasNext: boolean,
) => TPayload;

/**
 * @internal
 */
export class Publisher<TSource extends Source, TIncremental, TPayload> {
  // This is safe because a promise executor within the constructor will assign this.
  trigger!: () => void;
  signal: Promise<void>;
  pending: Set<TSource>;
  waiting: Set<TSource & HasParent<TSource>>;
  waitingByParent: Map<TSource, Set<TSource & HasParent<TSource>>>;
  pushed: WeakSet<TSource>;
  current: Set<TSource>;
  toIncrementalResult: ToIncrementalResult<TSource, TIncremental>;
  toPayload: ToPayload<TIncremental, TPayload>;

  constructor(
    toIncrementalResult: ToIncrementalResult<TSource, TIncremental>,
    toPayload: ToPayload<TIncremental, TPayload>,
  ) {
    this.signal = new Promise((resolve) => {
      this.trigger = resolve;
    });
    this.pending = new Set();
    this.waiting = new Set();
    this.waitingByParent = new Map();
    this.pushed = new WeakSet();
    this.current = new Set();
    this.toIncrementalResult = toIncrementalResult;
    this.toPayload = toPayload;
  }

  add(source: TSource): void {
    this.pending.add(source);
  }

  complete(source: TSource): void {
    // if source has been filtered, ignore completion
    if (!this.pending.has(source)) {
      return;
    }

    this.pending.delete(source);

    if (!hasParent(source)) {
      this._push(source);
      this.trigger();
      return;
    }

    const parentContext = source.parentContext;
    if (this.pushed.has(source.parentContext)) {
      this._push(source);
      this.trigger();
      return;
    }

    this.waiting.add(source);

    const waitingByParent = this.waitingByParent.get(parentContext);
    if (waitingByParent) {
      waitingByParent.add(source);
      return;
    }

    this.waitingByParent.set(parentContext, new Set([source]));
  }

  _push(source: TSource): void {
    this.pushed.add(source);
    this.current.add(source);

    const waitingByParent = this.waitingByParent.get(source);
    if (waitingByParent === undefined) {
      return;
    }

    for (const child of waitingByParent) {
      this.waitingByParent.delete(child);
      this.waiting.delete(child);
      this._push(child);
    }
  }

  hasNext(): boolean {
    return (
      this.pending.size > 0 || this.waiting.size > 0 || this.current.size > 0
    );
  }

  filter(predicate: (source: TSource) => boolean): void {
    const iterators = new Set<AsyncIterator<unknown>>();
    for (const set of [this.pending, this.current]) {
      set.forEach((source) => {
        if (predicate(source)) {
          return;
        }
        if (source.iterator?.return) {
          iterators.add(source.iterator);
        }
        set.delete(source);
      });
    }

    this.waiting.forEach((source) => {
      if (predicate(source)) {
        return;
      }

      if (source.iterator?.return) {
        iterators.add(source.iterator);
      }

      this.waiting.delete(source);

      const parentContext = source.parentContext;
      const children = this.waitingByParent.get(parentContext);
      // TODO: children can never be undefined, but TS doesn't know that
      children?.delete(source);
    });

    for (const iterator of iterators) {
      iterator.return?.().catch(() => {
        // ignore error
      });
    }
  }

  _getCompletedIncrementalResults(): Array<TIncremental> {
    const incrementalResults: Array<TIncremental> = [];
    for (const source of this.current) {
      this.current.delete(source);
      if (source.isCompletedIterator) {
        continue;
      }
      incrementalResults.push(this.toIncrementalResult(source));
    }
    return incrementalResults;
  }

  subscribe(): AsyncGenerator<TPayload, void, void> {
    let isDone = false;

    const next = async (): Promise<IteratorResult<TPayload, void>> => {
      if (isDone) {
        return { value: undefined, done: true };
      }

      const incremental = this._getCompletedIncrementalResults();
      if (!incremental.length) {
        return onSignal();
      }

      const hasNext = this.hasNext();

      if (!hasNext) {
        isDone = true;
      }

      return {
        value: this.toPayload(incremental, hasNext),
        done: false,
      };
    };

    const onSignal = async (): Promise<IteratorResult<TPayload, void>> => {
      await this.signal;

      if (isDone) {
        return { value: undefined, done: true };
      }

      const incremental = this._getCompletedIncrementalResults();

      this.signal = new Promise((resolve) => {
        this.trigger = resolve;
      });

      const hasNext = this.hasNext();
      if (!incremental.length && hasNext) {
        return onSignal();
      }

      if (!hasNext) {
        isDone = true;
      }

      return {
        value: this.toPayload(incremental, hasNext),
        done: false,
      };
    };

    const returnIterators = () => {
      const iterators = new Set<AsyncIterator<unknown>>();
      for (const set of [this.pending, this.waiting, this.current]) {
        for (const source of set) {
          if (source.iterator?.return) {
            iterators.add(source.iterator);
          }
        }
      }

      const promises: Array<Promise<IteratorResult<unknown>>> = [];
      for (const iterator of iterators) {
        if (iterator?.return) {
          promises.push(iterator.return());
        }
      }
      return Promise.all(promises);
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next,
      async return(): Promise<IteratorResult<TPayload, void>> {
        isDone = true;
        await returnIterators();
        return { value: undefined, done: true };
      },
      async throw(error?: unknown): Promise<IteratorResult<TPayload, void>> {
        isDone = true;
        await returnIterators();
        return Promise.reject(error);
      },
    };
  }
}
