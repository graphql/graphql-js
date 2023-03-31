import { expectJSON } from './expectJSON.js';

export function expectMatchingValues<T>(values: ReadonlyArray<T>): T {
  const [firstValue, ...remainingValues] = values;

  /* c8 ignore start */
  if (firstValue === undefined) {
    throw new Error('Expected a non-empty array');
  }
  /* c8 ignore stop */

  for (const value of remainingValues) {
    expectJSON(value).toDeepEqual(firstValue);
  }

  return firstValue;
}
