import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import { withCleanup } from './withCleanup.js';

/**
 * @internal
 */
export class Queue<T> {
  private _items: Array<T>;
  private _stopped: boolean;
  private _resolvers: Array<(iterable: Generator<T> | undefined) => void>;

  constructor(
    executor: (
      push: (item: T) => void,
      stop: () => void,
    ) => PromiseOrValue<void>,
  ) {
    this._items = [];
    this._stopped = false;
    this._resolvers = [];
    let result;
    try {
      result = executor(this._push.bind(this), this.stop.bind(this));
    } catch {
      // ignore sync executor errors
    }
    if (isPromise(result)) {
      result.catch(() => {
        /* ignore async executor errors */
      });
    }
  }

  stop(): void {
    this._stopped = true;
    this._resolve(undefined);
  }

  subscribe<U>(
    mapFn: (generator: Generator<T>) => U | undefined,
  ): AsyncGenerator<U, void, void> {
    return withCleanup(this.subscribeImpl(mapFn), () => this.stop());
  }

  private async *subscribeImpl<U>(
    mapFn: (generator: Generator<T, void, void>) => U | undefined,
  ): AsyncGenerator<U> {
    while (true) {
      if (this._stopped) {
        return;
      }

      let mapped;
      // drain any items pushed prior to or between .next() calls
      while (
        this._items.length > 0 &&
        (mapped = mapFn(this.batch())) !== undefined
      ) {
        yield mapped;
        if (this._stopped) {
          return;
        }
      }

      // wait for a yield-able batch
      do {
        // eslint-disable-next-line no-await-in-loop
        const nextBatch = await this._nextBatch();
        if (nextBatch === undefined || this._stopped) {
          return;
        }
        mapped = mapFn(nextBatch);
      } while (mapped === undefined);

      yield mapped;
    }
  }

  private _nextBatch(): Promise<Generator<T> | undefined> {
    const { promise, resolve } = promiseWithResolvers<
      Generator<T> | undefined
    >();
    this._resolvers.push(resolve);
    return promise;
  }

  private _push(item: T): void {
    this._items.push(item);
    this._resolve(this.batch());
  }

  private _resolve(maybeIterable: Generator<T> | undefined): void {
    for (const resolve of this._resolvers) {
      resolve(maybeIterable);
    }
    this._resolvers = [];
  }

  private *batch(): Generator<T> {
    let item: T | undefined;
    while ((item = this._items.shift()) !== undefined) {
      yield item;
    }
  }
}
