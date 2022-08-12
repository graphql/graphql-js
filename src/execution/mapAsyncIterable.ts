/* eslint-disable no-await-in-loop */

import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { Repeater, RepeaterClosureSignal } from '../jsutils/Repeater';

/**
 * Given an AsyncIterable and a callback function, return an AsyncGenerator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterable<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  fn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, R, void> {
  return new Repeater<U, R, void>(async ({ push, stop }) => {
    const iterator: AsyncIterator<T, R, void> =
      iterable[Symbol.asyncIterator]();

    let next = iterator.next();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let iteration: IteratorResult<T, R>;
      try {
        iteration = await next;
      } catch (err) {
        await abruptClose(iterator);
        throw err;
      }

      const { done, value } = iteration;

      if (done) {
        stop();
        return value;
      }

      let mapped: U;
      try {
        mapped = await fn(value);
      } catch (err) {
        await abruptClose(iterator);
        throw err;
      }

      try {
        await push(mapped);
      } catch (err) {
        if (err instanceof RepeaterClosureSignal) {
          if (typeof iterator.return !== 'function') {
            stop();
            return undefined as unknown as R; // void :(
          }

          next = iterator.return(err.returnValue);
          continue;
        }

        if (typeof iterator.throw !== 'function') {
          await abruptClose(iterator);
          throw err;
        }

        next = iterator.throw(err);
        continue;
      }

      next = iterator.next();
    }
  });
}

async function abruptClose(iterator: AsyncIterator<unknown>): Promise<void> {
  if (typeof iterator.return === 'function') {
    try {
      await iterator.return(); /* c8 ignore start */
    } catch (_err) {
      // FIXME: add test case
      /* ignore error */
    } /* c8 ignore stop */
  }
}
