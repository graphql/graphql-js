// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { assertValidName } from '../assertValidName';

describe('assertValidName()', () => {
  it('throws for use of leading double underscores', () => {
    expect(() => assertValidName('__bad')).to.throw(
      '"__bad" must not begin with "__", which is reserved by GraphQL introspection.',
    );
  });

  it('throws for non-strings', () => {
    // $DisableFlowOnNegativeTest
    expect(() => assertValidName({})).to.throw(/Expected string/);
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertValidName('>--()-->')).to.throw(/Names must match/);
  });
});
