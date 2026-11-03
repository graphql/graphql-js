import { describe, it } from 'mocha';

import { expect } from 'chai';

import { getLocations } from '../location';
import { Source } from '../source';

describe('getLocations', () => {
  it('handles an empty list of positions', () => {
    expect(getLocations([])).to.deep.equal([]);
  });

  it('gets locations in an empty source', () => {
    const source = new Source('');

    expect(getLocations([{ source, start: 0 }])).to.deep.equal([
      { line: 1, column: 1 },
    ]);
  });

  it('gets locations around different line endings', () => {
    const source = new Source('a\nb\rc\r\nd');

    expect(
      getLocations(
        Array.from({ length: source.body.length + 1 }, (_, start) => ({
          source,
          start,
        })),
      ),
    ).to.deep.equal([
      { line: 1, column: 1 },
      { line: 1, column: 2 },
      { line: 2, column: 1 },
      { line: 2, column: 2 },
      { line: 3, column: 1 },
      { line: 3, column: 2 },
      { line: 4, column: 0 },
      { line: 4, column: 1 },
      { line: 4, column: 2 },
    ]);
  });

  it('preserves input order and duplicate positions without changing the input', () => {
    const source = new Source('a\nb\nc');
    const locations = Object.freeze([
      Object.freeze({ source, start: 4 }),
      Object.freeze({ source, start: 0 }),
      Object.freeze({ source, start: 2 }),
      Object.freeze({ source, start: 4 }),
    ]);

    expect(getLocations(locations)).to.deep.equal([
      { line: 3, column: 1 },
      { line: 1, column: 1 },
      { line: 2, column: 1 },
      { line: 3, column: 1 },
    ]);
    expect(locations.map(({ start }) => start)).to.deep.equal([4, 0, 2, 4]);
  });

  it('groups interleaved sources by identity', () => {
    const first = new Source('a\nb');
    const second = new Source('a b');

    expect(
      getLocations([
        { source: first, start: 2 },
        { source: second, start: 2 },
        { source: first, start: 1 },
        { source: second, start: 0 },
      ]),
    ).to.deep.equal([
      { line: 2, column: 1 },
      { line: 1, column: 3 },
      { line: 1, column: 2 },
      { line: 1, column: 1 },
    ]);
  });

  it('uses the current source body across repeated calls', () => {
    const source = new Source('a\nb');
    const locations = [
      { source, start: 2 },
      { source, start: 1 },
    ];

    expect(getLocations(locations)).to.deep.equal([
      { line: 2, column: 1 },
      { line: 1, column: 2 },
    ]);
    source.body = 'a b';
    expect(getLocations(locations)).to.deep.equal([
      { line: 1, column: 3 },
      { line: 1, column: 2 },
    ]);
  });
});
