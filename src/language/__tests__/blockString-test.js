/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { dedentBlockStringValue, printBlockString } from '../blockString';

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
