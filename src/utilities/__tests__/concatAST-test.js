/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import { concatAST } from '../concatAST';
import { Source, parse, print } from '../../language';

describe('concatAST', () => {
  it('concats two ASTs together', () => {
    const sourceA = new Source(`
      { a, b, ...Frag }
    `);

    const sourceB = new Source(`
      fragment Frag on T {
        c
      }
    `);

    const astA = parse(sourceA);
    const astB = parse(sourceB);
    const astC = concatAST([astA, astB]);

    expect(print(astC)).to.equal(dedent`
      {
        a
        b
        ...Frag
      }

      fragment Frag on T {
        c
      }
    `);
  });
});
