// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import suggestionList from '../suggestionList';

describe('suggestionList', () => {
  it('Returns results when input is empty', () => {
    expect(suggestionList('', ['a'])).to.deep.equal(['a']);
  });

  it('Returns empty array when there are no options', () => {
    expect(suggestionList('input', [])).to.deep.equal([]);
  });

  it('Returns options with small lexical distance', () => {
    expect(suggestionList('greenish', ['green'])).to.deep.equal(['green']);
    expect(suggestionList('green', ['greenish'])).to.deep.equal(['greenish']);
  });

  it('Returns options with different case', () => {
    // cSpell:ignore verylongstring
    expect(suggestionList('verylongstring', ['VERYLONGSTRING'])).to.deep.equal([
      'VERYLONGSTRING',
    ]);

    expect(suggestionList('VERYLONGSTRING', ['verylongstring'])).to.deep.equal([
      'verylongstring',
    ]);

    expect(suggestionList('VERYLONGSTRING', ['VeryLongString'])).to.deep.equal([
      'VeryLongString',
    ]);
  });

  it('Returns options with transpositions', () => {
    expect(suggestionList('agr', ['arg'])).to.deep.equal(['arg']);

    expect(suggestionList('214365879', ['123456789'])).to.deep.equal([
      '123456789',
    ]);
  });

  it('Returns options sorted based on lexical distance', () => {
    expect(suggestionList('abc', ['a', 'ab', 'abc'])).to.deep.equal([
      'abc',
      'ab',
    ]);
  });

  it('Returns options with the same lexical distance sorted lexicographically', () => {
    expect(suggestionList('a', ['az', 'ax', 'ay'])).to.deep.equal([
      'ax',
      'ay',
      'az',
    ]);
  });
});
