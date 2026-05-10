import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectToThrow } from '../expectToThrow.ts';

describe('expectToThrow', () => {
  it('returns the thrown error', () => {
    const error = new Error('oops');
    expect(
      expectToThrow(() => {
        throw error;
      }),
    ).to.equal(error);
  });

  it('returns the same thrown error instance', () => {
    const error = new Error('oops');
    expect(
      expectToThrow(() => {
        throw error;
      }),
    ).to.equal(error);
  });

  it('throws if callback does not throw', () => {
    expect(() => expectToThrow(() => 123)).to.throw(
      'Expected function to throw, but it completed successfully.',
    );
  });
});
