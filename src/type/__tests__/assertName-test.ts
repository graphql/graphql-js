import { expect } from 'chai';
import { describe, it } from 'mocha';

import { assertEnumValueName, assertName } from '../assertName';

describe('assertName', () => {
  it('passthrough valid name', () => {
    expect(assertName('_ValidName123')).to.equal('_ValidName123');
  });

  it('throws for non-strings', () => {
    // @ts-expect-error
    expect(() => assertName({})).to.throw('Expected name to be a string.');
  });

  it('throws on empty strings', () => {
    expect(() => assertName('')).to.throw(
      'Expected name to be a non-empty string.',
    );
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertName('>--()-->')).to.throw(
      'Names must only contain [_a-zA-Z0-9] but ">--()-->" does not.',
    );
  });

  it('throws for names starting with invalid characters', () => {
    expect(() => assertName('42MeaningsOfLife')).to.throw(
      'Names must start with [_a-zA-Z] but "42MeaningsOfLife" does not.',
    );
  });
});

describe('assertEnumValueName', () => {
  it('passthrough valid name', () => {
    expect(assertEnumValueName('_ValidName123')).to.equal('_ValidName123');
  });

  it('throws on empty strings', () => {
    expect(() => assertEnumValueName('')).to.throw(
      'Expected name to be a non-empty string.',
    );
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertEnumValueName('>--()-->')).to.throw(
      'Names must only contain [_a-zA-Z0-9] but ">--()-->" does not.',
    );
  });

  it('throws for names starting with invalid characters', () => {
    expect(() => assertEnumValueName('42MeaningsOfLife')).to.throw(
      'Names must start with [_a-zA-Z] but "42MeaningsOfLife" does not.',
    );
  });

  it('throws for restricted names', () => {
    expect(() => assertEnumValueName('true')).to.throw(
      'Enum values cannot be named: true',
    );
    expect(() => assertEnumValueName('false')).to.throw(
      'Enum values cannot be named: false',
    );
    expect(() => assertEnumValueName('null')).to.throw(
      'Enum values cannot be named: null',
    );
  });
});
