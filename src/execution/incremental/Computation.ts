import { isPromise } from '../../jsutils/isPromise.js';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';

type MaybePromise<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'pending'; promise: Promise<T> }
  | { status: 'rejected'; reason: unknown };

/** @internal **/
export class Computation<T> {
  private _fn: () => PromiseOrValue<T>;
  private _onAbort: ((reason?: unknown) => void) | undefined;
  private _maybePromise?: MaybePromise<T>;
  constructor(
    fn: () => PromiseOrValue<T>,
    onAbort?: (reason?: unknown) => void,
  ) {
    this._fn = fn;
    this._onAbort = onAbort;
  }
  prime(): MaybePromise<T> {
    if (this._maybePromise) {
      return this._maybePromise;
    }
    try {
      const result = this._fn();
      if (isPromise(result)) {
        this._maybePromise = { status: 'pending', promise: result };
        result.then(
          (value) => {
            this._maybePromise = { status: 'fulfilled', value };
          },
          (reason: unknown) => {
            this._maybePromise = { status: 'rejected', reason };
          },
        );
      } else {
        this._maybePromise = { status: 'fulfilled', value: result };
      }
    } catch (reason: unknown) {
      this._maybePromise = { status: 'rejected', reason };
    }
    return this._maybePromise;
  }
  result(): PromiseOrValue<T> {
    const maybePromise = this.prime();
    switch (maybePromise.status) {
      case 'fulfilled':
        return maybePromise.value;
      case 'rejected':
        throw maybePromise.reason;
      case 'pending': {
        return maybePromise.promise;
      }
    }
  }
  abort(reason?: unknown): void {
    const maybePromise = this._maybePromise;
    if (!maybePromise) {
      this._maybePromise = {
        status: 'rejected',
        reason,
      };
      return;
    }
    const status = maybePromise.status;
    if (status === 'pending' && this._onAbort) {
      this._onAbort(reason);
      this._maybePromise = {
        status: 'rejected',
        reason,
      };
    }
  }
}
