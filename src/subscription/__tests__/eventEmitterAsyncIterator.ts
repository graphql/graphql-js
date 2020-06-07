import { EventEmitter } from 'events';

/**
 * Create an AsyncIterator from an EventEmitter. Useful for mocking a
 * PubSub system for tests.
 */
export default function eventEmitterAsyncIterator<T = any>(
  eventEmitter: EventEmitter,
  eventName: string,
): AsyncIterator<T> {
  const pullQueue: Array<(...args: Array<any>) => void> = [];
  const pushQueue: Array<T> = [];
  let listening = true;
  eventEmitter.addListener(eventName, pushValue);

  function pushValue(event: T) {
    if (pullQueue.length !== 0) {
      const item = pullQueue.shift();

      if (item) {
        item({ value: event, done: false });
      }
    } else {
      pushQueue.push(event);
    }
  }

  function pullValue() {
    return new Promise((resolve) => {
      if (pushQueue.length !== 0) {
        resolve({ value: pushQueue.shift(), done: false });
      } else {
        pullQueue.push(resolve);
      }
    });
  }

  function emptyQueue() {
    if (listening) {
      listening = false;
      eventEmitter.removeListener(eventName, pushValue);
      for (const resolve of pullQueue) {
        resolve({ value: undefined, done: true });
      }
      pullQueue.length = 0;
      pushQueue.length = 0;
    }
  }

  return {
    next() {
      return listening ? pullValue() : (this as any).return();
    },
    return() {
      emptyQueue();
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error: Error) {
      emptyQueue();
      return Promise.reject(error);
    },
    [Symbol.asyncIterator as any]() {
      return this;
    },
  };
}
