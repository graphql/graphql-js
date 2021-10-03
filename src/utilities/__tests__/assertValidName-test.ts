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
    // @ts-expect-error
    expect(() => assertValidName({})).to.throw('Expected name to be a string.');
  });

  it('throws on empty strings', () => {
    expect(() => assertValidName('')).to.throw(
      'Expected name to be a non-empty string.',
    );
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertValidName('>--()-->')).to.throw(
      'Names must only contain [_a-zA-Z0-9] but ">--()-->" does not.',
    );
  });

  it('throws for names starting with invalid characters', () => {
    expect(() => assertValidName('42MeaningsOfLife')).to.throw(
      'Names must start with [_a-zA-Z] but "42MeaningsOfLife" does not.',
    );
  });
});
