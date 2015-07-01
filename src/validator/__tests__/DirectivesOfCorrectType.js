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
  missingDirectiveValueMessage,
  badDirectiveValueMessage
} from '../errors';
import DirectivesOfCorrectType from '../rules/DirectivesOfCorrectType';


function missingDirectiveValue(directiveName, typeName, line, column) {
  return {
    message: missingDirectiveValueMessage(directiveName, typeName),
    locations: [ { line: line, column: column } ]
  };
}

function badDirectiveValue(directiveName, typeName, value, line, column) {
  return {
    message: badDirectiveValueMessage(directiveName, typeName, value),
    locations: [ { line: line, column: column } ]
  };
}

describe('Validate: Directive values of correct type', () => {

  it('with no directives', () => {
    expectPassesRule(DirectivesOfCorrectType, `
      query Foo {
        name
        ...Frag
      }

      fragment Frag on Dog {
        name
      }
    `);
  });

  it('with directives of valid types', () => {
    expectPassesRule(DirectivesOfCorrectType, `
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

  it('with directive with missing types', () => {
    expectFailsRule(DirectivesOfCorrectType, `
      {
        dog @if {
          name @unless
        }
      }
    `, [
      missingDirectiveValue('if', 'Boolean!', 3, 13),
      missingDirectiveValue('unless', 'Boolean!', 4, 16)
    ]);
  });

  it('with directive with incorrect types', () => {
    expectFailsRule(DirectivesOfCorrectType, `
      {
        dog @if: "yes" {
          name @unless: ENUM
        }
      }
    `, [
      badDirectiveValue('if', 'Boolean!', '"yes"', 3, 18),
      badDirectiveValue('unless', 'Boolean!', 'ENUM', 4, 25),
    ]);
  });

});
