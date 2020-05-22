// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';
import inspectStr from '../../__testUtils__/inspectStr';
import genFuzzStrings from '../../__testUtils__/genFuzzStrings';

import invariant from '../../jsutils/invariant';

import { Lexer } from '../lexer';
import { Source } from '../source';
import {
  dedentBlockStringValue,
  getBlockStringIndentation,
  printBlockString,
} from '../blockString';

function joinLines(...args) {
  return args.join('\n');
}

describe('dedentBlockStringValue', () => {
  it('removes uniform indentation from a string', () => {
    const rawValue = joinLines(
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    );
    expect(dedentBlockStringValue(rawValue)).to.equal(
      joinLines('Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('removes empty leading and trailing lines', () => {
    const rawValue = joinLines(
      '',
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '',
      '',
    );
    expect(dedentBlockStringValue(rawValue)).to.equal(
      joinLines('Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('removes blank leading and trailing lines', () => {
    const rawValue = joinLines(
      '  ',
      '        ',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '        ',
      '  ',
    );
    expect(dedentBlockStringValue(rawValue)).to.equal(
      joinLines('Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('retains indentation from first line', () => {
    const rawValue = joinLines(
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    );
    expect(dedentBlockStringValue(rawValue)).to.equal(
      joinLines('    Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('does not alter trailing spaces', () => {
    const rawValue = joinLines(
      '               ',
      '    Hello,     ',
      '      World!   ',
      '               ',
      '    Yours,     ',
      '      GraphQL. ',
      '               ',
    );
    expect(dedentBlockStringValue(rawValue)).to.equal(
      joinLines(
        'Hello,     ',
        '  World!   ',
        '           ',
        'Yours,     ',
        '  GraphQL. ',
      ),
    );
  });
});

describe('getBlockStringIndentation', () => {
  it('returns zero for an empty array', () => {
    expect(getBlockStringIndentation([])).to.equal(0);
  });

  it('do not take first line into account', () => {
    expect(getBlockStringIndentation(['  a'])).to.equal(0);
    expect(getBlockStringIndentation([' a', '  b'])).to.equal(2);
  });

  it('returns minimal indentation length', () => {
    expect(getBlockStringIndentation(['', ' a', '  b'])).to.equal(1);
    expect(getBlockStringIndentation(['', '  a', ' b'])).to.equal(1);
    expect(getBlockStringIndentation(['', '  a', ' b', 'c'])).to.equal(0);
  });

  it('count both tab and space as single character', () => {
    expect(getBlockStringIndentation(['', '\ta', '          b'])).to.equal(1);
    expect(getBlockStringIndentation(['', '\t a', '          b'])).to.equal(2);
    expect(getBlockStringIndentation(['', ' \t a', '          b'])).to.equal(3);
  });

  it('do not take empty lines into account', () => {
    expect(getBlockStringIndentation(['a', '\t'])).to.equal(0);
    expect(getBlockStringIndentation(['a', ' '])).to.equal(0);
    expect(getBlockStringIndentation(['a', ' ', '  b'])).to.equal(2);
    expect(getBlockStringIndentation(['a', ' ', '  b'])).to.equal(2);
    expect(getBlockStringIndentation(['a', '', ' b'])).to.equal(1);
  });
});

describe('printBlockString', () => {
  it('by default print block strings as single line', () => {
    const str = 'one liner';
    expect(printBlockString(str)).to.equal('"""one liner"""');
    expect(printBlockString(str, '', true)).to.equal('"""\none liner\n"""');
  });

  it('correctly prints single-line with leading space', () => {
    const str = '    space-led string';
    expect(printBlockString(str)).to.equal('"""    space-led string"""');
    expect(printBlockString(str, '', true)).to.equal(
      '"""    space-led string\n"""',
    );
  });

  it('correctly prints single-line with leading space and quotation', () => {
    const str = '    space-led value "quoted string"';

    expect(printBlockString(str)).to.equal(
      '"""    space-led value "quoted string"\n"""',
    );

    expect(printBlockString(str, '', true)).to.equal(
      '"""    space-led value "quoted string"\n"""',
    );
  });

  it('correctly prints single-line with trailing backslash', () => {
    const str = 'backslash \\';

    expect(printBlockString(str)).to.equal('"""\nbackslash \\\n"""');
    expect(printBlockString(str, '', true)).to.equal('"""\nbackslash \\\n"""');
  });

  it('correctly prints string with a first line indentation', () => {
    const str = joinLines(
      '    first  ',
      '  line     ',
      'indentation',
      '     string',
    );

    expect(printBlockString(str)).to.equal(
      joinLines(
        '"""',
        '    first  ',
        '  line     ',
        'indentation',
        '     string',
        '"""',
      ),
    );
  });

  it('correctly print random strings', () => {
    // Testing with length >5 is taking exponentially more time. However it is
    // highly recommended to test with increased limit if you make any change.
    for (const fuzzStr of genFuzzStrings({
      allowedChars: ['\n', '\t', ' ', '"', 'a', '\\'],
      maxLength: 5,
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

    function lexValue(str) {
      const lexer = new Lexer(new Source(str));
      const value = lexer.advance().value;

      invariant(lexer.advance().kind === '<EOF>', 'Expected EOF');
      return value;
    }
  });
});
