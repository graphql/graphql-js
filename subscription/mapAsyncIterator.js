"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mapAsyncIterator = mapAsyncIterator;

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
function mapAsyncIterator(iterable, callback, rejectCallback = error => {
  throw error;
}) {
  // $FlowFixMe[prop-missing]
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator = iteratorMethod.call(iterable);

  async function abruptClose(error) {
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch (_e) {
        /* ignore error */
      }
    }

    throw error;
  }

  async function mapResult(result) {
    if (result.done) {
      return result;
    }

    try {
      return {
        value: await callback(result.value),
        done: false
      };
    } catch (callbackError) {
      return abruptClose(callbackError);
    }
  }

  function mapReject(error) {
    try {
      return {
        value: rejectCallback(error),
        done: false
      };
    } catch (callbackError) {
      return abruptClose(callbackError);
    }
  }
  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */


  return {
    next() {
      return iterator.next().then(mapResult, mapReject);
    },

    return() {
      return typeof iterator.return === 'function' ? iterator.return().then(mapResult, mapReject) : Promise.resolve({
        value: undefined,
        done: true
      });
    },

    throw(error) {
      if (typeof iterator.throw === 'function') {
        return iterator.throw(error).then(mapResult, mapReject);
      }

      return Promise.reject(error).catch(abruptClose);
    },

    [Symbol.asyncIterator]() {
      return this;
    }

  };
}
