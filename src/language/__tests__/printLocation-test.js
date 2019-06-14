// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../jsutils/dedent';
import { Source } from '../../language';
import { printSourceLocation } from '../printLocation';

describe('printLocation', () => {
  it('prints single digit line number with no padding', () => {
    const result = printSourceLocation(
      new Source('*', 'Test', { line: 9, column: 1 }),
      { line: 1, column: 1 },
    );

    expect(result + '\n').to.equal(dedent`
      Test:9:1
      9 | *
        | ^
    `);
  });

  it('prints an line numbers with correct padding', () => {
    const result = printSourceLocation(
      new Source('*\n', 'Test', { line: 9, column: 1 }),
      { line: 1, column: 1 },
    );

    expect(result + '\n').to.equal(dedent`
      Test:9:1
       9 | *
         | ^
      10 | 
    `);
  });
});
