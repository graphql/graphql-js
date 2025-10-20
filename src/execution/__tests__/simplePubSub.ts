import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import { withCleanup } from '../withCleanup.js';

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
    let pendingNext: ((result: R) => void) | undefined;
    const pushQueue: Array<R> = [];
    let listening = true;
    this._subscribers.add(pushValue);

    const emptyQueue = () => {
      listening = false;
      this._subscribers.delete(pushValue);
      if (pendingNext) {
        pendingNext(undefined as R);
      }
      pendingNext = undefined;
      pushQueue.length = 0;
    };

    async function* getSubscriberImpl(): AsyncGenerator<R, void, void> {
      // eslint-disable-next-line no-unmodified-loop-condition
      while (listening) {
        if (pushQueue.length > 0) {
          const value = pushQueue[0];
          pushQueue.shift();
          yield value;
          continue;
        }

        const { promise, resolve } = promiseWithResolvers<R>();
        pendingNext = resolve;
        // eslint-disable-next-line no-await-in-loop
        const value = await promise;
        if (!listening) {
          return;
        }
        yield value;
      }
    }

    return withCleanup(getSubscriberImpl(), emptyQueue);

    function pushValue(event: T): void {
      const value: R = transform(event);
      if (pendingNext) {
        pendingNext(value);
        pendingNext = undefined;
      } else {
        pushQueue.push(value);
      }
    }
  }
}
