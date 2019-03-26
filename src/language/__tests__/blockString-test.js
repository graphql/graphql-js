/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
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
});
