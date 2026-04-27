import { assert } from 'chai';

export function expectToThrow(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  assert.fail('Expected function to throw, but it completed successfully.');
}
