import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

/**
 * A PromiseCanceller object can be used to trigger multiple responses
 * in response to a single AbortSignal.
 *
 * @internal
 */
export class PromiseCanceller {
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

  disconnect(): void {
    this.abortSignal.removeEventListener('abort', this.abort);
  }

  cancellablePromise<T>(originalPromise: Promise<T>): Promise<T> {
    if (this.abortSignal.aborted) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(this.abortSignal.reason);
    }

    const { promise, resolve, reject } = promiseWithResolvers<T>();
    const abort = () => {
      reject(this.abortSignal.reason);
    };
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

  cancellableIterable<T>(iterable: AsyncIterable<T>): AsyncIterable<T> {
    const iterator = iterable[Symbol.asyncIterator]();

    if (iterator.return) {
      const _next = iterator.next.bind(iterator);
      const _return = iterator.return.bind(iterator);

      const abort = () => {
        _return().catch(() => {
          /* c8 ignore next */
          // ignore
        });
      };

      if (this.abortSignal.aborted) {
        abort();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        const onMethod = () => Promise.reject(this.abortSignal.reason);
        return {
          [Symbol.asyncIterator]: () => ({
            next: onMethod,
            return: onMethod,
          }),
        };
      }

      this._aborts.add(abort);
      const on = (method: () => Promise<IteratorResult<T>>) => async () => {
        try {
          const iteration = await this.cancellablePromise(method());
          if (iteration.done) {
            this._aborts.delete(abort);
          }
          return iteration;
        } catch (error) {
          this._aborts.delete(abort);
          throw error;
        }
      };
      return {
        [Symbol.asyncIterator]: () => ({
          next: on(_next),
          return: on(_return),
        }),
      };
    }

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => this.cancellablePromise(iterator.next()),
      }),
    };
  }
}
