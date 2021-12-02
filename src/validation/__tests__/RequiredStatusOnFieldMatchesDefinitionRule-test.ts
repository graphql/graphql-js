import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { RequiredStatusOnFieldMatchesDefinitionRule } from '../rules/RequiredStatusOnFieldMatchesDefinitionRule';

import { expectValidationErrorsWithSchema } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    testSchema,
    RequiredStatusOnFieldMatchesDefinitionRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

const testSchema = buildSchema(`
  type Lists {
    nonList: Int
    list: [Int]
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
        message:
          "Error: Expected Int to be a GraphQL List type. Was the list nullability modifier's depth more than the field types?",
        locations: [{ line: 3, column: 26 }],
      },
      {
        message:
          "Error: Expected Int to be a GraphQL List type. Was the list nullability modifier's depth more than the field types?",
        locations: [{ line: 4, column: 13 }],
      },
    ]);
  });

  it('reports errors when list depth is too low', () => {
    expectErrors(`
      fragment listFragment on Lists {
        mixedThreeDList[[]!]!
      }
    `).toDeepEqual([
      {
        message: 'List nullability modifier is too shallow.',
        locations: [{ line: 4, column: 7 }],
      },
    ]);
  });
});
