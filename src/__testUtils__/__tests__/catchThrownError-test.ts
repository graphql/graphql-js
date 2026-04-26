import { expect } from 'chai';
import { describe, it } from 'mocha';

import { catchThrownError } from '../catchThrownError.js';

describe('catchThrownError', () => {
  it('returns the thrown value', () => {
    const error = new Error('boom');

    expect(
      catchThrownError(() => {
        throw error;
      }),
    ).to.equal(error);
  });

  it('throws when the function does not throw', () => {
    expect(() => catchThrownError(() => undefined)).to.throw(
      'Expected function to throw.',
    );
  });
});
