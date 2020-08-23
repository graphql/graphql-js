import { expect } from 'chai';
import { describe, it } from 'mocha';

import { assertValidName } from '../assertValidName';

describe('assertValidName()', () => {
  it('passthrough valid name', () => {
    expect(assertValidName('_ValidName123')).to.equal('_ValidName123');
  });

  it('throws for use of leading double underscores', () => {
    expect(() => assertValidName('__bad')).to.throw(
      '"__bad" must not begin with "__", which is reserved by GraphQL introspection.',
    );
  });

  it('throws for non-strings', () => {
    // $FlowExpectedError[incompatible-call]
    expect(() => assertValidName({})).to.throw('Expected name to be a string.');
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertValidName('>--()-->')).to.throw(/Names must match/);
  });
});
