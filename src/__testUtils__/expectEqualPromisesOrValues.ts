import { assert } from 'chai';

import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { expectMatchingValues } from './expectMatchingValues.js';

export function expectEqualPromisesOrValues<T>(
  items: ReadonlyArray<PromiseOrValue<T>>,
): PromiseOrValue<T> {
  const [firstItem, ...remainingItems] = items;
  if (isPromise(firstItem)) {
    if (remainingItems.every(isPromise)) {
      return Promise.all(items).then(expectMatchingValues);
    }
  } else if (remainingItems.every((item) => !isPromise(item))) {
    return expectMatchingValues(items);
  }

  assert(false, 'Received an invalid mixture of promises and values.');
}
