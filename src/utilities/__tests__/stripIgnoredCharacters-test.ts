import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { inspectStr } from '../../__testUtils__/inspectStr';
import { kitchenSinkQuery } from '../../__testUtils__/kitchenSinkQuery';
import { kitchenSinkSDL } from '../../__testUtils__/kitchenSinkSDL';

import { invariant } from '../../jsutils/invariant';
import type { Maybe } from '../../jsutils/Maybe';

import { Lexer } from '../../language/lexer';
import { parse } from '../../language/parser';
import { Source } from '../../language/source';

import { stripIgnoredCharacters } from '../stripIgnoredCharacters';

const ignoredTokens = [
  // UnicodeBOM ::
  '\uFEFF', // Byte Order Mark (U+FEFF)

  // WhiteSpace ::
  '\t', // Horizontal Tab (U+0009)
  ' ', //  Space (U+0020)

  // LineTerminator ::
  '\n', //   "New Line (U+000A)"
  '\r', //   "Carriage Return (U+000D)" [ lookahead ! "New Line (U+000A)" ]
  '\r\n', // "Carriage Return (U+000D)" "New Line (U+000A)"

  // Comment ::
  '# "Comment" string\n', // `#` CommentChar*

  // Comma ::
  ',', // ,
];

const punctuatorTokens = [
  '!',
  '$',
  '(',
  ')',
  '...',
  ':',
  '=',
  '@',
  '[',
  ']',
  '{',
  '|',
  '}',
];

const nonPunctuatorTokens = [
  'name_token', // Name
  '1', // IntValue
  '3.14', // FloatValue
  '"some string value"', // StringValue
  '"""block\nstring\nvalue"""', // StringValue(BlockString)
];

function lexValue(str: string): Maybe<string> {
  const lexer = new Lexer(new Source(str));
  const value = lexer.advance().value;

  invariant(lexer.advance().kind === '<EOF>', 'Expected EOF');
  return value;
}

function expectStripped(docString: string) {
  return {
    toEqual(expected: string): void {
      const stripped = stripIgnoredCharacters(docString);

      invariant(
        stripped === expected,
        dedent`
          Expected stripIgnoredCharacters(${inspectStr(docString)})
            to equal ${inspectStr(expected)}
            but got  ${inspectStr(stripped)}
        `,
      );

      const strippedTwice = stripIgnoredCharacters(stripped);

      invariant(
        stripped === strippedTwice,
        dedent`
          Expected stripIgnoredCharacters(${inspectStr(stripped)})
            to equal ${inspectStr(stripped)}
            but got  ${inspectStr(strippedTwice)}
        `,
      );
    },
    toStayTheSame(): void {
      this.toEqual(docString);
    },
  };
}

