import { isPromise } from '../jsutils/isPromise.js';

/**
 * Drain a sync iterator after abrupt completion so later promise rejections
 * can be observed before they become unhandled.
 */
export function collectIteratorPromises(
  iterator: Iterator<unknown>,
): Array<Promise<unknown>> {
  const promises = [];
  try {
    while (true) {
      const iteration = iterator.next();
      if (iteration.done) {
        return promises;
      }
      if (isPromise(iteration.value)) {
        promises.push(iteration.value);
      }
    }
  } catch {
    // Ignore errors while draining the remaining items.
    return promises;
  }
}
