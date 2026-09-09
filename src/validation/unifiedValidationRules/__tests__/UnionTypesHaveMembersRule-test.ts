import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../../type/definition.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { UnionTypesHaveMembersTypeSystemValidation } from '../UnionTypesHaveMembersRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [UnionTypesHaveMembersTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: UnionTypesHaveMembersRule', () => {
  it('validates SDL union member counts after extensions are known', () => {
    expectSDLErrors(`
      type Query {
        field: String
      }

      union Search
      extend union Search = Query
    `).toDeepEqual([]);
  });

  it('uses existing schema union member counts when validating SDL', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: new GraphQLObjectType({ name: 'Object', fields: {} }) },
      },
    });
    const Search = new GraphQLUnionType({
      name: 'Search',
      types: [Query],
    });
    const schema = new GraphQLSchema({
      query: Query,
      types: [Search],
    });

    expectSDLErrors('extend union Search = Query', schema).toDeepEqual([]);
  });

  it('rejects SDL union types without member types', () => {
    expectSDLErrors(`
      union EmptyUnion
    `).toDeepEqual([
      {
        message: 'Union type EmptyUnion must define one or more member types.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('rejects schema union types without member types', () => {
    const EmptyUnion = new GraphQLUnionType({
      name: 'EmptyUnion',
      types: [],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyUnion },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [UnionTypesHaveMembersTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Union type EmptyUnion must define one or more member types.',
      },
    ]);
  });
});
