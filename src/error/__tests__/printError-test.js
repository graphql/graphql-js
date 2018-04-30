/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLError } from '../GraphQLError';
import { printError } from '../printError';
import { parse, Source } from '../../language';
import dedent from '../../jsutils/dedent';

describe('printError', () => {
  it('prints an line numbers with correct padding', () => {
    const singleDigit = new GraphQLError(
      'Single digit line number with no padding',
      null,
      new Source('*', 'Test', { line: 9, column: 1 }),
      [0],
    );
    expect(printError(singleDigit)).to.equal(dedent`
      Single digit line number with no padding

      Test (9:1)
      9: *
         ^
    `);

    const doubleDigit = new GraphQLError(
      'Left padded first line number',
      null,
      new Source('*\n', 'Test', { line: 9, column: 1 }),
      [0],
    );
    expect(printError(doubleDigit)).to.equal(dedent`
      Left padded first line number

      Test (9:1)
       9: *
          ^
      10: 
    `);
  });

  it('prints an error with nodes from different sources', () => {
    const sourceA = parse(
      new Source(
        dedent`
        type Foo {
          field: String
        }`,
        'SourceA',
      ),
    );
    const fieldTypeA = sourceA.definitions[0].fields[0].type;

    const sourceB = parse(
      new Source(
        dedent`
        type Foo {
          field: Int
        }`,
        'SourceB',
      ),
    );
    const fieldTypeB = sourceB.definitions[0].fields[0].type;

    const error = new GraphQLError('Example error with two nodes', [
      fieldTypeA,
      fieldTypeB,
    ]);

    expect(printError(error)).to.equal(dedent`
      Example error with two nodes

      SourceA (2:10)
      1: type Foo {
      2:   field: String
                  ^
      3: }

      SourceB (2:10)
      1: type Foo {
      2:   field: Int
                  ^
      3: }
    `);
  });
});
