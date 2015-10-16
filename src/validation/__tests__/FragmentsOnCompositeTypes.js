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
  FragmentsOnCompositeTypes,
  inlineFragmentOnNonCompositeErrorMessage,
  fragmentOnNonCompositeErrorMessage,
} from '../rules/FragmentsOnCompositeTypes';

function error(fragName, typeName, line, column) {
  return {
    message: fragmentOnNonCompositeErrorMessage(fragName, typeName),
    locations: [ { line, column } ],
  };
}

describe('Validate: Fragments on composite types', () => {

  it('object is valid fragment type', () => {
    expectPassesRule(FragmentsOnCompositeTypes, `
      fragment validFragment on Dog {
        barks
      }
    `);
  });

  it('interface is valid fragment type', () => {
    expectPassesRule(FragmentsOnCompositeTypes, `
      fragment validFragment on Pet {
        name
      }
    `);
  });

  it('object is valid inline fragment type', () => {
    expectPassesRule(FragmentsOnCompositeTypes, `
      fragment validFragment on Pet {
        ... on Dog {
          barks
        }
      }
    `);
  });

  it('inline fragment without type is valid', () => {
    expectPassesRule(FragmentsOnCompositeTypes, `
      fragment validFragment on Pet {
        ... {
          name
        }
      }
    `);
  });

  it('union is valid fragment type', () => {
    expectPassesRule(FragmentsOnCompositeTypes, `
      fragment validFragment on CatOrDog {
        __typename
      }
    `);
  });

  it('scalar is invalid fragment type', () => {
    expectFailsRule(FragmentsOnCompositeTypes, `
      fragment scalarFragment on Boolean {
        bad
      }
    `, [ error('scalarFragment', 'Boolean', 2, 34) ]);
  });

  it('enum is invalid fragment type', () => {
    expectFailsRule(FragmentsOnCompositeTypes, `
      fragment scalarFragment on FurColor {
        bad
      }
    `, [ error('scalarFragment', 'FurColor', 2, 34) ]);
  });

  it('input object is invalid fragment type', () => {
    expectFailsRule(FragmentsOnCompositeTypes, `
      fragment inputFragment on ComplexInput {
        stringField
      }
    `, [ error('inputFragment', 'ComplexInput', 2, 33) ]);
  });

  it('scalar is invalid inline fragment type', () => {
    expectFailsRule(FragmentsOnCompositeTypes, `
      fragment invalidFragment on Pet {
        ... on String {
          barks
        }
      }
    `, [
      { message: inlineFragmentOnNonCompositeErrorMessage('String'),
        locations: [ { line: 3, column: 16 } ] }
    ]);
  });

});
