import { expectJSON } from './expectJSON';

export function expectMatchingValues<T>(values: ReadonlyArray<T>): T {
  const remainingValues = values.slice(1);
  for (const value of remainingValues) {
    expectJSON(value).toDeepEqual(values[0]);
  }
  return values[0];
}
