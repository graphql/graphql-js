/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { inspect as nodeInspect } from 'util';

import { expect } from 'chai';
import { describe, it } from 'mocha';
import dedent from '../../jsutils/dedent';
import inspect from '../../jsutils/inspect';
import { GraphQLError } from '../../error';
import { Source } from '../source';
import { createLexer, TokenKind, isPunctuatorToken } from '../lexer';

function lexOne(str) {
  const lexer = createLexer(new Source(str));
  return lexer.advance();
}

function lexSecond(str) {
  const lexer = createLexer(new Source(str));
  lexer.advance();
  return lexer.advance();
}

function expectSyntaxError(text, message, location) {
  expect(() => lexOne(text))
    .to.throw('Syntax Error: ' + message)
    .with.deep.property('locations', [location]);
}

describe('Lexer', () => {
  it('disallows uncommon control characters', () => {
    expectSyntaxError(
      '\u0007',
      'Cannot contain the invalid character "\\u0007".',
      { line: 1, column: 1 },
    );
  });

  it('accepts BOM header', () => {
    expect(lexOne('\uFEFF foo')).to.contain({
      kind: TokenKind.NAME,
      start: 2,
      end: 5,
      value: 'foo',
    });
  });

  it('records line and column', () => {
    expect(lexOne('\n \r\n \r  foo\n')).to.contain({
      kind: TokenKind.NAME,
      start: 8,
      end: 11,
      line: 4,
      column: 3,
      value: 'foo',
    });
  });

  it('can be JSON.stringified, util.inspected or jsutils.inspect', () => {
    const token = lexOne('foo');
    expect(JSON.stringify(token)).to.equal(
      '{"kind":"Name","value":"foo","line":1,"column":1}',
    );
    expect(nodeInspect(token)).to.equal(
      "{ kind: 'Name', value: 'foo', line: 1, column: 1 }",
    );
    expect(inspect(token)).to.equal(
      '{ kind: "Name", value: "foo", line: 1, column: 1 }',
    );
  });

  it('skips whitespace and comments', () => {
    expect(
      lexOne(`

    foo


`),
    ).to.contain({
      kind: TokenKind.NAME,
      start: 6,
      end: 9,
      value: 'foo',
    });

    expect(
      lexOne(`
    #comment
    foo#comment
`),
    ).to.contain({
      kind: TokenKind.NAME,
      start: 18,
      end: 21,
      value: 'foo',
    });

    expect(lexOne(',,,foo,,,')).to.contain({
      kind: TokenKind.NAME,
      start: 3,
      end: 6,
      value: 'foo',
    });
  });

  it('errors respect whitespace', () => {
    let caughtError;
    try {
      lexOne(dedent`
      
      
          ?
      
      
      `);
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).to.equal(dedent`
      Syntax Error: Cannot parse the unexpected character "?".

      GraphQL request (3:5)
      2: 
      3:     ?
             ^
      4: 
    `);
  });

  it('updates line numbers in error for file context', () => {
    let caughtError;
    try {
      const str = ['', '', '     ?', ''].join('\n');
      const source = new Source(str, 'foo.js', { line: 11, column: 12 });
      createLexer(source).advance();
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).to.equal(dedent`
      Syntax Error: Cannot parse the unexpected character "?".

      foo.js (13:6)
      12: 
      13:      ?
               ^
      14: 
    `);
  });

  it('updates column numbers in error for file context', () => {
    let caughtError;
    try {
      const source = new Source('?', 'foo.js', { line: 1, column: 5 });
      createLexer(source).advance();
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).to.equal(dedent`
      Syntax Error: Cannot parse the unexpected character "?".

      foo.js (1:5)
      1:     ?
             ^
    `);
  });

  it('lexes strings', () => {
    expect(lexOne('"simple"')).to.contain({
      kind: TokenKind.STRING,
      start: 0,
      end: 8,
      value: 'simple',
    });

    expect(lexOne('" white space "')).to.contain({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: ' white space ',
    });

    expect(lexOne('"quote \\""')).to.contain({
      kind: TokenKind.STRING,
      start: 0,
      end: 10,
      value: 'quote "',
    });

    expect(lexOne('"escaped \\n\\r\\b\\t\\f"')).to.contain({
      kind: TokenKind.STRING,
      start: 0,
      end: 20,
      value: 'escaped \n\r\b\t\f',
    });

    expect(lexOne('"slashes \\\\ \\/"')).to.contain({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: 'slashes \\ /',
    });

    expect(lexOne('"unicode \\u1234\\u5678\\u90AB\\uCDEF"')).to.contain({
      kind: TokenKind.STRING,
      start: 0,
      end: 34,
      value: 'unicode \u1234\u5678\u90AB\uCDEF',
    });
  });

  it('lex reports useful string errors', () => {
    expectSyntaxError('"', 'Unterminated string.', { line: 1, column: 2 });

    expectSyntaxError('"no end quote', 'Unterminated string.', {
      line: 1,
      column: 14,
    });

    expectSyntaxError(
      "'single quotes'",
      "Unexpected single quote character ('), " +
        'did you mean to use a double quote (")?',
      { line: 1, column: 1 },
    );

    expectSyntaxError(
      '"contains unescaped \u0007 control char"',
      'Invalid character within String: "\\u0007".',
      { line: 1, column: 21 },
    );

    expectSyntaxError(
      '"null-byte is not \u0000 end of file"',
      'Invalid character within String: "\\u0000".',
      { line: 1, column: 19 },
    );

    expectSyntaxError('"multi\nline"', 'Unterminated string.', {
      line: 1,
      column: 7,
    });

    expectSyntaxError('"multi\rline"', 'Unterminated string.', {
      line: 1,
      column: 7,
    });

    expectSyntaxError(
      '"bad \\z esc"',
      'Invalid character escape sequence: \\z.',
      { line: 1, column: 7 },
    );

    expectSyntaxError(
      '"bad \\x esc"',
      'Invalid character escape sequence: \\x.',
      { line: 1, column: 7 },
    );

    expectSyntaxError(
      '"bad \\u1 esc"',
      'Invalid character escape sequence: \\u1 es.',
      { line: 1, column: 7 },
    );

    expectSyntaxError(
      '"bad \\u0XX1 esc"',
      'Invalid character escape sequence: \\u0XX1.',
      { line: 1, column: 7 },
    );

    expectSyntaxError(
      '"bad \\uXXXX esc"',
      'Invalid character escape sequence: \\uXXXX.',
      { line: 1, column: 7 },
    );

    expectSyntaxError(
      '"bad \\uFXXX esc"',
      'Invalid character escape sequence: \\uFXXX.',
      { line: 1, column: 7 },
    );

    expectSyntaxError(
      '"bad \\uXXXF esc"',
      'Invalid character escape sequence: \\uXXXF.',
      { line: 1, column: 7 },
    );
  });

  it('lexes block strings', () => {
    expect(lexOne('"""simple"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 12,
      value: 'simple',
    });

    expect(lexOne('""" white space """')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 19,
      value: ' white space ',
    });

    expect(lexOne('"""contains " quote"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 22,
      value: 'contains " quote',
    });

    expect(lexOne('"""contains \\""" triplequote"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 31,
      value: 'contains """ triplequote',
    });

    expect(lexOne('"""multi\nline"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 16,
      value: 'multi\nline',
    });

    expect(lexOne('"""multi\rline\r\nnormalized"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 28,
      value: 'multi\nline\nnormalized',
    });

    expect(lexOne('"""unescaped \\n\\r\\b\\t\\f\\u1234"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 32,
      value: 'unescaped \\n\\r\\b\\t\\f\\u1234',
    });

    expect(lexOne('"""slashes \\\\ \\/"""')).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 19,
      value: 'slashes \\\\ \\/',
    });

    expect(
      lexOne(`"""

        spans
          multiple
            lines

        """`),
    ).to.contain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 68,
      value: 'spans\n  multiple\n    lines',
    });
  });

  it('advance line after lexing multiline block string', () => {
    expect(
      lexSecond(`"""

        spans
          multiple
            lines

        \n """ second_token`),
    ).to.contain({
      kind: TokenKind.NAME,
      start: 71,
      end: 83,
      line: 8,
      column: 6,
      value: 'second_token',
    });

    expect(
      lexSecond(
        [
          '""" \n',
          'spans \r\n',
          'multiple \n\r',
          'lines \n\n',
          '"""\n second_token',
        ].join(''),
      ),
    ).to.contain({
      kind: TokenKind.NAME,
      start: 37,
      end: 49,
      line: 8,
      column: 2,
      value: 'second_token',
    });
  });

  it('lex reports useful block string errors', () => {
    expectSyntaxError('"""', 'Unterminated string.', { line: 1, column: 4 });

    expectSyntaxError('"""no end quote', 'Unterminated string.', {
      line: 1,
      column: 16,
    });

    expectSyntaxError(
      '"""contains unescaped \u0007 control char"""',
      'Invalid character within String: "\\u0007".',
      { line: 1, column: 23 },
    );

    expectSyntaxError(
      '"""null-byte is not \u0000 end of file"""',
      'Invalid character within String: "\\u0000".',
      { line: 1, column: 21 },
    );
  });

  it('lexes numbers', () => {
    expect(lexOne('4')).to.contain({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '4',
    });

    expect(lexOne('4.123')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '4.123',
    });

    expect(lexOne('-4')).to.contain({
      kind: TokenKind.INT,
      start: 0,
      end: 2,
      value: '-4',
    });

    expect(lexOne('9')).to.contain({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '9',
    });

    expect(lexOne('0')).to.contain({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '0',
    });

    expect(lexOne('-4.123')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '-4.123',
    });

    expect(lexOne('0.123')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '0.123',
    });

    expect(lexOne('123e4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123e4',
    });

    expect(lexOne('123E4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123E4',
    });

    expect(lexOne('123e-4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e-4',
    });

    expect(lexOne('123e+4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e+4',
    });

    expect(lexOne('-1.123e4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123e4',
    });

    expect(lexOne('-1.123E4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123E4',
    });

    expect(lexOne('-1.123e-4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e-4',
    });

    expect(lexOne('-1.123e+4')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e+4',
    });

    expect(lexOne('-1.123e4567')).to.contain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 11,
      value: '-1.123e4567',
    });
  });

  it('lex reports useful number errors', () => {
    expectSyntaxError('00', 'Invalid number, unexpected digit after 0: "0".', {
      line: 1,
      column: 2,
    });

    expectSyntaxError('+1', 'Cannot parse the unexpected character "+".', {
      line: 1,
      column: 1,
    });

    expectSyntaxError('1.', 'Invalid number, expected digit but got: <EOF>.', {
      line: 1,
      column: 3,
    });

    expectSyntaxError('1.e1', 'Invalid number, expected digit but got: "e".', {
      line: 1,
      column: 3,
    });

    expectSyntaxError('.123', 'Cannot parse the unexpected character ".".', {
      line: 1,
      column: 1,
    });

    expectSyntaxError('1.A', 'Invalid number, expected digit but got: "A".', {
      line: 1,
      column: 3,
    });

    expectSyntaxError('-A', 'Invalid number, expected digit but got: "A".', {
      line: 1,
      column: 2,
    });

    expectSyntaxError(
      '1.0e',
      'Invalid number, expected digit but got: <EOF>.',
      { line: 1, column: 5 },
    );

    expectSyntaxError('1.0eA', 'Invalid number, expected digit but got: "A".', {
      line: 1,
      column: 5,
    });
  });

  it('lexes punctuation', () => {
    expect(lexOne('!')).to.contain({
      kind: TokenKind.BANG,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('$')).to.contain({
      kind: TokenKind.DOLLAR,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('(')).to.contain({
      kind: TokenKind.PAREN_L,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne(')')).to.contain({
      kind: TokenKind.PAREN_R,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('...')).to.contain({
      kind: TokenKind.SPREAD,
      start: 0,
      end: 3,
      value: undefined,
    });

    expect(lexOne(':')).to.contain({
      kind: TokenKind.COLON,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('=')).to.contain({
      kind: TokenKind.EQUALS,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('@')).to.contain({
      kind: TokenKind.AT,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('[')).to.contain({
      kind: TokenKind.BRACKET_L,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne(']')).to.contain({
      kind: TokenKind.BRACKET_R,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('{')).to.contain({
      kind: TokenKind.BRACE_L,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('|')).to.contain({
      kind: TokenKind.PIPE,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('}')).to.contain({
      kind: TokenKind.BRACE_R,
      start: 0,
      end: 1,
      value: undefined,
    });
  });

  it('lex reports useful unknown character error', () => {
    expectSyntaxError('..', 'Cannot parse the unexpected character ".".', {
      line: 1,
      column: 1,
    });

    expectSyntaxError('?', 'Cannot parse the unexpected character "?".', {
      line: 1,
      column: 1,
    });

    expectSyntaxError(
      '\u203B',
      'Cannot parse the unexpected character "\\u203B".',
      { line: 1, column: 1 },
    );

    expectSyntaxError(
      '\u200b',
      'Cannot parse the unexpected character "\\u200B".',
      { line: 1, column: 1 },
    );
  });

  it('lex reports useful information for dashes in names', () => {
    const source = new Source('a-b');
    const lexer = createLexer(source);
    const firstToken = lexer.advance();
    expect(firstToken).to.contain({
      kind: TokenKind.NAME,
      start: 0,
      end: 1,
      value: 'a',
    });

    expect(() => lexer.advance())
      .throw(GraphQLError)
      .that.deep.include({
        message: 'Syntax Error: Invalid number, expected digit but got: "b".',
        locations: [{ line: 1, column: 3 }],
      });
  });

  it('produces double linked list of tokens, including comments', () => {
    const source = new Source(`
      {
        #comment
        field
      }
    `);

    const lexer = createLexer(source);
    const startToken = lexer.token;
    let endToken;
    do {
      endToken = lexer.advance();
      // Lexer advances over ignored comment tokens to make writing parsers
      // easier, but will include them in the linked list result.
      expect(endToken.kind).not.to.equal(TokenKind.COMMENT);
    } while (endToken.kind !== TokenKind.EOF);

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
      TokenKind.SOF,
      TokenKind.BRACE_L,
      TokenKind.COMMENT,
      TokenKind.NAME,
      TokenKind.BRACE_R,
      TokenKind.EOF,
    ]);
  });
});

describe('isPunctuatorToken', () => {
  it('returns true for punctuator tokens', () => {
    expect(isPunctuatorToken(lexOne('!'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('$'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('&'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('('))).to.equal(true);
    expect(isPunctuatorToken(lexOne(')'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('...'))).to.equal(true);
    expect(isPunctuatorToken(lexOne(':'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('='))).to.equal(true);
    expect(isPunctuatorToken(lexOne('@'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('['))).to.equal(true);
    expect(isPunctuatorToken(lexOne(']'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('{'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('|'))).to.equal(true);
    expect(isPunctuatorToken(lexOne('}'))).to.equal(true);
  });

  it('returns false for non-punctuator tokens', () => {
    expect(isPunctuatorToken(lexOne(''))).to.equal(false);
    expect(isPunctuatorToken(lexOne('name'))).to.equal(false);
    expect(isPunctuatorToken(lexOne('1'))).to.equal(false);
    expect(isPunctuatorToken(lexOne('3.14'))).to.equal(false);
    expect(isPunctuatorToken(lexOne('"str"'))).to.equal(false);
    expect(isPunctuatorToken(lexOne('"""str"""'))).to.equal(false);
  });
});
