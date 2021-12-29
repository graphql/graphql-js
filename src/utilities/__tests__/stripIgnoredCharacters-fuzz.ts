import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { genFuzzStrings } from '../../__testUtils__/genFuzzStrings';
import { inspectStr } from '../../__testUtils__/inspectStr';

import { invariant } from '../../jsutils/invariant';

import { Lexer } from '../../language/lexer';
import { Source } from '../../language/source';

import { stripIgnoredCharacters } from '../stripIgnoredCharacters';

function lexValue(str: string) {
  const lexer = new Lexer(new Source(str));
  const value = lexer.advance().value;

  invariant(lexer.advance().kind === '<EOF>', 'Expected EOF');
  return value;
}

describe('stripIgnoredCharacters', () => {
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
      } catch (e) {
        continue; // skip invalid values
      }

      const strippedValue = lexValue(stripIgnoredCharacters(testStr));

      invariant(
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
