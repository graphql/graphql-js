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
      // Ignore errors
    }
    if (isPromise(result)) {
      result.catch(() => {
        // Ignore errors
      });
    }
  }

  currentBatch(): Generator<T> | undefined {
    if (this._items.length > 0) {
      return this.batch();
    }
  }

  nextBatch(): Promise<Generator<T> | undefined> {
    if (this._items.length > 0) {
      return Promise.resolve(this.batch());
    }
    if (this._stopped) {
      return Promise.resolve(undefined);
    }
    const { promise, resolve } = promiseWithResolvers<
      Generator<T> | undefined
    >();
    this._resolvers.push(resolve);
    return promise;
  }

  stop(): void {
    this._stopped = true;
    this._resolve(undefined);
  }

  toAsyncGenerator<U>(
    mapFn: (generator: Generator<T>) => U | undefined,
  ): AsyncGenerator<U, void, void> {
    return withCleanup(this.toAsyncGeneratorImpl(mapFn), () => this.stop());
  }

  private async *toAsyncGeneratorImpl<U>(
    mapFn: (generator: Generator<T, void, void>) => U | undefined,
  ): AsyncGenerator<U> {
    let batch = this.currentBatch();
    if (batch !== undefined) {
      const maybe = mapFn(batch);
      if (maybe !== undefined) {
        yield maybe;
      }
    }

    if (this._stopped) {
      return;
    }

    // eslint-disable-next-line no-await-in-loop
    while ((batch = await this.nextBatch()) !== undefined) {
      const maybe = mapFn(batch);
      if (maybe !== undefined) {
        yield maybe;
      }
    }
  }

  private _push(item: T): void {
    if (this._stopped) {
      this._resolve(undefined);
    }
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
