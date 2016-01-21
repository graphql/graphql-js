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
import { lex, TokenKind } from '../lexer';

function lexOne(str) {
  return lex(new Source(str))();
}

function lexErr(str) {
  return lex(new Source(str));
}

describe('Lexer', () => {

  it('disallows uncommon control characters', () => {

    expect(lexErr('\u0007')
    ).to.throw(
      'Syntax Error GraphQL (1:1) Invalid character "\\u0007"'
    );

  });

  it('accepts BOM header', () => {
    expect(lexOne('\uFEFF foo')
    ).to.deep.equal({
      kind: TokenKind.NAME,
      start: 2,
      end: 5,
      value: 'foo'
    });
  });

  it('skips whitespace', () => {

    expect(lexOne(`

    foo


`)
    ).to.deep.equal({
      kind: TokenKind.NAME,
      start: 6,
      end: 9,
      value: 'foo'
    });

    expect(lexOne(`
    #comment
    foo#comment
`)
    ).to.deep.equal({
      kind: TokenKind.NAME,
      start: 18,
      end: 21,
      value: 'foo'
    });

    expect(lexOne(`,,,foo,,,`)).to.deep.equal({
      kind: TokenKind.NAME,
      start: 3,
      end: 6,
      value: 'foo'
    });

  });

  it('errors respect whitespace', () => {

    expect(lexErr(`

    ?


`)
    ).to.throw(
      'Syntax Error GraphQL (3:5) Unexpected character "?".\n' +
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
    ).to.deep.equal({
      kind: TokenKind.STRING,
      start: 0,
      end: 8,
      value: 'simple'
    });

    expect(
      lexOne('" white space "')
    ).to.deep.equal({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: ' white space '
    });

    expect(
      lexOne('"quote \\""')
    ).to.deep.equal({
      kind: TokenKind.STRING,
      start: 0,
      end: 10,
      value: 'quote "'
    });

    expect(
      lexOne('"escaped \\n\\r\\b\\t\\f"')
    ).to.deep.equal({
      kind: TokenKind.STRING,
      start: 0,
      end: 20,
      value: 'escaped \n\r\b\t\f'
    });

    expect(
      lexOne('"slashes \\\\ \\/"')
    ).to.deep.equal({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: 'slashes \\ \/'
    });

    expect(
      lexOne('"unicode \\u1234\\u5678\\u90AB\\uCDEF"')
    ).to.deep.equal({
      kind: TokenKind.STRING,
      start: 0,
      end: 34,
      value: 'unicode \u1234\u5678\u90AB\uCDEF'
    });

  });

  it('lex reports useful string errors', () => {

    expect(
      lexErr('"')
    ).to.throw('Syntax Error GraphQL (1:2) Unterminated string');

    expect(
      lexErr('"no end quote')
    ).to.throw('Syntax Error GraphQL (1:14) Unterminated string');

    expect(
      lexErr('"contains unescaped \u0007 control char"')
    ).to.throw(
      'Syntax Error GraphQL (1:21) Invalid character within String: "\\u0007".'
    );

    expect(
      lexErr('"null-byte is not \u0000 end of file"')
    ).to.throw(
      'Syntax Error GraphQL (1:19) Invalid character within String: "\\u0000".'
    );

    expect(
      lexErr('"multi\nline"')
    ).to.throw('Syntax Error GraphQL (1:7) Unterminated string');

    expect(
      lexErr('"multi\rline"')
    ).to.throw('Syntax Error GraphQL (1:7) Unterminated string');

    expect(
      lexErr('"bad \\z esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\z.'
    );

    expect(
      lexErr('"bad \\x esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\x.'
    );

    expect(
      lexErr('"bad \\u1 esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\u1 es.'
    );

    expect(
      lexErr('"bad \\u0XX1 esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\u0XX1.'
    );

    expect(
      lexErr('"bad \\uXXXX esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\uXXXX.'
    );

    expect(
      lexErr('"bad \\uFXXX esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\uFXXX.'
    );

    expect(
      lexErr('"bad \\uXXXF esc"')
    ).to.throw(
      'Syntax Error GraphQL (1:7) Invalid character escape sequence: \\uXXXF.'
    );
  });

  it('lexes numbers', () => {

    expect(
      lexOne('4')
    ).to.deep.equal({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '4'
    });

    expect(
      lexOne('4.123')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '4.123'
    });

    expect(
      lexOne('-4')
    ).to.deep.equal({
      kind: TokenKind.INT,
      start: 0,
      end: 2,
      value: '-4'
    });

    expect(
      lexOne('9')
    ).to.deep.equal({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '9'
    });

    expect(
      lexOne('0')
    ).to.deep.equal({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '0'
    });

    expect(
      lexOne('-4.123')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '-4.123'
    });

    expect(
      lexOne('0.123')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '0.123'
    });

    expect(
      lexOne('123e4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123e4'
    });

    expect(
      lexOne('123E4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123E4'
    });

    expect(
      lexOne('123e-4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e-4'
    });

    expect(
      lexOne('123e+4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e+4'
    });

    expect(
      lexOne('-1.123e4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123e4'
    });

    expect(
      lexOne('-1.123E4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123E4'
    });

    expect(
      lexOne('-1.123e-4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e-4'
    });

    expect(
      lexOne('-1.123e+4')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e+4'
    });

    expect(
      lexOne('-1.123e4567')
    ).to.deep.equal({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 11,
      value: '-1.123e4567'
    });

  });

  it('lex reports useful number errors', () => {

    expect(
      lexErr('00')
    ).to.throw(
      'Syntax Error GraphQL (1:2) Invalid number, ' +
      'unexpected digit after 0: "0".'
    );

    expect(
      lexErr('+1')
    ).to.throw('Syntax Error GraphQL (1:1) Unexpected character "+"');

    expect(
      lexErr('1.')
    ).to.throw(
      'Syntax Error GraphQL (1:3) Invalid number, ' +
      'expected digit but got: <EOF>.'
    );

    expect(
      lexErr('.123')
    ).to.throw('Syntax Error GraphQL (1:1) Unexpected character "."');

    expect(
      lexErr('1.A')
    ).to.throw(
      'Syntax Error GraphQL (1:3) Invalid number, ' +
      'expected digit but got: "A".'
    );

    expect(
      lexErr('-A')
    ).to.throw(
      'Syntax Error GraphQL (1:2) Invalid number, ' +
      'expected digit but got: "A".'
    );

    expect(
      lexErr('1.0e')
    ).to.throw(
      'Syntax Error GraphQL (1:5) Invalid number, ' +
      'expected digit but got: <EOF>.');

    expect(
      lexErr('1.0eA')
    ).to.throw(
      'Syntax Error GraphQL (1:5) Invalid number, ' +
      'expected digit but got: "A".'
    );
  });

  it('lexes punctuation', () => {

    expect(
      lexOne('!')
    ).to.deep.equal({
      kind: TokenKind.BANG,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('$')
    ).to.deep.equal({
      kind: TokenKind.DOLLAR,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('(')
    ).to.deep.equal({
      kind: TokenKind.PAREN_L,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne(')')
    ).to.deep.equal({
      kind: TokenKind.PAREN_R,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('...')
    ).to.deep.equal({
      kind: TokenKind.SPREAD,
      start: 0,
      end: 3,
      value: undefined
    });

    expect(
      lexOne(':')
    ).to.deep.equal({
      kind: TokenKind.COLON,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('=')
    ).to.deep.equal({
      kind: TokenKind.EQUALS,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('@')
    ).to.deep.equal({
      kind: TokenKind.AT,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('[')
    ).to.deep.equal({
      kind: TokenKind.BRACKET_L,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne(']')
    ).to.deep.equal({
      kind: TokenKind.BRACKET_R,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('{')
    ).to.deep.equal({
      kind: TokenKind.BRACE_L,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('|')
    ).to.deep.equal({
      kind: TokenKind.PIPE,
      start: 0,
      end: 1,
      value: undefined
    });

    expect(
      lexOne('}')
    ).to.deep.equal({
      kind: TokenKind.BRACE_R,
      start: 0,
      end: 1,
      value: undefined
    });

  });

  it('lex reports useful unknown character error', () => {

    expect(
      lexErr('..')
    ).to.throw('Syntax Error GraphQL (1:1) Unexpected character "."');

    expect(
      lexErr('?')
    ).to.throw('Syntax Error GraphQL (1:1) Unexpected character "?"');

    expect(
      lexErr('\u203B')
    ).to.throw('Syntax Error GraphQL (1:1) Unexpected character "\\u203B"');

    expect(
      lexErr('\u200b')
    ).to.throw('Syntax Error GraphQL (1:1) Unexpected character "\\u200B"');
  });

  it('lex reports useful information for dashes in names', () => {
    const q = 'a-b';
    const lexer = lex(new Source(q));
    const firstToken = lexer();
    expect(firstToken).to.deep.equal({
      kind: TokenKind.NAME,
      start: 0,
      end: 1,
      value: 'a'
    });
    expect(
      () => lexer()
    ).to.throw(
      'Syntax Error GraphQL (1:3) Invalid number, expected digit but got: "b".'
    );
  });
});
