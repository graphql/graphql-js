import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { inspectStr } from '../../__testUtils__/inspectStr';
import { genFuzzStrings } from '../../__testUtils__/genFuzzStrings';

import { invariant } from '../../jsutils/invariant';

import { Lexer } from '../lexer';
import { Source } from '../source';
import { printBlockString } from '../blockString';

function lexValue(str: string): string {
  const lexer = new Lexer(new Source(str));
  const value = lexer.advance().value;

  invariant(typeof value === 'string');
  invariant(lexer.advance().kind === '<EOF>', 'Expected EOF');
  return value;
}

function testPrintableBlockString(
  testValue: string,
  preferMultipleLines?: boolean,
): void {
  const blockString = printBlockString(testValue, preferMultipleLines);
  const printedValue = lexValue(blockString);
  invariant(
    testValue === printedValue,
    dedent`
      Expected lexValue(${inspectStr(blockString)})
         to equal ${inspectStr(testValue)}
         but got  ${inspectStr(printedValue)}
     `,
  );
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

      testPrintableBlockString(testValue);
      testPrintableBlockString(testValue, true);
      testPrintableBlockString(testValue, false);
    }
  }).timeout(20000);
});
