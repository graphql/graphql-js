type MaybePromise<T> = PromiseLike<T> | T;

export class RequestBatchLoader<TKey, TValue> {
  private readonly loadMany: (
    keys: ReadonlyArray<TKey>,
  ) => MaybePromise<ReadonlyArray<TValue>>;

  private queue: Array<{
    key: TKey;
    resolve: (value: TValue) => void;
    reject: (reason: unknown) => void;
  }> = [];

  private scheduled = false;

  constructor(
    loadMany: (
      keys: ReadonlyArray<TKey>,
    ) => MaybePromise<ReadonlyArray<TValue>>,
  ) {
    this.loadMany = loadMany;
  }

  load(key: TKey): Promise<TValue> {
    return new Promise<TValue>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.dispatch());
      }
    });
  }

  private dispatch(): void {
    const queue = this.queue;
    this.queue = [];
    this.scheduled = false;

    let values: MaybePromise<ReadonlyArray<TValue>>;
    try {
      values = this.loadMany(queue.map((entry) => entry.key));
    } catch (error) {
      rejectAll(queue, error);
      return;
    }

    Promise.resolve(values).then(
      (resolvedValues) => {
        if (resolvedValues.length !== queue.length) {
          rejectAll(
            queue,
            new Error(
              `Batch loader returned ${resolvedValues.length} values for ${queue.length} keys.`,
            ),
          );
          return;
        }

        for (const [index, entry] of queue.entries()) {
          entry.resolve(resolvedValues[index]);
        }
      },
      (error: unknown) => rejectAll(queue, error),
    );
  }
}

function rejectAll(
  queue: ReadonlyArray<{ reject: (reason: unknown) => void }>,
  error: unknown,
): void {
  for (const entry of queue) {
    entry.reject(error);
  }
}
