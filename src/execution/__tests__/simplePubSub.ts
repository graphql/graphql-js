import { assert } from 'chai';

/**
 * Create an AsyncIterator from an EventEmitter. Useful for mocking a
 * PubSub system for tests.
 *
 * @internal
 */
export class SimplePubSub<T> {
  private _subscribers: Set<(value: T) => void>;

  constructor() {
    this._subscribers = new Set();
  }

  emit(event: T): boolean {
    for (const subscriber of this._subscribers) {
      subscriber(event);
    }
    return this._subscribers.size > 0;
  }

  getSubscriber<R>(transform: (value: T) => R): AsyncGenerator<R, void, void> {
    const pullQueue: Array<(result: IteratorResult<R, void>) => void> = [];
    const pushQueue: Array<R> = [];
    let listening = true;
    this._subscribers.add(pushValue);

    const emptyQueue = () => {
      listening = false;
      this._subscribers.delete(pushValue);
      for (const resolve of pullQueue) {
        resolve({ value: undefined, done: true });
      }
      pullQueue.length = 0;
      pushQueue.length = 0;
    };

    return {
      next(): Promise<IteratorResult<R, void>> {
        if (!listening) {
          return Promise.resolve({ value: undefined, done: true });
        }

        if (pushQueue.length > 0) {
          const value = pushQueue[0];
          pushQueue.shift();
          return Promise.resolve({ value, done: false });
        }
        return new Promise((resolve) => pullQueue.push(resolve));
      },
      return(): Promise<IteratorResult<R, void>> {
        emptyQueue();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw(error: unknown) {
        emptyQueue();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    function pushValue(event: T): void {
      const value: R = transform(event);
      if (pullQueue.length > 0) {
        const receiver = pullQueue.shift();
        assert(receiver != null);
        receiver({ value, done: false });
      } else {
        pushQueue.push(value);
      }
    }
  }
}
