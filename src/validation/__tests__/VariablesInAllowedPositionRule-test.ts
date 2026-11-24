import { describe, it } from 'node:test';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import { parse } from '../../language/parser.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { VariablesInAllowedPositionRule } from '../rules/VariablesInAllowedPositionRule.ts';
import type { ValidationOptions } from '../validate.ts';
import { validate } from '../validate.ts';

import { expectValidationErrors, testSchema } from './harness.ts';

function expectErrors(queryStr: string) {
  return expectValidationErrors(VariablesInAllowedPositionRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectErrorsWithSchema(
  schema: GraphQLSchema,
  queryStr: string,
  options?: ValidationOptions,
) {
  const document = parse(queryStr, { experimentalFragmentArguments: true });
  return expectJSON(
    validate(schema, document, [VariablesInAllowedPositionRule], options),
  );
}

function expectLegacyValid(queryStr: string) {
  expectErrorsWithSchema(testSchema, queryStr, {
    allowLegacyVariableUsage: true,
  }).toDeepEqual([]);
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
    expectLegacyValid(`
      query Query($boolVar: Boolean = false)
      {
        complicatedArgs {
          complexArgField(complexArg: {requiredField: $boolVar})
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

  describe('Legacy validation allows nullable variables with default values', () => {
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
      expectLegacyValid(`
        query Query($intVar: Int = 1) {
          complicatedArgs {
            nonNullIntArgField(nonNullIntArg: $intVar)
          }
        }`);
    });

    it('Int => Int! when optional argument provides default value', () => {
      expectLegacyValid(`
        query Query($intVar: Int) {
          complicatedArgs {
            nonNullFieldWithDefault(arg: $intVar)
          }
        }`);
    });

    it('Int => Int! when an argument default is inside a fragment', () => {
      expectLegacyValid(`
        fragment defaultArgFrag on ComplicatedArgs {
          nonNullFieldWithDefault(arg: $intVar)
        }

        query Query($intVar: Int) {
          complicatedArgs {
            ...defaultArgFrag
          }
        }
      `);
    });

    it('Boolean => Boolean! in directive with default value with option', () => {
      expectLegacyValid(`
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
    it('Int => Int! when the field argument provides a default value', () => {
      expectLegacyValid(`
        query Query {
          complicatedArgs {
            ...A
          }
        }
        fragment A($intVar: Int) on ComplicatedArgs {
          nonNullFieldWithDefault(arg: $intVar)
        }
      `);
    });

    it('validates fragment variables defined before the operation', () => {
      expectErrors(`
        fragment A($intVar: Int) on ComplicatedArgs {
          nonNullIntArgField(nonNullIntArg: $intVar)
        }
        query Query($intVar: Int!) {
          complicatedArgs {
            ...A(i: $intVar)
          }
        }
      `).toDeepEqual([
        {
          message:
            'Variable "$intVar" of type "Int" used in position expecting type "Int!".',
          locations: [
            { line: 2, column: 20 },
            { line: 3, column: 45 },
          ],
        },
      ]);
    });

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

  it('Undefined variable in oneOf input object', () => {
    expectErrors(`
      {
        complicatedArgs {
          oneOfArgField(oneOfArg: { stringField: $undefinedVariable })
        }
      }
    `).toDeepEqual([]);
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
          { line: 2, column: 14 },
          { line: 4, column: 50 },
        ],
      },
    ]);
  });
});

describe('Non-specified behavior of variables within custom scalars', () => {
  it('Allows using variables inside object literal in custom scalar', () => {
    expectValid(`
      query Query($x: Float) {
        dog {
          distanceFrom(loc: {x: $x, y: 10.0})
        }
      }`);
  });

  it('Allows using variables inside list literal in custom scalar', () => {
    expectValid(`
      query Query($x: Float) {
        dog {
          distanceFrom(loc: [$x, 10.0])
        }
      }`);
  });
});

