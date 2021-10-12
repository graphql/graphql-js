import { describe, it } from 'mocha';

import { VariablesInAllowedPositionRule } from '../rules/VariablesInAllowedPositionRule';

import { expectValidationErrors } from './harness';

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
  });
});
