import { isPromise } from '../jsutils/isPromise.js';

export function returnIteratorCatchingErrors(
  iterator: Iterator<unknown> | AsyncIterator<unknown>,
): void {
  try {
    const result = iterator.return?.();
    if (isPromise(result)) {
      result.catch(() => {
        // ignore errors
      });
    }
  } catch /* c8 ignore next 2 */ {
    // ignore errors
  }
}
