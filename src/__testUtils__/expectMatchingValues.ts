import { expectJSON } from './expectJSON.js';

export function expectMatchingValues<T>(values: ReadonlyArray<T>): T {
  const [firstValue, ...remainingValues] = values;
  for (const value of remainingValues) {
    expectJSON(value).toDeepEqual(firstValue);
  }
  return firstValue;
}
