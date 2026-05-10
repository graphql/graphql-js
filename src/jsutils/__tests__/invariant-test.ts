import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../invariant.ts';

describe('invariant', () => {
  it('throws on false conditions', () => {
    expect(() => invariant(false, 'Oops!')).to.throw('Oops!');
  });

  it('use default error message', () => {
    expect(() => invariant(false)).to.throw('Unexpected invariant triggered.');
  });
});
