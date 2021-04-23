import { expect } from 'chai';
import { describe, it } from 'mocha';

import { naturalCompare } from '../naturalCompare';

describe('naturalCompare', () => {
  it('Handles empty strings', () => {
    expect(naturalCompare('', '')).to.equal(0);

    expect(naturalCompare('', 'a')).to.equal(-1);
    expect(naturalCompare('', '1')).to.equal(-1);

    expect(naturalCompare('a', '')).to.equal(1);
    expect(naturalCompare('1', '')).to.equal(1);
  });

  it('Handles strings of different length', () => {
    expect(naturalCompare('A', 'A')).to.equal(0);
    expect(naturalCompare('A1', 'A1')).to.equal(0);

    expect(naturalCompare('A', 'AA')).to.equal(-1);
    expect(naturalCompare('A1', 'A1A')).to.equal(-1);

    expect(naturalCompare('AA', 'A')).to.equal(1);
    expect(naturalCompare('A1A', 'A1')).to.equal(1);
  });

  it('Handles numbers', () => {
    expect(naturalCompare('0', '0')).to.equal(0);
    expect(naturalCompare('1', '1')).to.equal(0);

    expect(naturalCompare('1', '2')).to.equal(-1);
    expect(naturalCompare('2', '1')).to.equal(1);

    expect(naturalCompare('2', '11')).to.equal(-1);
    expect(naturalCompare('11', '2')).to.equal(1);
  });

  it('Handles numbers with leading zeros', () => {
    expect(naturalCompare('00', '00')).to.equal(0);
    expect(naturalCompare('0', '00')).to.equal(-1);
    expect(naturalCompare('00', '0')).to.equal(1);

    expect(naturalCompare('02', '11')).to.equal(-1);
    expect(naturalCompare('11', '02')).to.equal(1);

    expect(naturalCompare('011', '200')).to.equal(-1);
    expect(naturalCompare('200', '011')).to.equal(1);
  });

  it('Handles numbers embedded into names', () => {
    expect(naturalCompare('a0a', 'a0a')).to.equal(0);
    expect(naturalCompare('a0a', 'a9a')).to.equal(-1);
    expect(naturalCompare('a9a', 'a0a')).to.equal(1);

    expect(naturalCompare('a00a', 'a00a')).to.equal(0);
    expect(naturalCompare('a00a', 'a09a')).to.equal(-1);
    expect(naturalCompare('a09a', 'a00a')).to.equal(1);

    expect(naturalCompare('a0a1', 'a0a1')).to.equal(0);
    expect(naturalCompare('a0a1', 'a0a9')).to.equal(-1);
    expect(naturalCompare('a0a9', 'a0a1')).to.equal(1);

    expect(naturalCompare('a10a11a', 'a10a11a')).to.equal(0);
    expect(naturalCompare('a10a11a', 'a10a19a')).to.equal(-1);
    expect(naturalCompare('a10a19a', 'a10a11a')).to.equal(1);

    expect(naturalCompare('a10a11a', 'a10a11a')).to.equal(0);
    expect(naturalCompare('a10a11a', 'a10a11b')).to.equal(-1);
    expect(naturalCompare('a10a11b', 'a10a11a')).to.equal(1);
  });
});
