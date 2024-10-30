import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

/**
 * A Canceller object that can be used to cancel multiple promises
 * using a single AbortSignal.
 *
 * @internal
 */
export class Canceller {
  abortSignal: AbortSignal;
  abort: () => void;

  private _aborts: Set<() => void>;

  constructor(abortSignal: AbortSignal) {
    this.abortSignal = abortSignal;
    this._aborts = new Set<() => void>();
    this.abort = () => {
      for (const abort of this._aborts) {
        abort();
      }
    };

    abortSignal.addEventListener('abort', this.abort);
  }

  unsubscribe(): void {
    this.abortSignal.removeEventListener('abort', this.abort);
  }

  withCancellation<T>(originalPromise: Promise<T>): Promise<T> {
    const { promise, resolve, reject } = promiseWithResolvers<T>();
    const abort = () => reject(this.abortSignal.reason);
    this._aborts.add(abort);
    originalPromise.then(
      (resolved) => {
        this._aborts.delete(abort);
        resolve(resolved);
      },
      (error: unknown) => {
        this._aborts.delete(abort);
        reject(error);
      },
    );

    return promise;
  }
}
