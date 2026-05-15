import { isPromiseLike } from '../jsutils/isPromise.ts';

/**
 * Drain a sync iterator after abrupt completion so later promise rejections
 * can be observed before they become unhandled.
 *
 * @internal
 */
export function collectIteratorPromises(
  iterator: Iterator<unknown>,
): Array<unknown> {
  const promises = [];
  try {
    while (true) {
      const iteration = iterator.next();
      if (iteration.done) {
        return promises;
      }
      if (isPromiseLike(iteration.value)) {
        promises.push(iteration.value);
      }
    }
  } catch {
    // Ignore errors while draining the remaining items.
    return promises;
  }
}
