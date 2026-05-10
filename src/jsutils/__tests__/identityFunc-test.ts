import { describe, it } from 'node:test';

import { expect } from 'chai';

import { identityFunc } from '../identityFunc.ts';

describe('identityFunc', () => {
  it('returns the first argument it receives', () => {
    // @ts-expect-error (Expects an argument)
    expect(identityFunc()).to.equal(undefined);
    expect(identityFunc(undefined)).to.equal(undefined);
    expect(identityFunc(null)).to.equal(null);

    const obj = {};
    expect(identityFunc(obj)).to.equal(obj);
  });
});
