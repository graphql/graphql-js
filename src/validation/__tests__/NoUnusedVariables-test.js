/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import {
  expectPassesRule,
  expectFailsRule,
  expectPassesRuleWithFragmentVariables,
  expectFailsRuleWithFragmentVariables,
} from './harness';
import {
  NoUnusedVariables,
  unusedVariableMessage,
} from '../rules/NoUnusedVariables';

function unusedVar(varName, opName, line, column) {
  return {
    message: unusedVariableMessage(varName, opName),
    locations: [{ line, column }],
  };
}

describe('Validate: No unused variables', () => {
  it('uses all variables', () => {
    expectPassesRule(
      NoUnusedVariables,
      `
      query ($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c)
      }
    `,
    );
  });

  it('uses all variables deeply', () => {
    expectPassesRule(
      NoUnusedVariables,
      `
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a) {
          field(b: $b) {
            field(c: $c)
          }
        }
      }
    `,
    );
  });

  it('uses all variables deeply in inline fragments', () => {
    expectPassesRule(
      NoUnusedVariables,
      `
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
    `,
    );
  });

  it('uses all variables in fragments', () => {
    expectPassesRule(
      NoUnusedVariables,
      `
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
    `,
    );
  });

  it('variable used by fragment in multiple operations', () => {
    expectPassesRule(
      NoUnusedVariables,
      `
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
    `,
    );
  });

  it('variable used by recursive fragment', () => {
    expectPassesRule(
      NoUnusedVariables,
      `
      query Foo($a: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragA
        }
      }
    `,
    );
  });

  it('variable not used', () => {
    expectFailsRule(
      NoUnusedVariables,
      `
      query ($a: String, $b: String, $c: String) {
        field(a: $a, b: $b)
      }
    `,
      [unusedVar('c', null, 2, 38)],
    );
  });

  it('multiple variables not used', () => {
    expectFailsRule(
      NoUnusedVariables,
      `
      query Foo($a: String, $b: String, $c: String) {
        field(b: $b)
      }
    `,
      [unusedVar('a', 'Foo', 2, 17), unusedVar('c', 'Foo', 2, 41)],
    );
  });

  it('variable not used in fragments', () => {
    expectFailsRule(
      NoUnusedVariables,
      `
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
    `,
      [unusedVar('c', 'Foo', 2, 41)],
    );
  });

  it('multiple variables not used in fragments', () => {
    expectFailsRule(
      NoUnusedVariables,
      `
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
    `,
      [unusedVar('a', 'Foo', 2, 17), unusedVar('c', 'Foo', 2, 41)],
    );
  });

  it('variable not used by unreferenced fragment', () => {
    expectFailsRule(
      NoUnusedVariables,
      `
      query Foo($b: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `,
      [unusedVar('b', 'Foo', 2, 17)],
    );
  });

  it('variable not used by fragment used by other operation', () => {
    expectFailsRule(
      NoUnusedVariables,
      `
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
    `,
      [unusedVar('b', 'Foo', 2, 17), unusedVar('a', 'Bar', 5, 17)],
    );
  });

  // Experimental Fragment Variables
  it('uses all variables in fragments with variable definitions', () => {
    expectPassesRuleWithFragmentVariables(
      NoUnusedVariables,
      `
      fragment Foo($a: String, $b: String, $c: String) on Type {
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
    `,
    );
  });

  it('variable not used by fragment', () => {
    expectFailsRuleWithFragmentVariables(
      NoUnusedVariables,
      `
      fragment FragA($a: String) on Type {
        field
      }
    `,
      [unusedVar('a', 'FragA', 2, 22)],
    );
  });

  it('variable used in query defined by fragment', () => {
    expectFailsRuleWithFragmentVariables(
      NoUnusedVariables,
      `
      query Foo($a: String) {
        field(a: $a)
        ...FragA
      }
      fragment FragA($a: String) on Type {
        field
      }
    `,
      [unusedVar('a', 'FragA', 6, 22)],
    );

    it('variable defined in fragment used by query', () => {
      expectFailsRuleWithFragmentVariables(
        NoUnusedVariables,
        `
        query Foo($a: String) {
          ...FragA
        }
        fragment FragA($a: String) on Type {
          field(a: $a)
        }
      `,
        [unusedVar('a', 'Foo', 1, 19)],
      );
    });
  });
});
