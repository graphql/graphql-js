import { assert } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent.js';
import { genFuzzStrings } from '../../__testUtils__/genFuzzStrings.js';
import { inspectStr } from '../../__testUtils__/inspectStr.js';

import { Lexer } from '../../language/lexer.js';
import { Source } from '../../language/source.js';

import { stripIgnoredCharacters } from '../stripIgnoredCharacters.js';

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

function lexValue(str: string) {
  const lexer = new Lexer(new Source(str));
  const value = lexer.advance().value;

  assert(lexer.advance().kind === '<EOF>', 'Expected EOF');
  return value;
}

function expectStripped(docString: string) {
  return {
    toEqual(expected: string): void {
      const stripped = stripIgnoredCharacters(docString);

      assert(
        stripped === expected,
        dedent`
          Expected stripIgnoredCharacters(${inspectStr(docString)})
            to equal ${inspectStr(expected)}
            but got  ${inspectStr(stripped)}
        `,
      );

      const strippedTwice = stripIgnoredCharacters(stripped);

      assert(
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
  it('strips documents with random combination of ignored characters', () => {
    for (const ignored of ignoredTokens) {
      expectStripped(ignored).toEqual('');

      for (const anotherIgnored of ignoredTokens) {
        expectStripped(ignored + anotherIgnored).toEqual('');
      }
    }
    expectStripped(ignoredTokens.join('')).toEqual('');
  });

  it('strips random leading and trailing ignored tokens', () => {
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

  it('strips random ignored tokens between punctuator tokens', () => {
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

  it('strips random ignored tokens between punctuator and non-punctuator tokens', () => {
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

  it('strips random ignored tokens between non-punctuator and punctuator tokens', () => {
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

  it('replace random ignored tokens between non-punctuator tokens and spread with space', () => {
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

  it('replace random ignored tokens between non-punctuator tokens with space', () => {
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

  it('does not strip random ignored tokens embedded in the string', () => {
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

  it('does not strip random ignored tokens embedded in the block string', () => {
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

  it('strips ignored characters inside random block strings', () => {
    // Testing with length >7 is taking exponentially more time. However it is
    // highly recommended to test with increased limit if you make any change.
    for (const fuzzStr of genFuzzStrings({
      allowedChars: ['\n', '\t', ' ', '"', 'a', '\\'],
      maxLength: 7,
    })) {
      const testStr = '"""' + fuzzStr + '"""';

      let testValue;
      try {
        testValue = lexValue(testStr);
      } catch (_e) {
        continue; // skip invalid values
      }

      const strippedValue = lexValue(stripIgnoredCharacters(testStr));

      assert(
        testValue === strippedValue,
        dedent`
          Expected lexValue(stripIgnoredCharacters(${inspectStr(testStr)}))
            to equal ${inspectStr(testValue)}
            but got  ${inspectStr(strippedValue)}
        `,
      );
    }
  }).timeout(20000);
});
