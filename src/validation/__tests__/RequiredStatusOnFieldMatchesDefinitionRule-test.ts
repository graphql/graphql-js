import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { RequiredStatusOnFieldMatchesDefinitionRule } from '../rules/RequiredStatusOnFieldMatchesDefinitionRule.js';

import { expectValidationErrorsWithSchema } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    testSchema,
    RequiredStatusOnFieldMatchesDefinitionRule,
    queryStr,
    { experimentalClientControlledNullability: true },
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

const testSchema = buildSchema(`
  type Lists {
    nonList: Int
    list: [Int]
    requiredList: [Int]!
    mixedThreeDList: [[[Int]]]
  } 
  type Query {
    lists: Lists
  }
`);

describe('Validate: Field uses correct list depth', () => {
  it('Fields are valid', () => {
    expectValid(`
      fragment listFragment on Lists {
        list[!]
        nonList!
        mixedThreeDList[[[!]!]!]!
        requiredList[]
        unmodifiedList: list
      }
    `);
  });

  it('reports errors when list depth is too high', () => {
    expectErrors(`
      fragment listFragment on Lists {
        notAList: nonList[!]
        list[[]]
      }
    `).toDeepEqual([
      {
        message: 'List nullability modifier is too deep.',
        locations: [{ line: 3, column: 26 }],
      },
      {
        message: 'List nullability modifier is too deep.',
        locations: [{ line: 4, column: 13 }],
      },
    ]);
  });

  it('reports errors when list depth is too low', () => {
    expectErrors(`
      fragment listFragment on Lists {
        list!
        mixedThreeDList[[]!]!
      }
    `).toDeepEqual([
      {
        message: 'List nullability modifier is too shallow.',
        locations: [{ line: 3, column: 13 }],
      },
      {
        message: 'List nullability modifier is too shallow.',
        locations: [{ line: 4, column: 24 }],
      },
    ]);
  });
});
