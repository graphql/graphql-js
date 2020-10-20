import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../invariant';

describe('invariant', () => {
  it('throws on false conditions', () => {
    expect(() => invariant(false, 'Oops!')).to.throw('Oops!');
  });

  it('use default error message', () => {
    expect(() => invariant(false)).to.throw('Unexpected invariant triggered.');
  });
});
