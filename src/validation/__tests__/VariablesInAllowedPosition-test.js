/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  VariablesInAllowedPosition,
  badVarPosMessage,
} from '../rules/VariablesInAllowedPosition';

describe('Validate: Variables are in allowed positions', () => {
  it('Boolean => Boolean', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($booleanArg: Boolean)
      {
        complicatedArgs {
          booleanArgField(booleanArg: $booleanArg)
        }
      }
    `,
    );
  });

  it('Boolean => Boolean within fragment', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      fragment booleanArgFrag on ComplicatedArgs {
        booleanArgField(booleanArg: $booleanArg)
      }
      query Query($booleanArg: Boolean)
      {
        complicatedArgs {
          ...booleanArgFrag
        }
      }
    `,
    );

    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($booleanArg: Boolean)
      {
        complicatedArgs {
          ...booleanArgFrag
        }
      }
      fragment booleanArgFrag on ComplicatedArgs {
        booleanArgField(booleanArg: $booleanArg)
      }
    `,
    );
  });

  it('Boolean! => Boolean', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($nonNullBooleanArg: Boolean!)
      {
        complicatedArgs {
          booleanArgField(booleanArg: $nonNullBooleanArg)
        }
      }
    `,
    );
  });

  it('Boolean! => Boolean within fragment', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      fragment booleanArgFrag on ComplicatedArgs {
        booleanArgField(booleanArg: $nonNullBooleanArg)
      }

      query Query($nonNullBooleanArg: Boolean!)
      {
        complicatedArgs {
          ...booleanArgFrag
        }
      }
    `,
    );
  });

  it('[String] => [String]', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($stringListVar: [String])
      {
        complicatedArgs {
          stringListArgField(stringListArg: $stringListVar)
        }
      }
    `,
    );
  });

  it('[String!] => [String]', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($stringListVar: [String!])
      {
        complicatedArgs {
          stringListArgField(stringListArg: $stringListVar)
        }
      }
    `,
    );
  });

  it('String => [String] in item position', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($stringVar: String)
      {
        complicatedArgs {
          stringListArgField(stringListArg: [$stringVar])
        }
      }
    `,
    );
  });

  it('String! => [String] in item position', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($stringVar: String!)
      {
        complicatedArgs {
          stringListArgField(stringListArg: [$stringVar])
        }
      }
    `,
    );
  });

  it('ComplexInput => ComplexInput', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($complexVar: ComplexInput)
      {
        complicatedArgs {
          complexArgField(complexArg: $complexVar)
        }
      }
    `,
    );
  });

  it('ComplexInput => ComplexInput in field position', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($boolVar: Boolean = false)
      {
        complicatedArgs {
          complexArgField(complexArg: {requiredArg: $boolVar})
        }
      }
    `,
    );
  });

  it('Boolean! => Boolean! in directive', () => {
    expectPassesRule(
      VariablesInAllowedPosition,
      `
      query Query($boolVar: Boolean!)
      {
        dog @include(if: $boolVar)
      }
    `,
    );
  });

  it('Int => Int!', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      query Query($intArg: Int) {
        complicatedArgs {
          nonNullIntArgField(nonNullIntArg: $intArg)
        }
      }
    `,
      [
        {
          message: badVarPosMessage('intArg', 'Int', 'Int!'),
          locations: [{ line: 2, column: 19 }, { line: 4, column: 45 }],
        },
      ],
    );
  });

  it('Int => Int! within fragment', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      fragment nonNullIntArgFieldFrag on ComplicatedArgs {
        nonNullIntArgField(nonNullIntArg: $intArg)
      }

      query Query($intArg: Int) {
        complicatedArgs {
          ...nonNullIntArgFieldFrag
        }
      }
    `,
      [
        {
          message: badVarPosMessage('intArg', 'Int', 'Int!'),
          locations: [{ line: 6, column: 19 }, { line: 3, column: 43 }],
        },
      ],
    );
  });

  it('Int => Int! within nested fragment', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      fragment outerFrag on ComplicatedArgs {
        ...nonNullIntArgFieldFrag
      }

      fragment nonNullIntArgFieldFrag on ComplicatedArgs {
        nonNullIntArgField(nonNullIntArg: $intArg)
      }

      query Query($intArg: Int) {
        complicatedArgs {
          ...outerFrag
        }
      }
    `,
      [
        {
          message: badVarPosMessage('intArg', 'Int', 'Int!'),
          locations: [{ line: 10, column: 19 }, { line: 7, column: 43 }],
        },
      ],
    );
  });

  it('String over Boolean', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      query Query($stringVar: String) {
        complicatedArgs {
          booleanArgField(booleanArg: $stringVar)
        }
      }
    `,
      [
        {
          message: badVarPosMessage('stringVar', 'String', 'Boolean'),
          locations: [{ line: 2, column: 19 }, { line: 4, column: 39 }],
        },
      ],
    );
  });

  it('String => [String]', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      query Query($stringVar: String) {
        complicatedArgs {
          stringListArgField(stringListArg: $stringVar)
        }
      }
    `,
      [
        {
          message: badVarPosMessage('stringVar', 'String', '[String]'),
          locations: [{ line: 2, column: 19 }, { line: 4, column: 45 }],
        },
      ],
    );
  });

  it('Boolean => Boolean! in directive', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      query Query($boolVar: Boolean) {
        dog @include(if: $boolVar)
      }
    `,
      [
        {
          message: badVarPosMessage('boolVar', 'Boolean', 'Boolean!'),
          locations: [{ line: 2, column: 19 }, { line: 3, column: 26 }],
        },
      ],
    );
  });

  it('String => Boolean! in directive', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      query Query($stringVar: String) {
        dog @include(if: $stringVar)
      }
    `,
      [
        {
          message: badVarPosMessage('stringVar', 'String', 'Boolean!'),
          locations: [{ line: 2, column: 19 }, { line: 3, column: 26 }],
        },
      ],
    );
  });

  it('[String] => [String!]', () => {
    expectFailsRule(
      VariablesInAllowedPosition,
      `
      query Query($stringListVar: [String])
      {
        complicatedArgs {
          stringListNonNullArgField(stringListNonNullArg: $stringListVar)
        }
      }
    `,
      [
        {
          message: badVarPosMessage('stringListVar', '[String]', '[String!]'),
          locations: [{ line: 2, column: 19 }, { line: 5, column: 59 }],
        },
      ],
    );
  });

  describe('Allows optional (nullable) variables with default values', () => {
    it('Int => Int! fails when variable provides null default value', () => {
      expectFailsRule(
        VariablesInAllowedPosition,
        `
        query Query($intVar: Int = null) {
          complicatedArgs {
            nonNullIntArgField(nonNullIntArg: $intVar)
          }
        }`,
        [
          {
            message: badVarPosMessage('intVar', 'Int', 'Int!'),
            locations: [{ line: 2, column: 21 }, { line: 4, column: 47 }],
          },
        ],
      );
    });

    it('Int => Int! when variable provides non-null default value', () => {
      expectPassesRule(
        VariablesInAllowedPosition,
        `
        query Query($intVar: Int = 1) {
          complicatedArgs {
            nonNullIntArgField(nonNullIntArg: $intVar)
          }
        }`,
      );
    });

    it('Int => Int! when optional argument provides default value', () => {
      expectPassesRule(
        VariablesInAllowedPosition,
        `
        query Query($intVar: Int) {
          complicatedArgs {
            nonNullFieldWithDefault(nonNullIntArg: $intVar)
          }
        }`,
      );
    });

    it('Boolean => Boolean! in directive with default value with option', () => {
      expectPassesRule(
        VariablesInAllowedPosition,
        `
        query Query($boolVar: Boolean = false) {
          dog @include(if: $boolVar)
        }`,
      );
    });
  });
});
