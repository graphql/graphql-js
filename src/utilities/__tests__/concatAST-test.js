/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
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
    const astC = concatAST([ astA, astB ]);

    expect(print(astC)).to.equal(
`{
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
