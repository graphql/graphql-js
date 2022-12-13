import { assert } from 'chai';

import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { expectMatchingValues } from './expectMatchingValues.js';

async function expectMatchingPromises<T>(items: Promise<ReadonlyArray<T>>) {
  const values = await items;
  return expectMatchingValues(values);
}

export function expectEqualPromisesOrValues<T>(
  items: ReadonlyArray<PromiseOrValue<T>>,
): PromiseOrValue<T> {
  const [firstItem, ...remainingItems] = items;
  if (isPromise(firstItem)) {
    if (remainingItems.every(isPromise)) {
      return expectMatchingPromises(Promise.all(items));
    }
  } else if (remainingItems.every((item) => !isPromise(item))) {
    return expectMatchingValues(items);
  }

  assert(false, 'Received an invalid mixture of promises and values.');
}
