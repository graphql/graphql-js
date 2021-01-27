import { expect } from 'chai';
import { describe, it } from 'mocha';

import { inspectStr } from '../inspectStr';

describe('inspectStr', () => {
  it('handles null and undefined values', () => {
    expect(inspectStr(null)).to.equal('null');
    expect(inspectStr(undefined)).to.equal('null');
  });

  it('correctly print various strings', () => {
    expect(inspectStr('')).to.equal('``');
    expect(inspectStr('a')).to.equal('`a`');
    expect(inspectStr('"')).to.equal('`"`');
    expect(inspectStr("'")).to.equal("`'`");
    expect(inspectStr('\\"')).to.equal('`\\"`');
  });
});
