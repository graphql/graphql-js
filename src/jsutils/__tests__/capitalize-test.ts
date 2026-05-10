import { describe, it } from 'node:test';

import { expect } from 'chai';

import { capitalize } from '../capitalize.ts';

describe('capitalize', () => {
  it('Converts the first character of string to upper case and the remaining to lower case', () => {
    expect(capitalize('')).to.equal('');

    expect(capitalize('a')).to.equal('A');
    expect(capitalize('A')).to.equal('A');

    expect(capitalize('ab')).to.equal('Ab');
    expect(capitalize('aB')).to.equal('Ab');
    expect(capitalize('Ab')).to.equal('Ab');
    expect(capitalize('AB')).to.equal('Ab');

    expect(capitalize('platypus')).to.equal('Platypus');
    expect(capitalize('PLATYPUS')).to.equal('Platypus');
  });
});
