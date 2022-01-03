import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { genFuzzStrings } from '../../__testUtils__/genFuzzStrings';
import { inspectStr } from '../../__testUtils__/inspectStr';

import { invariant } from '../../jsutils/invariant';

import { isPrintableAsBlockString, printBlockString } from '../blockString';
import { Lexer } from '../lexer';
import { Source } from '../source';

function lexValue(str: string): string {
  const lexer = new Lexer(new Source(str));
  const value = lexer.advance().value;

  invariant(typeof value === 'string');
  invariant(lexer.advance().kind === '<EOF>', 'Expected EOF');
  return value;
}

function testPrintableBlockString(
  testValue: string,
  options?: { minimize: boolean },
): void {
  const blockString = printBlockString(testValue, options);
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

function testNonPrintableBlockString(testValue: string): void {
  const blockString = printBlockString(testValue);
  const printedValue = lexValue(blockString);
  invariant(
    testValue !== printedValue,
    dedent`
      Expected lexValue(${inspectStr(blockString)})
        to not equal ${inspectStr(testValue)}
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
      if (!isPrintableAsBlockString(fuzzStr)) {
        testNonPrintableBlockString(fuzzStr);
        continue;
      }

      testPrintableBlockString(fuzzStr);
      testPrintableBlockString(fuzzStr, { minimize: true });
    }
  }).timeout(20000);
});
