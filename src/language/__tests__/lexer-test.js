/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Source } from '../source';
import { createLexer, TokenKind } from '../lexer';

function lexOne(str) {
  const lexer = createLexer(new Source(str));
  return lexer.advance();
}

/* eslint-disable max-len */

describe('Lexer', () => {

  it('disallows uncommon control characters', () => {

    expect(() => lexOne('\u0007')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) ' +
      'Cannot contain the invalid character "\\u0007"'
    );

  });

  it('accepts BOM header', () => {
    expect(lexOne('\uFEFF foo')
    ).to.containSubset({
      kind: TokenKind.NAME,
      start: 2,
      end: 5,
      value: 'foo'
    });
  });

  it('records line and column', () => {
    expect(lexOne('\n \r\n \r  foo\n')).to.containSubset({
      kind: TokenKind.NAME,
      start: 8,
      end: 11,
      line: 4,
      column: 3,
      value: 'foo'
    });
  });

  it('can be JSON.stringified or util.inspected', () => {
    const token = lexOne('foo');
    expect(JSON.stringify(token)).to.equal(
      '{"kind":"Name","value":"foo","line":1,"column":1}'
    );
    // NB: util.inspect used to suck
    if (parseFloat(process.version.slice(1)) > 0.10) {
      expect(require('util').inspect(token)).to.equal(
        '{ kind: \'Name\', value: \'foo\', line: 1, column: 1 }'
      );
    }
  });

  it('skips whitespace and comments', () => {

    expect(lexOne(`

    foo


`)
    ).to.containSubset({
      kind: TokenKind.NAME,
      start: 6,
      end: 9,
      value: 'foo'
    });

    expect(lexOne(`
    #comment
    foo#comment
`)
    ).to.containSubset({
      kind: TokenKind.NAME,
      start: 18,
      end: 21,
      value: 'foo'
    });

    expect(lexOne(',,,foo,,,')).to.containSubset({
      kind: TokenKind.NAME,
      start: 3,
      end: 6,
      value: 'foo'
    });

  });

  it('errors respect whitespace', () => {

    expect(() => lexOne(`

    ?


`)
    ).to.throw(
      'Syntax Error GraphQL request (3:5) ' +
      'Cannot parse the unexpected character "?".\n' +
      '\n' +
      '2: \n' +
      '3:     ?\n' +
      '       ^\n' +
      '4: \n'
    );

  });

  it('lexes strings', () => {

    expect(
      lexOne('"simple"')
    ).to.containSubset({
      kind: TokenKind.STRING,
      start: 0,
      end: 8,
      value: 'simple'
    });

    expect(
      lexOne('" white space "')
    ).to.containSubset({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: ' white space '
    });

    expect(
      lexOne('"quote \\""')
    ).to.containSubset({
      kind: TokenKind.STRING,
      start: 0,
      end: 10,
      value: 'quote "'
    });

    expect(
      lexOne('"escaped \\n\\r\\b\\t\\f"')
    ).to.containSubset({
      kind: TokenKind.STRING,
      start: 0,
      end: 20,
      value: 'escaped \n\r\b\t\f'
    });

    expect(
      lexOne('"slashes \\\\ \\/"')
    ).to.containSubset({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: 'slashes \\ /'
    });

    expect(
      lexOne('"unicode \\u1234\\u5678\\u90AB\\uCDEF"')
    ).to.containSubset({
      kind: TokenKind.STRING,
      start: 0,
      end: 34,
      value: 'unicode \u1234\u5678\u90AB\uCDEF'
    });

  });

  it('lex reports useful string errors', () => {

    expect(
      () => lexOne('"')
    ).to.throw('Syntax Error GraphQL request (1:2) Unterminated string.');

    expect(
      () => lexOne('"no end quote')
    ).to.throw('Syntax Error GraphQL request (1:14) Unterminated string.');

    expect(
      () => lexOne('\'single quotes\'')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) Unexpected single quote character (\'), ' +
      'did you mean to use a double quote (")?'
    );

    expect(
      () => lexOne('"contains unescaped \u0007 control char"')
    ).to.throw(
      'Syntax Error GraphQL request (1:21) Invalid character within String: "\\u0007".'
    );

    expect(
      () => lexOne('"null-byte is not \u0000 end of file"')
    ).to.throw(
      'Syntax Error GraphQL request (1:19) Invalid character within String: "\\u0000".'
    );

    expect(
      () => lexOne('"multi\nline"')
    ).to.throw('Syntax Error GraphQL request (1:7) Unterminated string');

    expect(
      () => lexOne('"multi\rline"')
    ).to.throw('Syntax Error GraphQL request (1:7) Unterminated string');

    expect(
      () => lexOne('"bad \\z esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\z.'
    );

    expect(
      () => lexOne('"bad \\x esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\x.'
    );

    expect(
      () => lexOne('"bad \\u1 esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\u1 es.'
    );

    expect(
      () => lexOne('"bad \\u0XX1 esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\u0XX1.'
    );

    expect(
      () => lexOne('"bad \\uXXXX esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\uXXXX.'
    );

    expect(
      () => lexOne('"bad \\uFXXX esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\uFXXX.'
    );

    expect(
      () => lexOne('"bad \\uXXXF esc"')
    ).to.throw(
      'Syntax Error GraphQL request (1:7) Invalid character escape sequence: \\uXXXF.'
    );
  });

  it('lexes numbers', () => {

    expect(
      lexOne('4')
    ).to.containSubset({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '4'
    });

    expect(
      lexOne('4.123')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '4.123'
    });

    expect(
      lexOne('-4')
    ).to.containSubset({
      kind: TokenKind.INT,
      start: 0,
      end: 2,
      value: '-4'
    });

    expect(
      lexOne('9')
    ).to.containSubset({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '9'
    });

    expect(
      lexOne('0')
    ).to.containSubset({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '0'
    });

    expect(
      lexOne('-4.123')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '-4.123'
    });

    expect(
      lexOne('0.123')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '0.123'
    });

    expect(
      lexOne('123e4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123e4'
    });

    expect(
      lexOne('123E4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123E4'
    });

    expect(
      lexOne('123e-4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e-4'
    });

    expect(
      lexOne('123e+4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e+4'
    });

    expect(
      lexOne('-1.123e4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123e4'
    });

    expect(
      lexOne('-1.123E4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123E4'
    });

    expect(
      lexOne('-1.123e-4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e-4'
    });

    expect(
      lexOne('-1.123e+4')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e+4'
    });

    expect(
      lexOne('-1.123e4567')
    ).to.containSubset({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 11,
      value: '-1.123e4567'
    });

  });

  it('lex reports useful number errors', () => {

    expect(
      () => lexOne('00')
    ).to.throw(
      'Syntax Error GraphQL request (1:2) Invalid number, ' +
      'unexpected digit after 0: "0".'
    );

    expect(
      () => lexOne('+1')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) Cannot parse the unexpected character "+".'
    );

    expect(
      () => lexOne('1.')
    ).to.throw(
      'Syntax Error GraphQL request (1:3) Invalid number, ' +
      'expected digit but got: <EOF>.'
    );

    expect(
      () => lexOne('.123')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) Cannot parse the unexpected character ".".'
    );

    expect(
      () => lexOne('1.A')
    ).to.throw(
      'Syntax Error GraphQL request (1:3) Invalid number, ' +
      'expected digit but got: "A".'
    );

    expect(
      () => lexOne('-A')
    ).to.throw(
      'Syntax Error GraphQL request (1:2) Invalid number, ' +
      'expected digit but got: "A".'
    );

    expect(
      () => lexOne('1.0e')
    ).to.throw(
      'Syntax Error GraphQL request (1:5) Invalid number, ' +
      'expected digit but got: <EOF>.');

    expect(
      () => lexOne('1.0eA')
    ).to.throw(
      'Syntax Error GraphQL request (1:5) Invalid number, ' +
      'expected digit but got: "A".'
    );
  });

  it('lexes punctuation', () => {

    expect(
      lexOne('!')
    ).to.containSubset({
      kind: TokenKind.BANG,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('$')
    ).to.containSubset({
      kind: TokenKind.DOLLAR,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('(')
    ).to.containSubset({
      kind: TokenKind.PAREN_L,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne(')')
    ).to.containSubset({
      kind: TokenKind.PAREN_R,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('...')
    ).to.containSubset({
      kind: TokenKind.SPREAD,
      start: 0,
      end: 3,
      value: undefined
    });

    expect(
      lexOne(':')
    ).to.containSubset({
      kind: TokenKind.COLON,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('=')
    ).to.containSubset({
      kind: TokenKind.EQUALS,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('@')
    ).to.containSubset({
      kind: TokenKind.AT,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('[')
    ).to.containSubset({
      kind: TokenKind.BRACKET_L,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne(']')
    ).to.containSubset({
      kind: TokenKind.BRACKET_R,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('{')
    ).to.containSubset({
      kind: TokenKind.BRACE_L,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('|')
    ).to.containSubset({
      kind: TokenKind.PIPE,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('}')
    ).to.containSubset({
      kind: TokenKind.BRACE_R,
      start: 0,
      end: 1,
      value: undefined
    });

  });

  it('lex reports useful unknown character error', () => {

    expect(
      () => lexOne('..')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) Cannot parse the unexpected character ".".'
    );

    expect(
      () => lexOne('?')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) Cannot parse the unexpected character "?".'
    );

    expect(
      () => lexOne('\u203B')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) ' +
      'Cannot parse the unexpected character "\\u203B".'
    );

    expect(
      () => lexOne('\u200b')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) ' +
      'Cannot parse the unexpected character "\\u200B".'
    );
  });

  it('lex reports useful information for dashes in names', () => {
    const q = 'a-b';
    const lexer = createLexer(new Source(q));
    const firstToken = lexer.advance();
    expect(firstToken).to.containSubset({
      kind: TokenKind.NAME,
      start: 0,
      end: 1,
      value: 'a'
    });
    expect(
      () => lexer.advance()
    ).to.throw(
      'Syntax Error GraphQL request (1:3) Invalid number, expected digit but got: "b".'
    );
  });

  it('produces double linked list of tokens, including comments', () => {
    const lexer = createLexer(new Source(`{
      #comment
      field
    }`));

    const startToken = lexer.token;
    let endToken;
    do {
      endToken = lexer.advance();
      // Lexer advances over ignored comment tokens to make writing parsers
      // easier, but will include them in the linked list result.
      expect(endToken.kind).not.to.equal('Comment');
    } while (endToken.kind !== '<EOF>');

    expect(startToken.prev).to.equal(null);
    expect(endToken.next).to.equal(null);

    const tokens = [];
    for (let tok = startToken; tok; tok = tok.next) {
      if (tokens.length) {
        // Tokens are double-linked, prev should point to last seen token.
        expect(tok.prev).to.equal(tokens[tokens.length - 1]);
      }
      tokens.push(tok);
    }

    expect(tokens.map(tok => tok.kind)).to.deep.equal([
      '<SOF>',
      '{',
      'Comment',
      'Name',
      '}',
      '<EOF>'
    ]);
  });
});
