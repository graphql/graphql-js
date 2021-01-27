import { expect } from 'chai';
import { describe, it } from 'mocha';

import { didYouMean } from '../didYouMean';

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
});
