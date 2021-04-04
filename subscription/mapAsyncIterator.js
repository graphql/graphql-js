'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.mapAsyncIterator = mapAsyncIterator;

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
function mapAsyncIterator(iterable, callback) {
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

  async function mapResult(resultPromise) {
    try {
      const result = await resultPromise;

      if (result.done) {
        return result;
      }

      return {
        value: await callback(result.value),
        done: false,
      };
    } catch (callbackError) {
      return abruptClose(callbackError);
    }
  }
  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */

  return {
    next() {
      return mapResult(iterator.next());
    },

    return() {
      return typeof iterator.return === 'function'
        ? mapResult(iterator.return())
        : Promise.resolve({
            value: undefined,
            done: true,
          });
    },

    throw(error) {
      if (typeof iterator.throw === 'function') {
        return mapResult(iterator.throw(error));
      }

      return Promise.reject(error).catch(abruptClose);
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
