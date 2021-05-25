/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator(iterable, callback) {
  // $FlowIssue[incompatible-use]
  const iterator = iterable[Symbol.asyncIterator]();

  async function mapResult(result) {
    if (result.done) {
      return result;
    }

    try {
      // @ts-expect-error FIXME: TS Conversion
      return {
        value: await callback(result.value),
        done: false,
      };
    } catch (error) {
      // istanbul ignore else (FIXME: add test case)
      if (typeof iterator.return === 'function') {
        try {
          await iterator.return();
        } catch (_e) {
          /* ignore error */
        }
      }

      throw error;
    }
  }

  return {
    async next() {
      return mapResult(await iterator.next());
    },

    async return() {
      return typeof iterator.return === 'function'
        ? mapResult(await iterator.return())
        : {
            value: undefined,
            done: true,
          };
    },

    async throw(error) {
      return typeof iterator.throw === 'function'
        ? mapResult(await iterator.throw(error))
        : Promise.reject(error);
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}