import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

/**
 * A AbortSignalListener object can be used to trigger multiple responses
 * in response to a single AbortSignal.
 *
 * @internal
 */
export class AbortSignalListener {
  abortSignal: AbortSignal;
  abort: () => void;

  private _onAborts: Set<() => void>;

  constructor(abortSignal: AbortSignal) {
    this.abortSignal = abortSignal;
    this._onAborts = new Set<() => void>();
    this.abort = () => {
      for (const abort of this._onAborts) {
        abort();
      }
    };

    abortSignal.addEventListener('abort', this.abort);
  }

  add(onAbort: () => void): void {
    this._onAborts.add(onAbort);
  }

  delete(onAbort: () => void): void {
    this._onAborts.delete(onAbort);
  }

  disconnect(): void {
    this.abortSignal.removeEventListener('abort', this.abort);
  }
}

export function cancellablePromise<T>(
  originalPromise: Promise<T>,
  abortSignalListener: AbortSignalListener,
): Promise<T> {
  const abortSignal = abortSignalListener.abortSignal;
  if (abortSignal.aborted) {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject(abortSignal.reason);
  }

  const { promise, resolve, reject } = promiseWithResolvers<T>();
  const onAbort = () => reject(abortSignal.reason);
  abortSignalListener.add(onAbort);
  originalPromise.then(
    (resolved) => {
      abortSignalListener.delete(onAbort);
      resolve(resolved);
    },
    (error: unknown) => {
      abortSignalListener.delete(onAbort);
      reject(error);
    },
  );

  return promise;
}

export function cancellableIterable<T>(
  iterable: AsyncIterable<T>,
  abortSignalListener: AbortSignalListener,
): AsyncIterable<T> {
  const iterator = iterable[Symbol.asyncIterator]();

  const _next = iterator.next.bind(iterator);

  if (iterator.return) {
    const _return = iterator.return.bind(iterator);

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => cancellablePromise(_next(), abortSignalListener),
        return: () => cancellablePromise(_return(), abortSignalListener),
      }),
    };
  }

  return {
    [Symbol.asyncIterator]: () => ({
      next: () => cancellablePromise(_next(), abortSignalListener),
    }),
  };
}
