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