describe('stripIgnoredCharacters', () => {
  it('strips ignored characters from GraphQL query document', () => {
    const query = dedent`
      query SomeQuery($foo: String!, $bar: String) {
        someField(foo: $foo, bar: $bar) {
          a
          b {
            c
            d
          }
        }
      }
    `;

    expect(stripIgnoredCharacters(query)).to.equal(
      'query SomeQuery($foo:String!$bar:String){someField(foo:$foo bar:$bar){a b{c d}}}',
    );
  });

  it('accepts Source object', () => {
    expect(stripIgnoredCharacters(new Source('{ a }'))).to.equal('{a}');
  });

  it('strips ignored characters from GraphQL SDL document', () => {
    const sdl = dedent`
      """
      Type description
      """
      type Foo {
        """
        Field description
        """
        bar: String
      }
    `;

    expect(stripIgnoredCharacters(sdl)).to.equal(
      '"""Type description""" type Foo{"""Field description""" bar:String}',
    );
  });

  it('report document with invalid token', () => {
    let caughtError;

    try {
      stripIgnoredCharacters('{ foo(arg: "\n"');
    } catch (e) {
      caughtError = e;
    }

    expect(String(caughtError)).to.equal(dedent`
      Syntax Error: Unterminated string.

      GraphQL request:1:13
      1 | { foo(arg: "
        |             ^
      2 | "
    `);
  });

  it('strips non-parsable document', () => {
    expectStripped('{ foo(arg: "str"').toEqual('{foo(arg:"str"');
  });

  it('strips documents with only ignored characters', () => {
    expectStripped('\n').toEqual('');
    expectStripped(',').toEqual('');
    expectStripped(',,').toEqual('');
    expectStripped('#comment\n, \n').toEqual('');

    for (const ignored of ignoredTokens) {
      expectStripped(ignored).toEqual('');

      for (const anotherIgnored of ignoredTokens) {
        expectStripped(ignored + anotherIgnored).toEqual('');
      }
    }

    expectStripped(ignoredTokens.join('')).toEqual('');
  });

  it('strips leading and trailing ignored tokens', () => {
    expectStripped('\n1').toEqual('1');
    expectStripped(',1').toEqual('1');
    expectStripped(',,1').toEqual('1');
    expectStripped('#comment\n, \n1').toEqual('1');

    expectStripped('1\n').toEqual('1');
    expectStripped('1,').toEqual('1');
    expectStripped('1,,').toEqual('1');
    expectStripped('1#comment\n, \n').toEqual('1');

    for (const token of [...punctuatorTokens, ...nonPunctuatorTokens]) {
      for (const ignored of ignoredTokens) {
        expectStripped(ignored + token).toEqual(token);
        expectStripped(token + ignored).toEqual(token);

        for (const anotherIgnored of ignoredTokens) {
          expectStripped(token + ignored + ignored).toEqual(token);
          expectStripped(ignored + anotherIgnored + token).toEqual(token);
        }
      }

      expectStripped(ignoredTokens.join('') + token).toEqual(token);
      expectStripped(token + ignoredTokens.join('')).toEqual(token);
    }
  });

  it('strips ignored tokens between punctuator tokens', () => {
    expectStripped('[,)').toEqual('[)');
    expectStripped('[\r)').toEqual('[)');
    expectStripped('[\r\r)').toEqual('[)');
    expectStripped('[\r,)').toEqual('[)');
    expectStripped('[,\n)').toEqual('[)');

    for (const left of punctuatorTokens) {
      for (const right of punctuatorTokens) {
        for (const ignored of ignoredTokens) {
          expectStripped(left + ignored + right).toEqual(left + right);

          for (const anotherIgnored of ignoredTokens) {
            expectStripped(left + ignored + anotherIgnored + right).toEqual(
              left + right,
            );
          }
        }

        expectStripped(left + ignoredTokens.join('') + right).toEqual(
          left + right,
        );
      }
    }
  });

  it('strips ignored tokens between punctuator and non-punctuator tokens', () => {
    expectStripped('[,1').toEqual('[1');
    expectStripped('[\r1').toEqual('[1');
    expectStripped('[\r\r1').toEqual('[1');
    expectStripped('[\r,1').toEqual('[1');
    expectStripped('[,\n1').toEqual('[1');

    for (const nonPunctuator of nonPunctuatorTokens) {
      for (const punctuator of punctuatorTokens) {
        for (const ignored of ignoredTokens) {
          expectStripped(punctuator + ignored + nonPunctuator).toEqual(
            punctuator + nonPunctuator,
          );

          for (const anotherIgnored of ignoredTokens) {
            expectStripped(
              punctuator + ignored + anotherIgnored + nonPunctuator,
            ).toEqual(punctuator + nonPunctuator);
          }
        }

        expectStripped(
          punctuator + ignoredTokens.join('') + nonPunctuator,
        ).toEqual(punctuator + nonPunctuator);
      }
    }
  });

  it('strips ignored tokens between non-punctuator and punctuator tokens', () => {
    expectStripped('1,[').toEqual('1[');
    expectStripped('1\r[').toEqual('1[');
    expectStripped('1\r\r[').toEqual('1[');
    expectStripped('1\r,[').toEqual('1[');
    expectStripped('1,\n[').toEqual('1[');

    for (const nonPunctuator of nonPunctuatorTokens) {
      for (const punctuator of punctuatorTokens) {
        // Special case for that is handled in the below test
        if (punctuator === '...') {
          continue;
        }

        for (const ignored of ignoredTokens) {
          expectStripped(nonPunctuator + ignored + punctuator).toEqual(
            nonPunctuator + punctuator,
          );

          for (const anotherIgnored of ignoredTokens) {
            expectStripped(
              nonPunctuator + ignored + anotherIgnored + punctuator,
            ).toEqual(nonPunctuator + punctuator);
          }
        }

        expectStripped(
          nonPunctuator + ignoredTokens.join('') + punctuator,
        ).toEqual(nonPunctuator + punctuator);
      }
    }
  });

  it('replace ignored tokens between non-punctuator tokens and spread with space', () => {
    expectStripped('a ...').toEqual('a ...');
    expectStripped('1 ...').toEqual('1 ...');
    expectStripped('1 ... ...').toEqual('1 ......');

    for (const nonPunctuator of nonPunctuatorTokens) {
      for (const ignored of ignoredTokens) {
        expectStripped(nonPunctuator + ignored + '...').toEqual(
          nonPunctuator + ' ...',
        );

        for (const anotherIgnored of ignoredTokens) {
          expectStripped(
            nonPunctuator + ignored + anotherIgnored + ' ...',
          ).toEqual(nonPunctuator + ' ...');
        }
      }

      expectStripped(nonPunctuator + ignoredTokens.join('') + '...').toEqual(
        nonPunctuator + ' ...',
      );
    }
  });

  it('replace ignored tokens between non-punctuator tokens with space', () => {
    expectStripped('1 2').toStayTheSame();
    expectStripped('"" ""').toStayTheSame();
    expectStripped('a b').toStayTheSame();

    expectStripped('a,1').toEqual('a 1');
    expectStripped('a,,1').toEqual('a 1');
    expectStripped('a  1').toEqual('a 1');
    expectStripped('a \t 1').toEqual('a 1');

    for (const left of nonPunctuatorTokens) {
      for (const right of nonPunctuatorTokens) {
        for (const ignored of ignoredTokens) {
          expectStripped(left + ignored + right).toEqual(left + ' ' + right);

          for (const anotherIgnored of ignoredTokens) {
            expectStripped(left + ignored + anotherIgnored + right).toEqual(
              left + ' ' + right,
            );
          }
        }

        expectStripped(left + ignoredTokens.join('') + right).toEqual(
          left + ' ' + right,
        );
      }
    }
  });

  it('does not strip ignored tokens embedded in the string', () => {
    expectStripped('" "').toStayTheSame();
    expectStripped('","').toStayTheSame();
    expectStripped('",,"').toStayTheSame();
    expectStripped('",|"').toStayTheSame();

    for (const ignored of ignoredTokens) {
      expectStripped(JSON.stringify(ignored)).toStayTheSame();

      for (const anotherIgnored of ignoredTokens) {
        expectStripped(
          JSON.stringify(ignored + anotherIgnored),
        ).toStayTheSame();
      }
    }

    expectStripped(JSON.stringify(ignoredTokens.join(''))).toStayTheSame();
  });

  it('does not strip ignored tokens embedded in the block string', () => {
    expectStripped('""","""').toStayTheSame();
    expectStripped('""",,"""').toStayTheSame();
    expectStripped('""",|"""').toStayTheSame();

    const ignoredTokensWithoutFormatting = ignoredTokens.filter(
      (token) => !['\n', '\r', '\r\n', '\t', ' '].includes(token),
    );
    for (const ignored of ignoredTokensWithoutFormatting) {
      expectStripped('"""|' + ignored + '|"""').toStayTheSame();

      for (const anotherIgnored of ignoredTokensWithoutFormatting) {
        expectStripped(
          '"""|' + ignored + anotherIgnored + '|"""',
        ).toStayTheSame();
      }
    }

    expectStripped(
      '"""|' + ignoredTokensWithoutFormatting.join('') + '|"""',
    ).toStayTheSame();
  });

  it('strips ignored characters inside block strings', () => {
    function expectStrippedString(blockStr: string) {
      const originalValue = lexValue(blockStr);
      const strippedValue = lexValue(stripIgnoredCharacters(blockStr));

      invariant(
        originalValue === strippedValue,
        dedent`
          Expected lexValue(stripIgnoredCharacters(${inspectStr(blockStr)}))
            to equal ${inspectStr(originalValue)}
            but got  ${inspectStr(strippedValue)}
        `,
      );
      return expectStripped(blockStr);
    }

    expectStrippedString('""""""').toStayTheSame();
    expectStrippedString('""" """').toEqual('""""""');

    expectStrippedString('"""a"""').toStayTheSame();
    expectStrippedString('""" a"""').toEqual('""" a"""');
    expectStrippedString('""" a """').toEqual('""" a """');

    expectStrippedString('"""\n"""').toEqual('""""""');
    expectStrippedString('"""a\nb"""').toEqual('"""a\nb"""');
    expectStrippedString('"""a\rb"""').toEqual('"""a\nb"""');
    expectStrippedString('"""a\r\nb"""').toEqual('"""a\nb"""');
    expectStrippedString('"""a\r\n\nb"""').toEqual('"""a\n\nb"""');

    expectStrippedString('"""\\\n"""').toStayTheSame();
    expectStrippedString('""""\n"""').toStayTheSame();
    expectStrippedString('"""\\"""\n"""').toEqual('"""\\""""""');

    expectStrippedString('"""\na\n b"""').toStayTheSame();
    expectStrippedString('"""\n a\n b"""').toEqual('"""a\nb"""');
    expectStrippedString('"""\na\n b\nc"""').toEqual('"""a\n b\nc"""');
  });

  it('strips kitchen sink query but maintains the exact same AST', () => {
    const strippedQuery = stripIgnoredCharacters(kitchenSinkQuery);
    expect(stripIgnoredCharacters(strippedQuery)).to.equal(strippedQuery);

    const queryAST = parse(kitchenSinkQuery, { noLocation: true });
    const strippedAST = parse(strippedQuery, { noLocation: true });
    expect(strippedAST).to.deep.equal(queryAST);
  });

  it('strips kitchen sink SDL but maintains the exact same AST', () => {
    const strippedSDL = stripIgnoredCharacters(kitchenSinkSDL);
    expect(stripIgnoredCharacters(strippedSDL)).to.equal(strippedSDL);

    const sdlAST = parse(kitchenSinkSDL, { noLocation: true });
    const strippedAST = parse(strippedSDL, { noLocation: true });
    expect(strippedAST).to.deep.equal(sdlAST);
  });
});
