import { assert } from 'chai';

import { isPromise } from '../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

import { expectMatchingValues } from './expectMatchingValues.ts';

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
