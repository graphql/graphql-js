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

import dedent from '../../jsutils/dedent';
import invariant from '../../jsutils/invariant';
import { GraphQLError } from '../GraphQLError';
import { printError } from '../printError';
import { Kind, parse, Source } from '../../language';

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
    const docA = parse(
      new Source(
        dedent`
          type Foo {
            field: String
          }
        `,
        'SourceA',
      ),
    );
    const opA = docA.definitions[0];
    invariant(opA && opA.kind === Kind.OBJECT_TYPE_DEFINITION && opA.fields);
    const fieldA = opA.fields[0];

    const docB = parse(
      new Source(
        dedent`
          type Foo {
            field: Int
          }
        `,
        'SourceB',
      ),
    );
    const opB = docB.definitions[0];
    invariant(opB && opB.kind === Kind.OBJECT_TYPE_DEFINITION && opB.fields);
    const fieldB = opB.fields[0];

    const error = new GraphQLError('Example error with two nodes', [
      fieldA.type,
      fieldB.type,
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
