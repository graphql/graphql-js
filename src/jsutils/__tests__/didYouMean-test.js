// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';
import didYouMean from '../didYouMean';

describe('didYouMean', () => {
  it('Does accept an empty list', () => {
    expect(didYouMean([])).to.equal('');
  });

  it('Handle single suggestion', () => {
    expect(didYouMean(['A'])).to.equal(' Did you mean A?');
  });

  it('Handle two suggestions', () => {
    expect(didYouMean(['A', 'B'])).to.equal(' Did you mean A or B?');
  });

  it('Handle multiple suggestions', () => {
    expect(didYouMean(['A', 'B', 'C'])).to.equal(' Did you mean A, B, or C?');
  });

  it('Limits to five suggestions', () => {
    expect(didYouMean(['A', 'B', 'C', 'D', 'E', 'F'])).to.equal(
      ' Did you mean A, B, C, D, or E?',
    );
  });
});
