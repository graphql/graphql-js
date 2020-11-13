/**
 * Create an AsyncIterator from an EventEmitter. Useful for mocking a
 * PubSub system for tests.
 */
export default class SimplePubSub<T> {
  _subscribers: Set<(T) => void>;

  constructor() {
    this._subscribers = new Set();
  }

  emit(event: T): boolean {
    for (const subscriber of this._subscribers) {
      subscriber(event);
    }
    return this._subscribers.size > 0;
  }

  getSubscriber<R>(transform?: (T) => R): AsyncGenerator<R, void, void> {
    const pullQueue = [];
    const pushQueue = [];
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

    /* TODO: Flow doesn't support symbols as keys:
       https://github.com/facebook/flow/issues/3258 */
    return ({
      next() {
        if (!listening) {
          return Promise.resolve({ value: undefined, done: true });
        }

        if (pushQueue.length > 0) {
          return Promise.resolve({ value: pushQueue.shift(), done: false });
        }
        return new Promise((resolve) => pullQueue.push(resolve));
      },
      return() {
        emptyQueue();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw(error: mixed) {
        emptyQueue();
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    }: any);

    function pushValue(event: T): void {
      const value = transform != null ? transform(event) : event;
      if (pullQueue.length > 0) {
        pullQueue.shift()({ value, done: false });
      } else {
        pushQueue.push(value);
      }
    }
  }
}
