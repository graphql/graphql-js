/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import {
  NoUnusedVariables,
  unusedVariableMessage,
} from '../rules/NoUnusedVariables';

function expectErrors(queryStr) {
  return expectValidationErrors(NoUnusedVariables, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function unusedVar(varName, opName, line, column) {
  return {
    message: unusedVariableMessage(varName, opName),
    locations: [{ line, column }],
  };
}

describe('Validate: No unused variables', () => {
  it('uses all variables', () => {
    expectValid(`
      query ($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('uses all variables deeply', () => {
    expectValid(`
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
    expectValid(`
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
    expectValid(`
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
    expectValid(`
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
    expectValid(`
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
    expectErrors(`
      query ($a: String, $b: String, $c: String) {
        field(a: $a, b: $b)
      }
    `).to.deep.equal([unusedVar('c', null, 2, 38)]);
  });

  it('multiple variables not used', () => {
    expectErrors(`
      query Foo($a: String, $b: String, $c: String) {
        field(b: $b)
      }
    `).to.deep.equal([
      unusedVar('a', 'Foo', 2, 17),
      unusedVar('c', 'Foo', 2, 41),
    ]);
  });

  it('variable not used in fragments', () => {
    expectErrors(`
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
    `).to.deep.equal([unusedVar('c', 'Foo', 2, 41)]);
  });

  it('multiple variables not used in fragments', () => {
    expectErrors(`
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
    `).to.deep.equal([
      unusedVar('a', 'Foo', 2, 17),
      unusedVar('c', 'Foo', 2, 41),
    ]);
  });

  it('variable not used by unreferenced fragment', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `).to.deep.equal([unusedVar('b', 'Foo', 2, 17)]);
  });

  it('variable not used by fragment used by other operation', () => {
    expectErrors(`
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
    `).to.deep.equal([
      unusedVar('b', 'Foo', 2, 17),
      unusedVar('a', 'Bar', 5, 17),
    ]);
  });
});
