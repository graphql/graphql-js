/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  UniqueDirectivesPerLocation,
  duplicateDirectiveMessage,
} from '../rules/UniqueDirectivesPerLocation';

function duplicateDirective(directiveName, l1, c1, l2, c2) {
  return {
    message: duplicateDirectiveMessage(directiveName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
    path: undefined,
  };
}

describe('Validate: Directives Are Unique Per Location', () => {
  it('no directives', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field
      }
    `,
    );
  });

  it('unique directives in different locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @directiveA {
        field @directiveB
      }
    `,
    );
  });

  it('unique directives in same locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @directiveA @directiveB {
        field @directiveA @directiveB
      }
    `,
    );
  });

  it('same directives in different locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @directiveA {
        field @directiveA
      }
    `,
    );
  });

  it('same directives in similar locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @directive
        field @directive
      }
    `,
    );
  });

  it('repeatable directives in same location', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      type Test @repeatableDirective(id: 1) @repeatableDirective(id: 2) {
        field: String!
      }
    `,
    );
  });

  it('repeatable directives in similar locations', () => {
    expectPassesRule(
      UniqueDirectivesPerLocation,
      `
      type Test @repeatableDirective(id: 1) @repeatableDirective(id: 2) {
        field: String!
      }
      
      extend type Test @repeatableDirective(id: 3) {
        anotherField: String!
      }
    `,
    );
  });

  it('duplicate directives in one location', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @directive @directive
      }
    `,
      [duplicateDirective('directive', 3, 15, 3, 26)],
    );
  });

  it('many duplicate directives in one location', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @directive @directive @directive
      }
    `,
      [
        duplicateDirective('directive', 3, 15, 3, 26),
        duplicateDirective('directive', 3, 15, 3, 37),
      ],
    );
  });

  it('different duplicate directives in one location', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type {
        field @directiveA @directiveB @directiveA @directiveB
      }
    `,
      [
        duplicateDirective('directiveA', 3, 15, 3, 39),
        duplicateDirective('directiveB', 3, 27, 3, 51),
      ],
    );
  });

  it('duplicate directives in many locations', () => {
    expectFailsRule(
      UniqueDirectivesPerLocation,
      `
      fragment Test on Type @directive @directive {
        field @directive @directive
      }
    `,
      [
        duplicateDirective('directive', 2, 29, 2, 40),
        duplicateDirective('directive', 3, 15, 3, 26),
      ],
    );
  });
});
