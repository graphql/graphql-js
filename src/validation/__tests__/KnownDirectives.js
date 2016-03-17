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
import {
  KnownDirectives,
  unknownDirectiveMessage,
  misplacedDirectiveMessage,
} from '../rules/KnownDirectives';


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
        dog @include(if: true) {
          name
        }
        human @skip(if: false) {
          name
        }
      }
    `);
  });

  it('with unknown directive', () => {
    expectFailsRule(KnownDirectives, `
      {
        dog @unknown(directive: "value") {
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
        dog @unknown(directive: "value") {
          name
        }
        human @unknown(directive: "value") {
          name
          pets @unknown(directive: "value") {
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

  it('with well placed directives', () => {
    expectPassesRule(KnownDirectives, `
      query Foo {
        name @include(if: true)
        ...Frag @include(if: true)
        skippedField @skip(if: true)
        ...SkippedFrag @skip(if: true)
      }
    `);
  });

  it('with misplaced directives', () => {
    expectFailsRule(KnownDirectives, `
      query Foo @include(if: true) {
        name @operationOnly
        ...Frag @operationOnly
      }
    `, [
      misplacedDirective('include', 'QUERY', 2, 17),
      misplacedDirective('operationOnly', 'FIELD', 3, 14),
      misplacedDirective('operationOnly', 'FRAGMENT_SPREAD', 4, 17),
    ]);
  });

});