describe('Validate: Strict and legacy variable usages', () => {
  const schema = buildSchema(`
    directive @withDefault(flag: Boolean! = true) on FIELD

    input Options {
      n: Int! = 5
    }

    input Choice @oneOf {
      n: Int
    }

    type Query {
      required(n: Int!): Int
      defaulted(n: Int! = 5): Int
      nullable(n: Int): Int
      numbers(values: [Int!]!): Int
      options(input: Options): Int
      choice(input: Choice): Int
    }
  `);

  function expectUsageErrors(queryStr: string, options?: ValidationOptions) {
    return expectErrorsWithSchema(schema, queryStr, options);
  }

  it('Int => Int! with a variable default', () => {
    const query = `
      query Q($v: Int = 0) {
        required(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 21 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! with an argument default', () => {
    const query = `
      query Q($v: Int) {
        defaulted(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 22 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! with both defaults', () => {
    const query = `
      query Q($v: Int = 3) {
        defaulted(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 22 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! with a null variable default and an argument default', () => {
    const query = `
      query Q($v: Int = null) {
        defaulted(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 22 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! with an input field default', () => {
    const query = `
      query Q($v: Int) {
        options(input: { n: $v })
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 29 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! in a list item with a variable default', () => {
    const query = `
      query Q($v: Int = 3) {
        numbers(values: [1, $v, 3])
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 29 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('[Int!] => [Int!]! with a variable default', () => {
    const query = `
      query Q($v: [Int!] = [1]) {
        numbers(values: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "[Int!]" used in position expecting type "[Int!]!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 25 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('[Int] => [Int!]! remains invalid with a variable default', () => {
    const query = `
      query Q($v: [Int] = [1]) {
        numbers(values: $v)
      }
    `;
    const expectedErrors = [
      {
        message:
          'Variable "$v" of type "[Int]" used in position expecting type "[Int!]!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 25 },
        ],
      },
    ];
    expectUsageErrors(query).toDeepEqual(expectedErrors);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      expectedErrors,
    );
  });

  it('Boolean => Boolean! in a directive with a variable default', () => {
    const query = `
      query Q($v: Boolean = false) {
        required(n: 1) @include(if: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Boolean" used in position expecting type "Boolean!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 37 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Boolean => Boolean! in a directive with an argument default', () => {
    const query = `
      query Q($v: Boolean) {
        required(n: 1) @withDefault(flag: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Boolean" used in position expecting type "Boolean!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 43 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int! => Int! with a variable default is valid in both modes', () => {
    const query = `
      query Q($v: Int! = 3) {
        required(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int! => Int is valid in both modes', () => {
    const query = `
      query Q($v: Int!) {
        nullable(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int is valid in both modes', () => {
    const query = `
      query Q($v: Int) {
        nullable(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! without defaults is invalid in both modes', () => {
    const query = `
      query Q($v: Int) {
        required(n: $v)
      }
    `;
    const expectedErrors = [
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 21 },
        ],
      },
    ];
    expectUsageErrors(query).toDeepEqual(expectedErrors);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      expectedErrors,
    );
  });

  it('Int => Int! with only a null variable default is invalid in both modes', () => {
    const query = `
      query Q($v: Int = null) {
        required(n: $v)
      }
    `;
    const expectedErrors = [
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 21 },
        ],
      },
    ];
    expectUsageErrors(query).toDeepEqual(expectedErrors);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      expectedErrors,
    );
  });

  it('Boolean => Int! remains invalid with defaults', () => {
    const query = `
      query Q($v: Boolean = true) {
        defaulted(n: $v)
      }
    `;
    const expectedErrors = [
      {
        message:
          'Variable "$v" of type "Boolean" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 22 },
        ],
      },
    ];
    expectUsageErrors(query).toDeepEqual(expectedErrors);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      expectedErrors,
    );
  });

  it('Boolean! => Int! is invalid in both modes', () => {
    const query = `
      query Q($v: Boolean!) {
        required(n: $v)
      }
    `;
    const expectedErrors = [
      {
        message:
          'Variable "$v" of type "Boolean!" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 21 },
        ],
      },
    ];
    expectUsageErrors(query).toDeepEqual(expectedErrors);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      expectedErrors,
    );
  });

  it('nullable variables with defaults remain invalid in OneOf input objects', () => {
    const query = `
      query Q($v: Int = 3) {
        choice(input: { n: $v })
      }
    `;
    const expectedErrors = [
      {
        message:
          'Variable "$v" is of type "Int" but must be non-nullable to be used for OneOf Input Object "Choice".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 28 },
        ],
      },
    ];
    expectUsageErrors(query).toDeepEqual(expectedErrors);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      expectedErrors,
    );
  });

  it('non-null variables are allowed in OneOf input objects in both modes', () => {
    const query = `
      query Q($v: Int!) {
        choice(input: { n: $v })
      }
    `;
    expectUsageErrors(query).toDeepEqual([]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! with an argument default inside nested fragments', () => {
    const query = `
      query Q($v: Int) {
        ...Outer
      }

      fragment Outer on Query {
        ...Inner
      }

      fragment Inner on Query {
        defaulted(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 11, column: 22 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! with a local fragment variable default', () => {
    const query = `
      query Q {
        ...F
      }

      fragment F($v: Int = 3) on Query {
        required(n: $v)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 6, column: 18 },
          { line: 7, column: 21 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });

  it('Int => Int! in a fragment argument with a variable default', () => {
    const query = `
      query Q($v: Int = 3) {
        ...F(n: $v)
      }

      fragment F($n: Int!) on Query {
        required(n: $n)
      }
    `;
    expectUsageErrors(query).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 15 },
          { line: 3, column: 17 },
        ],
      },
    ]);
    expectUsageErrors(query, { allowLegacyVariableUsage: true }).toDeepEqual(
      [],
    );
  });
});
