import { isPromise } from './isPromise';

interface FulfilledState<T> {
  fulfilled: true;
  rejected?: undefined;
  pending?: undefined;
  value: T;
}

interface RejectedState {
  fulfilled?: undefined;
  rejected: true;
  pending?: undefined;
  value: unknown;
}

interface PendingState<T> {
  fulfilled?: undefined;
  rejected?: undefined;
  pending: true;
  value: Promise<T>;
}

type State<T> = FulfilledState<T> | RejectedState | PendingState<T>;

const defaultOnRejectedFn = (reason: unknown) => {
  throw reason;
};

export class MaybePromise<T> {
  private readonly state: State<T>;

  constructor(executor: () => T | Promise<T>) {
    let value: T | Promise<T>;

    try {
      value = executor();
    } catch (reason) {
      this.state = { rejected: true, value: reason };
      return;
    }

    if (isPromise(value)) {
      this.state = { pending: true, value };
      return;
    }

    this.state = { fulfilled: true, value };
  }

  public then<TResult1 = T, TResult2 = never>(
    onFulfilled?:
      | ((value: T) => TResult1 | Promise<TResult1>)
      | undefined
      | null,
    onRejected?:
      | ((reason: unknown) => TResult2 | Promise<TResult2>)
      | undefined
      | null,
  ): MaybePromise<TResult1 | TResult2> {
    const state = this.state;

    if (state.pending) {
      return new MaybePromise(() => state.value.then(onFulfilled, onRejected));
    }

    const onRejectedFn =
      typeof onRejected === 'function' ? onRejected : defaultOnRejectedFn;

    if (state.rejected) {
      return new MaybePromise(() => onRejectedFn(state.value));
    }

    const onFulfilledFn =
      typeof onFulfilled === 'function' ? onFulfilled : undefined;

    return onFulfilledFn === undefined
      ? new MaybePromise(() => state.value as unknown as TResult1)
      : new MaybePromise(() => onFulfilledFn(state.value));
  }

  public catch<TResult = never>(
    onRejected:
      | ((reason: unknown) => TResult | Promise<TResult>)
      | undefined
      | null,
  ): MaybePromise<TResult> {
    return this.then(undefined, onRejected);
  }

  public resolve(): T | Promise<T> {
    const state = this.state;

    if (state.pending) {
      return Promise.resolve(state.value);
    }

    if (state.rejected) {
      throw state.value;
    }

    return state.value;
  }

  get [Symbol.toStringTag](): string {
    return 'MaybePromise';
  }
}
