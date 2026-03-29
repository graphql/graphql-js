import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

export function returnIteratorCatchingErrors(
  iterator: Iterator<unknown> | AsyncIterator<unknown>,
): PromiseOrValue<void> {
  try {
    const result = iterator.return?.();
    if (isPromise(result)) {
      return result.then(
        () => undefined,
        () => undefined,
      );
    }
  } catch /* c8 ignore next 2 */ {
    // ignore errors
  }
}
