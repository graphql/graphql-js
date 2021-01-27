import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Token, Location } from '../ast';
import { Source } from '../source';
import { TokenKind } from '../tokenKind';

describe('AST', () => {
  it('correctly inspect Token', () => {
    const token = new Token(TokenKind.DOLLAR, 0, 1, 1, 1, null);

    expect(token[Symbol.for('nodejs.util.inspect.custom')]()).to.deep.equal({
      kind: token.kind,
      value: token.value,
      line: token.line,
      column: token.column,
    });
  });
  it('correctly inspect Location', () => {
    const token = new Token(TokenKind.DOLLAR, 0, 1, 1, 1, null);
    const loc = new Location(token, token, new Source(''));

    expect(loc[Symbol.for('nodejs.util.inspect.custom')]()).to.deep.equal({
      start: token.start,
      end: token.end,
    });
  });
});
