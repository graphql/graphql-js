import { describe, it } from 'mocha';

import { VariablesInAllowedPositionRule } from '../rules/VariablesInAllowedPositionRule.js';

import { expectValidationErrors } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(VariablesInAllowedPositionRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Variables are in allowed positions', () => {
  it('Boolean => Boolean', () => {
    expectValid(`
      query Query($booleanArg: Boolean)
      {
        complicatedArgs {
          booleanArgField(booleanArg: $booleanArg)
        }
      }
    `);
  });

  it('Boolean => Boolean within fragment', () => {
    expectValid(`
      fragment booleanArgFrag on ComplicatedArgs {
        booleanArgField(booleanArg: $booleanArg)
      }
      query Query($booleanArg: Boolean)
      {
        complicatedArgs {
          ...booleanArgFrag
        }
      }
    `);

    expectValid(`
      query Query($booleanArg: Boolean)
      {
        complicatedArgs {
          ...booleanArgFrag
        }
      }
      fragment booleanArgFrag on ComplicatedArgs {
        booleanArgField(booleanArg: $booleanArg)
      }
    `);
  });

  it('Boolean! => Boolean', () => {
    expectValid(`
      query Query($nonNullBooleanArg: Boolean!)
      {
        complicatedArgs {
          booleanArgField(booleanArg: $nonNullBooleanArg)
        }
      }
    `);
  });

  it('Boolean! => Boolean within fragment', () => {
    expectValid(`
      fragment booleanArgFrag on ComplicatedArgs {
        booleanArgField(booleanArg: $nonNullBooleanArg)
      }

      query Query($nonNullBooleanArg: Boolean!)
      {
        complicatedArgs {
          ...booleanArgFrag
        }
      }
    `);
  });

  it('[String] => [String]', () => {
    expectValid(`
      query Query($stringListVar: [String])
      {
        complicatedArgs {
          stringListArgField(stringListArg: $stringListVar)
        }
      }
    `);
  });

  it('[String!] => [String]', () => {
    expectValid(`
      query Query($stringListVar: [String!])
      {
        complicatedArgs {
          stringListArgField(stringListArg: $stringListVar)
        }
      }
    `);
  });

  it('String => [String] in item position', () => {
    expectValid(`
      query Query($stringVar: String)
      {
        complicatedArgs {
          stringListArgField(stringListArg: [$stringVar])
        }
      }
    `);
  });

  it('String! => [String] in item position', () => {
    expectValid(`
      query Query($stringVar: String!)
      {
        complicatedArgs {
          stringListArgField(stringListArg: [$stringVar])
        }
      }
    `);
  });

  it('ComplexInput => ComplexInput', () => {
    expectValid(`
      query Query($complexVar: ComplexInput)
      {
        complicatedArgs {
          complexArgField(complexArg: $complexVar)
        }
      }
    `);
  });

  it('ComplexInput => ComplexInput in field position', () => {
    expectValid(`
      query Query($boolVar: Boolean = false)
      {
        complicatedArgs {
          complexArgField(complexArg: {requiredArg: $boolVar})
        }
      }
    `);
  });

  it('Boolean! => Boolean! in directive', () => {
    expectValid(`
      query Query($boolVar: Boolean!)
      {
        dog @include(if: $boolVar)
      }
    `);
  });

  it('Int => Int!', () => {
    expectErrors(`
      query Query($intArg: Int) {
        complicatedArgs {
          nonNullIntArgField(nonNullIntArg: $intArg)
        }
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$intArg" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 19 },
          { line: 4, column: 45 },
        ],
      },
    ]);
  });

  it('Int => Int! within fragment', () => {
    expectErrors(`
      fragment nonNullIntArgFieldFrag on ComplicatedArgs {
        nonNullIntArgField(nonNullIntArg: $intArg)
      }

      query Query($intArg: Int) {
        complicatedArgs {
          ...nonNullIntArgFieldFrag
        }
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$intArg" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 6, column: 19 },
          { line: 3, column: 43 },
        ],
      },
    ]);
  });

  it('Int => Int! within nested fragment', () => {
    expectErrors(`
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
    `).toDeepEqual([
      {
        message:
          'Variable "$intArg" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 10, column: 19 },
          { line: 7, column: 43 },
        ],
      },
    ]);
  });

  it('String over Boolean', () => {
    expectErrors(`
      query Query($stringVar: String) {
        complicatedArgs {
          booleanArgField(booleanArg: $stringVar)
        }
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$stringVar" of type "String" used in position expecting type "Boolean".',
        locations: [
          { line: 2, column: 19 },
          { line: 4, column: 39 },
        ],
      },
    ]);
  });

  it('String => [String]', () => {
    expectErrors(`
      query Query($stringVar: String) {
        complicatedArgs {
          stringListArgField(stringListArg: $stringVar)
        }
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$stringVar" of type "String" used in position expecting type "[String]".',
        locations: [
          { line: 2, column: 19 },
          { line: 4, column: 45 },
        ],
      },
    ]);
  });

  it('Boolean => Boolean! in directive', () => {
    expectErrors(`
      query Query($boolVar: Boolean) {
        dog @include(if: $boolVar)
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$boolVar" of type "Boolean" used in position expecting type "Boolean!".',
        locations: [
          { line: 2, column: 19 },
          { line: 3, column: 26 },
        ],
      },
    ]);
  });

  it('String => Boolean! in directive', () => {
    expectErrors(`
      query Query($stringVar: String) {
        dog @include(if: $stringVar)
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$stringVar" of type "String" used in position expecting type "Boolean!".',
        locations: [
          { line: 2, column: 19 },
          { line: 3, column: 26 },
        ],
      },
    ]);
  });

  it('[String] => [String!]', () => {
    expectErrors(`
      query Query($stringListVar: [String])
      {
        complicatedArgs {
          stringListNonNullArgField(stringListNonNullArg: $stringListVar)
        }
      }
    `).toDeepEqual([
      {
        message:
          'Variable "$stringListVar" of type "[String]" used in position expecting type "[String!]".',
        locations: [
          { line: 2, column: 19 },
          { line: 5, column: 59 },
        ],
      },
    ]);
  });

  describe('Allows optional (nullable) variables with default values', () => {
    it('Int => Int! fails when variable provides null default value', () => {
      expectErrors(`
        query Query($intVar: Int = null) {
          complicatedArgs {
            nonNullIntArgField(nonNullIntArg: $intVar)
          }
        }
      `).toDeepEqual([
        {
          message:
            'Variable "$intVar" of type "Int" used in position expecting type "Int!".',
          locations: [
            { line: 2, column: 21 },
            { line: 4, column: 47 },
          ],
        },
      ]);
    });

    it('Int => Int! when variable provides non-null default value', () => {
      expectValid(`
        query Query($intVar: Int = 1) {
          complicatedArgs {
            nonNullIntArgField(nonNullIntArg: $intVar)
          }
        }`);
    });

    it('Int => Int! when optional argument provides default value', () => {
      expectValid(`
        query Query($intVar: Int) {
          complicatedArgs {
            nonNullFieldWithDefault(nonNullIntArg: $intVar)
          }
        }`);
    });

    it('Boolean => Boolean! in directive with default value with option', () => {
      expectValid(`
        query Query($boolVar: Boolean = false) {
          dog @include(if: $boolVar)
        }`);
    });

    it('undefined in directive with default value with option', () => {
      expectValid(`
        {
          dog @include(if: $x)
        }`);
    });
  });

  describe('Validates OneOf Input Objects', () => {
    it('Allows exactly one non-nullable variable', () => {
      expectValid(`
        query ($string: String!) {
          complicatedArgs {
            oneOfArgField(oneOfArg: { stringField: $string })
          }
        }
      `);
    });

    it('Forbids one nullable variable', () => {
      expectErrors(`
        query ($string: String) {
          complicatedArgs {
            oneOfArgField(oneOfArg: { stringField: $string })
          }
        }
      `).toDeepEqual([
        {
          message:
            'Variable "$string" is of type "String" but must be non-nullable to be used for OneOf Input Object "OneOfInput".',
          locations: [
            { line: 2, column: 16 },
            { line: 4, column: 52 },
          ],
        },
      ]);
    });
  });

  describe('Fragment arguments are validated', () => {
    it('Boolean => Boolean', () => {
      expectValid(`
        query Query($booleanArg: Boolean)
        {
          complicatedArgs {
            ...A(b: $booleanArg)
          }
        }
        fragment A($b: Boolean) on ComplicatedArgs {
          booleanArgField(booleanArg: $b)
        }
      `);
    });

    it('Boolean => Boolean with default value', () => {
      expectValid(`
        query Query($booleanArg: Boolean)
        {
          complicatedArgs {
            ...A(b: $booleanArg)
          }
        }
        fragment A($b: Boolean = true) on ComplicatedArgs {
          booleanArgField(booleanArg: $b)
        }
      `);
    });

    it('Boolean => Boolean!', () => {
      expectErrors(`
        query Query($ab: Boolean)
        {
          complicatedArgs {
            ...A(b: $ab)
          }
        }
        fragment A($b: Boolean!) on ComplicatedArgs {
          booleanArgField(booleanArg: $b)
        }
      `).toDeepEqual([
        {
          message:
            'Variable "$ab" of type "Boolean" used in position expecting type "Boolean!".',
          locations: [
            { line: 2, column: 21 },
            { line: 5, column: 21 },
          ],
        },
      ]);
    });

    it('Int => Int! fails when variable provides null default value', () => {
      expectErrors(`
        query Query($intVar: Int = null) {
          complicatedArgs {
            ...A(i: $intVar)
          }
        }
        fragment A($i: Int!) on ComplicatedArgs {
          nonNullIntArgField(nonNullIntArg: $i)
        }
      `).toDeepEqual([
        {
          message:
            'Variable "$intVar" of type "Int" used in position expecting type "Int!".',
          locations: [
            { line: 2, column: 21 },
            { line: 4, column: 21 },
          ],
        },
      ]);
    });

    it('Int fragment arg => Int! field arg fails even when shadowed by Int! variable', () => {
      expectErrors(`
        query Query($intVar: Int!) {
          complicatedArgs {
            ...A(i: $intVar)
          }
        }
        fragment A($intVar: Int) on ComplicatedArgs {
          nonNullIntArgField(nonNullIntArg: $intVar)
        }
      `).toDeepEqual([
        {
          message:
            'Variable "$intVar" of type "Int" used in position expecting type "Int!".',
          locations: [
            { line: 7, column: 20 },
            { line: 8, column: 45 },
          ],
        },
      ]);
    });
  });
});
