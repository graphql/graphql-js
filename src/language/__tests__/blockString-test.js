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
import { dedentBlockStringValue } from '../blockString';

describe('dedentBlockStringValue', () => {
  it('removes uniform indentation from a string', () => {
    const rawValue = [
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    ].join('\n');
    expect(dedentBlockStringValue(rawValue)).to.equal(
      ['Hello,', '  World!', '', 'Yours,', '  GraphQL.'].join('\n'),
    );
  });

  it('removes empty leading and trailing lines', () => {
    const rawValue = [
      '',
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '',
      '',
    ].join('\n');
    expect(dedentBlockStringValue(rawValue)).to.equal(
      ['Hello,', '  World!', '', 'Yours,', '  GraphQL.'].join('\n'),
    );
  });

  it('removes blank leading and trailing lines', () => {
    const rawValue = [
      '  ',
      '        ',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '        ',
      '  ',
    ].join('\n');
    expect(dedentBlockStringValue(rawValue)).to.equal(
      ['Hello,', '  World!', '', 'Yours,', '  GraphQL.'].join('\n'),
    );
  });

  it('retains indentation from first line', () => {
    const rawValue = [
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    ].join('\n');
    expect(dedentBlockStringValue(rawValue)).to.equal(
      ['    Hello,', '  World!', '', 'Yours,', '  GraphQL.'].join('\n'),
    );
  });

  it('does not alter trailing spaces', () => {
    const rawValue = [
      '               ',
      '    Hello,     ',
      '      World!   ',
      '               ',
      '    Yours,     ',
      '      GraphQL. ',
      '               ',
    ].join('\n');
    expect(dedentBlockStringValue(rawValue)).to.equal(
      [
        'Hello,     ',
        '  World!   ',
        '           ',
        'Yours,     ',
        '  GraphQL. ',
      ].join('\n'),
    );
  });
});
