import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';
import inspectStr from '../../__testUtils__/inspectStr';
import genFuzzStrings from '../../__testUtils__/genFuzzStrings';

import invariant from '../../jsutils/invariant';

import { Lexer } from '../lexer';
import { Source } from '../source';
import { printBlockString } from '../blockString';

function lexValue(str: string) {
  const lexer = new Lexer(new Source(str));
  const value = lexer.advance().value;

  invariant(lexer.advance().kind === '<EOF>', 'Expected EOF');
  return value;
}

describe('printBlockString', () => {
  it('correctly print random strings', () => {
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
      invariant(typeof testValue === 'string');

      const printedValue = lexValue(printBlockString(testValue));

      invariant(
        testValue === printedValue,
        dedent`
          Expected lexValue(printBlockString(${inspectStr(testValue)}))
            to equal ${inspectStr(testValue)}
            but got  ${inspectStr(printedValue)}
        `,
      );

      const printedMultilineString = lexValue(
        printBlockString(testValue, ' ', true),
      );

      invariant(
        testValue === printedMultilineString,
        dedent`
          Expected lexValue(printBlockString(${inspectStr(
            testValue,
          )}, ' ', true))
            to equal ${inspectStr(testValue)}
            but got  ${inspectStr(printedMultilineString)}
        `,
      );
    }
  }).timeout(20000);
});
