// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import didYouMean from '../didYouMean';

describe('didYouMean', () => {
  it('Does accept an empty list', () => {
    expect(didYouMean([])).to.equal('');
  });

  it('Handles single suggestion', () => {
    expect(didYouMean(['A'])).to.equal(' Did you mean "A"?');
  });

  it('Handles two suggestions', () => {
    expect(didYouMean(['A', 'B'])).to.equal(' Did you mean "A" or "B"?');
  });

  it('Handles multiple suggestions', () => {
    expect(didYouMean(['A', 'B', 'C'])).to.equal(
      ' Did you mean "A", "B", or "C"?',
    );
  });

  it('Limits to five suggestions', () => {
    expect(didYouMean(['A', 'B', 'C', 'D', 'E', 'F'])).to.equal(
      ' Did you mean "A", "B", "C", "D", or "E"?',
    );
  });

  it('Adds sub-message', () => {
    expect(didYouMean('the letter', ['A'])).to.equal(
      ' Did you mean the letter "A"?',
    );
  });
  // Test for handling Duplications
  it('Handle duplicates, resulting in single unique element', () => {
    expect(didYouMean(['A', 'A'])).to.equal(' Did you mean "A"?');
  });
  it('Handle duplicates, resulting in two elements', () => {
    expect(didYouMean(['A', 'B', 'A', 'B'])).to.equal(
      ' Did you mean "A" or "B"?',
    );
  });
  it('Handle duplicates, resulting in more thentwo elements', () => {
    expect(didYouMean(['A', 'B', 'C', 'C', 'B', 'A'])).to.equal(
      ' Did you mean "A", "B", or "C"?',
    );
  });
  // Test for filtering null, undefined, NaN...
  it('should filter the broken values', () => {
    expect(didYouMean(['A', 'B', 'C', 'C', undefined, null])).to.equal(
      ' Did you mean "A", "B", or "C"?',
    );
  });
  it('Does accept an empty list', () => {
    expect(didYouMean([null, undefined, NaN])).to.equal('');
  });
});
