import { describe, it } from 'node:test';

import { expect } from 'chai';

import { getLocation } from '../location.ts';
import { Source } from '../source.ts';

describe('getLocation', () => {
  it('gets locations in an empty source', () => {
    const source = new Source('');

    expect(getLocation(source, 0)).to.deep.equal({ line: 1, column: 1 });
  });

  it('gets locations in a source without line endings', () => {
    const source = new Source('abc');

    expect(getLocation(source, 0)).to.deep.equal({ line: 1, column: 1 });
    expect(getLocation(source, 2)).to.deep.equal({ line: 1, column: 3 });
    expect(getLocation(source, 3)).to.deep.equal({ line: 1, column: 4 });
  });

  it('gets locations before, on, and after different line endings', () => {
    const source = new Source('a\nb\rc\r\nd');

    expect(
      Array.from({ length: source.body.length + 1 }, (_, position) =>
        getLocation(source, position),
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

  it('gets locations around consecutive and trailing line endings', () => {
    const source = new Source('\n\r\r\n');

    expect(
      Array.from({ length: source.body.length + 1 }, (_, position) =>
        getLocation(source, position),
      ),
    ).to.deep.equal([
      { line: 1, column: 1 },
      { line: 2, column: 1 },
      { line: 3, column: 1 },
      { line: 4, column: 0 },
      { line: 4, column: 1 },
    ]);
  });

  // FIXME: These UTF-16 columns may differ from Unicode scalar value columns,
  // causing interoperability issues between implementations.
  // https://spec.graphql.org/draft/#sec-Errors.Error-Result-Format
  it('counts UTF-16 code units', () => {
    const source = new Source('\u{1F600}\u00E9');

    expect(getLocation(source, 1)).to.deep.equal({ line: 1, column: 2 });
    expect(getLocation(source, 2)).to.deep.equal({ line: 1, column: 3 });
    expect(getLocation(source, 3)).to.deep.equal({ line: 1, column: 4 });
  });

  // GraphQL defines CR, LF, and CRLF as line terminators:
  // https://spec.graphql.org/draft/#sec-Line-Terminators
  it('does not treat Unicode line and paragraph separators as line endings', () => {
    const source = new Source('a\u2028b\u2029c');

    expect(getLocation(source, 2)).to.deep.equal({ line: 1, column: 3 });
    expect(getLocation(source, 4)).to.deep.equal({ line: 1, column: 5 });
  });

  it('gets locations relative to the source body despite its location offset', () => {
    const source = new Source('a\nb', 'example.graphql', {
      line: 10,
      column: 20,
    });

    expect(getLocation(source, 0)).to.deep.equal({ line: 1, column: 1 });
    expect(getLocation(source, 2)).to.deep.equal({ line: 2, column: 1 });
  });

  it('handles repeated calls with positions in any order', () => {
    const source = new Source('a\nb');

    expect(getLocation(source, 2)).to.deep.equal({ line: 2, column: 1 });
    expect(getLocation(source, 1)).to.deep.equal({ line: 1, column: 2 });
    expect(getLocation(source, 0)).to.deep.equal({ line: 1, column: 1 });
    expect(getLocation(source, 2)).to.deep.equal({ line: 2, column: 1 });
  });

  it('uses the current source body on each call', () => {
    const source = new Source('a\nb');

    expect(getLocation(source, 2)).to.deep.equal({ line: 2, column: 1 });
    source.body = 'a b';
    expect(getLocation(source, 2)).to.deep.equal({ line: 1, column: 3 });
    source.body = '\r\nb';
    expect(getLocation(source, 2)).to.deep.equal({ line: 2, column: 1 });
  });
});
