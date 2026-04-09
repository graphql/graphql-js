import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

/** @internal */
export class AsyncWorkTracker {
  pendingAsyncWork: Set<Promise<void>>;

  constructor() {
    this.pendingAsyncWork = new Set<Promise<void>>();
  }

  add(promise: Promise<unknown>): void {
    const pendingAsyncWork = this.pendingAsyncWork;
    const promiseToSettle = promise.then(
      () => {
        pendingAsyncWork.delete(promiseToSettle);
      },
      () => {
        pendingAsyncWork.delete(promiseToSettle);
      },
    );
    pendingAsyncWork.add(promiseToSettle);
  }

  addValues(values: ReadonlyArray<PromiseOrValue<unknown>>): void {
    for (const value of values) {
      if (isPromise(value)) {
        this.add(value);
      }
    }
  }

  promiseAllTrackOnReject<T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ): Promise<Array<T>> {
    const promise = Promise.all(values);
    promise.then(undefined, () => {
      this.addValues(values);
    });
    return promise;
  }
}
