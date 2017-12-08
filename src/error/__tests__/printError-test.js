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
