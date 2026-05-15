import { isPromise } from '../../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

type MaybePromise<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'pending'; promise: Promise<T> }
  | { status: 'rejected'; reason: unknown };

/** @internal * */
export class Computation<T> {
  private _fn: () => PromiseOrValue<T>;
  private _onAbort: ((reason?: unknown) => PromiseOrValue<void>) | undefined;
  private _maybePromise?: MaybePromise<T>;
  constructor(
    fn: () => PromiseOrValue<T>,
    onAbort?: (reason?: unknown) => PromiseOrValue<void>,
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
  abort(reason?: unknown): PromiseOrValue<void> {
    const maybePromise = this._maybePromise;
    if (!maybePromise) {
      this._maybePromise = {
        status: 'rejected',
        reason,
      };
      return;
    }
    const status = maybePromise.status;
    if (status === 'pending') {
      this._maybePromise = {
        status: 'rejected',
        reason,
      };
      if (this._onAbort) {
        return this._onAbort(reason);
      }
    }
  }
}
