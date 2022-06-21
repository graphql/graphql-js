import { assert } from 'chai';

import { isPromise } from '../jsutils/isPromise';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

import { expectMatchingValues } from './expectMatchingValues';

export function expectEqualPromisesOrValues<T>(
  items: ReadonlyArray<PromiseOrValue<T>>,
): PromiseOrValue<T> {
  const remainingItems = items.slice();
  const firstItem = remainingItems.shift();

  if (isPromise(firstItem)) {
    if (remainingItems.every(isPromise)) {
      return Promise.all(items).then(expectMatchingValues);
    }
  } else if (remainingItems.every((item) => !isPromise(item))) {
    return expectMatchingValues(items);
  }

  assert(false, 'Received an invalid mixture of promises and values.');
}
