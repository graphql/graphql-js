/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type EventEmitter from 'events';
import { $$asyncIterator } from 'iterall';

/**
 * Create an AsyncIterator from an EventEmitter. Useful for mocking a
 * PubSub system for tests.
 */
export default function eventEmitterAsyncIterator(
  eventEmitter: EventEmitter,
  eventName: string,
): AsyncIterator<mixed> {
  const pullQueue = [];
  const pushQueue = [];
  let listening = true;
  eventEmitter.addListener(eventName, pushValue);

  function pushValue(event) {
    if (pullQueue.length !== 0) {
      pullQueue.shift()({ value: event, done: false });
    } else {
      pushQueue.push(event);
    }
  }

  function pullValue() {
    return new Promise(resolve => {
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

  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */
  return ({
    next() {
      return listening ? pullValue() : this.return();
    },
    return() {
      emptyQueue();
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      emptyQueue();
      return Promise.reject(error);
    },
    [$$asyncIterator]() {
      return this;
    },
  }: any);
}
