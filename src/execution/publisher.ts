interface Source {
  promise: Promise<void>;
  isCompleted: boolean;
  isCompletedIterator?: boolean | undefined;
  iterator?: AsyncIterator<unknown> | undefined;
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
  sources: Set<TSource>;
  toIncrementalResult: ToIncrementalResult<TSource, TIncremental>;
  toPayload: ToPayload<TIncremental, TPayload>;

  constructor(
    toIncrementalResult: ToIncrementalResult<TSource, TIncremental>,
    toPayload: ToPayload<TIncremental, TPayload>,
  ) {
    this.sources = new Set();
    this.toIncrementalResult = toIncrementalResult;
    this.toPayload = toPayload;
  }

  add(source: TSource) {
    this.sources.add(source);
  }

  hasNext(): boolean {
    return this.sources.size > 0;
  }

  filter(predicate: (source: TSource) => boolean): void {
    this.sources.forEach((source) => {
      if (predicate(source)) {
        return;
      }
      if (source.iterator?.return) {
        source.iterator.return().catch(() => {
          // ignore error
        });
      }
      this.sources.delete(source);
    });
  }

  _getCompletedIncrementalResults(): Array<TIncremental> {
    const incrementalResults: Array<TIncremental> = [];
    for (const source of this.sources) {
      if (!source.isCompleted) {
        continue;
      }
      this.sources.delete(source);
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

      await Promise.race(Array.from(this.sources).map((p) => p.promise));

      if (isDone) {
        return { value: undefined, done: true };
      }

      const incremental = this._getCompletedIncrementalResults();
      const hasNext = this.sources.size > 0;

      if (!incremental.length && hasNext) {
        return next();
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
      const promises: Array<Promise<IteratorResult<unknown>>> = [];
      this.sources.forEach((source) => {
        if (source.iterator?.return) {
          promises.push(source.iterator.return());
        }
      });
      return Promise.all(promises);
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next,
      async return(): Promise<IteratorResult<TPayload, void>> {
        await returnIterators();
        isDone = true;
        return { value: undefined, done: true };
      },
      async throw(error?: unknown): Promise<IteratorResult<TPayload, void>> {
        await returnIterators();
        isDone = true;
        return Promise.reject(error);
      },
    };
  }
}
