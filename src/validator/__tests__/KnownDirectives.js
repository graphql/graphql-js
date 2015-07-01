/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import KnownDirectives from '../rules/KnownDirectives';
import { unknownDirectiveMessage, misplacedDirectiveMessage } from '../errors';


function unknownDirective(directiveName, line, column) {
  return {
    message: unknownDirectiveMessage(directiveName),
    locations: [ { line, column } ]
  };
}

function misplacedDirective(directiveName, placement, line, column) {
  return {
    message: misplacedDirectiveMessage(directiveName, placement),
    locations: [ { line, column } ]
  };
}

describe('Validate: Known directives', () => {

  it('with no directives', () => {
    expectPassesRule(KnownDirectives, `
      query Foo {
        name
        ...Frag
      }

      fragment Frag on Dog {
        name
      }
    `);
  });

  it('with known directives', () => {
    expectPassesRule(KnownDirectives, `
      {
        dog @if: true {
          name
        }
        human @unless: false {
          name
        }
      }
    `);
  });

  it('with unknown directive', () => {
    expectFailsRule(KnownDirectives, `
      {
        dog @unknown: "directive" {
          name
        }
      }
    `, [
      unknownDirective('unknown', 3, 13)
    ]);
  });

  it('with many unknown directives', () => {
    expectFailsRule(KnownDirectives, `
      {
        dog @unknown: "directive" {
          name
        }
        human @unknown: "directive" {
          name
          pets @unknown: "directive" {
            name
          }
        }
      }
    `, [
      unknownDirective('unknown', 3, 13),
      unknownDirective('unknown', 6, 15),
      unknownDirective('unknown', 8, 16)
    ]);
  });

  it('with misplaced directives', () => {
    expectFailsRule(KnownDirectives, `
      query Foo @if: true {
        name
        ...Frag
      }
    `, [
      misplacedDirective('if', 'operation', 2, 17)
    ]);
  });

});
