/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator(iterable, callback, rejectCallback = error => {
  throw error;
}) {
  // $FlowFixMe[prop-missing]
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator = iteratorMethod.call(iterable);
  let $return;
  let abruptClose;

  if (typeof iterator.return === 'function') {
    $return = iterator.return;

    abruptClose = error => {
      const rethrow = () => Promise.reject(error);

      return $return.call(iterator).then(rethrow, rethrow);
    };
  }

  function mapResult(result) {
    return result.done ? result : asyncMapValue(result.value, callback).then(iteratorResult, abruptClose);
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
      return $return ? $return.call(iterator).then(mapResult, mapReject) : Promise.resolve({
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

function asyncMapValue(value, callback) {
  return new Promise(resolve => resolve(callback(value)));
}

function iteratorResult(value) {
  return {
    value,
    done: false
  };
}
