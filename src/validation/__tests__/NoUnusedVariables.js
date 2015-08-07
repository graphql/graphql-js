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
  NoUnusedVariables,
  unusedVariableMessage,
} from '../rules/NoUnusedVariables';


function unusedVar(varName, line, column) {
  return {
    message: unusedVariableMessage(varName),
    locations: [ { line: line, column: column } ],
  };
}

describe('Validate: No unused variables', () => {

  it('uses all variables', () => {
    expectPassesRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('uses all variables deeply', () => {
    expectPassesRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a) {
          field(b: $b) {
            field(c: $c)
          }
        }
      }
    `);
  });

  it('uses all variables deeply in inline fragments', () => {
    expectPassesRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        ... on Type {
          field(a: $a) {
            field(b: $b) {
              ... on Type {
                field(c: $c)
              }
            }
          }
        }
      }
    `);
  });

  it('uses all variables in fragments', () => {
    expectPassesRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragB
        }
      }
      fragment FragB on Type {
        field(b: $b) {
          ...FragC
        }
      }
      fragment FragC on Type {
        field(c: $c)
      }
    `);
  });

  it('variable used by fragment in multiple operations', () => {
    expectPassesRule(NoUnusedVariables, `
      query Foo($a: String) {
        ...FragA
      }
      query Bar($b: String) {
        ...FragB
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `);
  });

  it('variable used by recursive fragment', () => {
    expectPassesRule(NoUnusedVariables, `
      query Foo($a: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragA
        }
      }
    `);
  });

  it('variable not used', () => {
    expectFailsRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a, b: $b)
      }
    `, [
      unusedVar('c', 2, 41)
    ]);
  });

  it('multiple variables not used', () => {
    expectFailsRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        field(b: $b)
      }
    `, [
      unusedVar('a', 2, 17),
      unusedVar('c', 2, 41)
    ]);
  });

  it('variable not used in fragments', () => {
    expectFailsRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragB
        }
      }
      fragment FragB on Type {
        field(b: $b) {
          ...FragC
        }
      }
      fragment FragC on Type {
        field
      }
    `, [
      unusedVar('c', 2, 41)
    ]);
  });

  it('multiple variables not used', () => {
    expectFailsRule(NoUnusedVariables, `
      query Foo($a: String, $b: String, $c: String) {
        ...FragA
      }
      fragment FragA on Type {
        field {
          ...FragB
        }
      }
      fragment FragB on Type {
        field(b: $b) {
          ...FragC
        }
      }
      fragment FragC on Type {
        field
      }
    `, [
      unusedVar('a', 2, 17),
      unusedVar('c', 2, 41)
    ]);
  });

  it('variable not used by unreferenced fragment', () => {
    expectFailsRule(NoUnusedVariables, `
      query Foo($b: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `, [
      unusedVar('b', 2, 17)
    ]);
  });

  it('variable not used by fragment used by other operation', () => {
    expectFailsRule(NoUnusedVariables, `
      query Foo($b: String) {
        ...FragA
      }
      query Bar($a: String) {
        ...FragB
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `, [
      unusedVar('b', 2, 17),
      unusedVar('a', 5, 17)
    ]);
  });

});
