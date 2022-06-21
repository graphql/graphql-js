import { assert } from 'chai';

import { isPromise } from '../jsutils/isPromise';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

import { expectJSON } from './expectJSON';

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

function expectMatchingValues<T>(values: ReadonlyArray<T>): T {
  const remainingValues = values.slice(1);
  for (const value of remainingValues) {
    expectJSON(value).toDeepEqual(values[0]);
  }
  return values[0];
}
