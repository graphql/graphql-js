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
  NoUndefinedVariables,
  undefinedVarMessage,
} from '../rules/NoUndefinedVariables';

function expectErrors(queryStr) {
  return expectValidationErrors(NoUndefinedVariables, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function undefVar(varName, l1, c1, opName, l2, c2) {
  return {
    message: undefinedVarMessage(varName, opName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: No undefined variables', () => {
  it('all variables defined', () => {
    expectValid(`
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('all variables deeply defined', () => {
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

  it('all variables deeply in inline fragments defined', () => {
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

  it('all variables in fragments deeply defined', () => {
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

  it('variable within single fragment defined in multiple operations', () => {
    expectValid(`
      query Foo($a: String) {
        ...FragA
      }
      query Bar($a: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
    `);
  });

  it('variable within fragments defined in operations', () => {
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

  it('variable within recursive fragment defined', () => {
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

  it('variable not defined', () => {
    expectErrors(`
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c, d: $d)
      }
    `).to.deep.equal([undefVar('d', 3, 39, 'Foo', 2, 7)]);
  });

  it('variable not defined by un-named query', () => {
    expectErrors(`
      {
        field(a: $a)
      }
   `).to.deep.equal([undefVar('a', 3, 18, '', 2, 7)]);
  });

  it('multiple variables not defined', () => {
    expectErrors(`
      query Foo($b: String) {
        field(a: $a, b: $b, c: $c)
      }
    `).to.deep.equal([
      undefVar('a', 3, 18, 'Foo', 2, 7),
      undefVar('c', 3, 32, 'Foo', 2, 7),
    ]);
  });

  it('variable in fragment not defined by un-named query', () => {
    expectErrors(`
      {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
    `).to.deep.equal([undefVar('a', 6, 18, '', 2, 7)]);
  });

  it('variable in fragment not defined by operation', () => {
    expectErrors(`
      query Foo($a: String, $b: String) {
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
    `).to.deep.equal([undefVar('c', 16, 18, 'Foo', 2, 7)]);
  });

  it('multiple variables in fragments not defined', () => {
    expectErrors(`
      query Foo($b: String) {
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
    `).to.deep.equal([
      undefVar('a', 6, 18, 'Foo', 2, 7),
      undefVar('c', 16, 18, 'Foo', 2, 7),
    ]);
  });

  it('single variable in fragment not defined by multiple operations', () => {
    expectErrors(`
      query Foo($a: String) {
        ...FragAB
      }
      query Bar($a: String) {
        ...FragAB
      }
      fragment FragAB on Type {
        field(a: $a, b: $b)
      }
    `).to.deep.equal([
      undefVar('b', 9, 25, 'Foo', 2, 7),
      undefVar('b', 9, 25, 'Bar', 5, 7),
    ]);
  });

  it('variables in fragment not defined by multiple operations', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragAB
      }
      query Bar($a: String) {
        ...FragAB
      }
      fragment FragAB on Type {
        field(a: $a, b: $b)
      }
    `).to.deep.equal([
      undefVar('a', 9, 18, 'Foo', 2, 7),
      undefVar('b', 9, 25, 'Bar', 5, 7),
    ]);
  });

  it('variable in fragment used by other operation', () => {
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
      undefVar('a', 9, 18, 'Foo', 2, 7),
      undefVar('b', 12, 18, 'Bar', 5, 7),
    ]);
  });

  it('multiple undefined variables produce multiple errors', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragAB
      }
      query Bar($a: String) {
        ...FragAB
      }
      fragment FragAB on Type {
        field1(a: $a, b: $b)
        ...FragC
        field3(a: $a, b: $b)
      }
      fragment FragC on Type {
        field2(c: $c)
      }
    `).to.deep.equal([
      undefVar('a', 9, 19, 'Foo', 2, 7),
      undefVar('a', 11, 19, 'Foo', 2, 7),
      undefVar('c', 14, 19, 'Foo', 2, 7),
      undefVar('b', 9, 26, 'Bar', 5, 7),
      undefVar('b', 11, 26, 'Bar', 5, 7),
      undefVar('c', 14, 19, 'Bar', 5, 7),
    ]);
  });
});
