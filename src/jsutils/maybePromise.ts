import { isPromise } from './isPromise';

interface FulfilledState<T> {
  status: 'fulfilled';
  value: T;
}

interface RejectedState {
  status: 'rejected';
  value: unknown;
}

interface PendingState<T> {
  status: 'pending';
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
      this.state = { status: 'rejected', value: reason };
      return;
    }

    if (isPromise(value)) {
      this.state = { status: 'pending', value };
      return;
    }

    this.state = { status: 'fulfilled', value };
  }

  public static all<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
      MaybePromise<T8>,
      MaybePromise<T9>,
      MaybePromise<T10>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;
  public static all<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
      MaybePromise<T8>,
      MaybePromise<T9>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
  public static all<T1, T2, T3, T4, T5, T6, T7, T8>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
      MaybePromise<T8>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7, T8]>;
  public static all<T1, T2, T3, T4, T5, T6, T7>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7]>;
  public static all<T1, T2, T3, T4, T5, T6>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6]>;
  public static all<T1, T2, T3, T4, T5>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5]>;
  public static all<T1, T2, T3, T4>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
    ],
  ): MaybePromise<[T1, T2, T3, T4]>;
  public static all<T1, T2, T3>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
    ],
  ): MaybePromise<[T1, T2, T3]>;
  public static all<T1, T2>(
    valueOrPromises: readonly [MaybePromise<T1>, MaybePromise<T2>],
  ): MaybePromise<[T1, T2]>;
  public static all<T>(
    valueOrPromises: ReadonlyArray<MaybePromise<T>>,
  ): MaybePromise<Array<T>>;
  public static all<T>(
    valueOrPromises: ReadonlyArray<MaybePromise<T>>,
  ): MaybePromise<Array<T>> {
    const values: Array<T> = [];

    for (let i = 0; i < valueOrPromises.length; i++) {
      const valueOrPromise = valueOrPromises[i];

      const state = valueOrPromise.state;

      if (state.status === 'rejected') {
        return new MaybePromise(() => {
          throw state.value;
        });
      }

      if (state.status === 'pending') {
        return new MaybePromise(() =>
          Promise.all(valueOrPromises.slice(i)).then((resolvedPromises) =>
            values.concat(resolvedPromises),
          ),
        );
      }

      values.push(state.value);
    }

    return new MaybePromise(() => values);
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

    if (state.status === 'pending') {
      return new MaybePromise(() => state.value.then(onFulfilled, onRejected));
    }

    const onRejectedFn =
      typeof onRejected === 'function' ? onRejected : defaultOnRejectedFn;

    if (state.status === 'rejected') {
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

    if (state.status === 'pending') {
      return Promise.resolve(state.value);
    }

    if (state.status === 'rejected') {
      throw state.value;
    }

    return state.value;
  }

  get [Symbol.toStringTag](): string {
    return 'MaybePromise';
  }
}
