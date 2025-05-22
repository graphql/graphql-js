import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { GraphQLInt, GraphQLObjectType, GraphQLString } from '../../type/definition';
import { GraphQLSchema } from '../../type/schema';

import { mergeAST } from '../mergeAST';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Test',
    fields: {
      id: {
        type: GraphQLInt,
      },
      name: {
        type: GraphQLString,
      },
    },
  }),
});

describe.only('mergeAST', () => {
  it('does not modify query with no fragments', () => {
    const query = `
      query Test {
        id
      }
    `;
    const expected = stripWhitespace(`
      query Test {
        id
      }
    `);
    expect(parseMergeAndPrint(query)).to.equal(expected);
    expect(parseMergeAndPrint(query, schema)).to.equal(expected);
  });

  it('does inline simple nested fragment', () => {
    const query = /* GraphQL */ `
      query Test {
        ...Fragment1
      }

      fragment Fragment1 on Test {
        id
      }
    `;
    const expected = stripWhitespace(/* GraphQL */ `
      query Test {
        ... on Test {
          id
        }
      }
    `);
    const expectedWithSchema = stripWhitespace(/* GraphQL */ `
      query Test {
        id
      }
    `);
    expect(parseMergeAndPrint(query)).to.equal(expected);
    expect(parseMergeAndPrint(query, schema)).to.equal(expectedWithSchema);
  });

  it('does inline triple nested fragment', () => {
    const query = `
      query Test {
        ...Fragment1
      }

      fragment Fragment1 on Test {
        ...Fragment2
      }

      fragment Fragment2 on Test {
        ...Fragment3
      }

      fragment Fragment3 on Test {
        id
      }
    `;
    const expected = stripWhitespace(`
      query Test {
        ... on Test {
          ... on Test {
            ... on Test {
              id
            }
          }
        }
      }
    `);
    const expectedWithSchema = stripWhitespace(/* GraphQL */ `
      query Test {
        id
      }
    `);
    expect(parseMergeAndPrint(query)).to.equal(expected);
    expect(parseMergeAndPrint(query, schema)).to.equal(expectedWithSchema);
  });

  it('does inline multiple fragments', () => {
    const query = `
      query Test {
        ...Fragment1
        ...Fragment2
        ...Fragment3
      }

      fragment Fragment1 on Test {
        id
      }

      fragment Fragment2 on Test {
        id
      }

      fragment Fragment3 on Test {
        id
      }
    `;
    const expected = stripWhitespace(`
      query Test {
        ... on Test {
          id
        }
        ... on Test {
          id
        }
        ... on Test {
          id
        }
      }
    `);
    const expectedWithSchema = stripWhitespace(`
      query Test {
        id
      }
    `);
    expect(parseMergeAndPrint(query)).to.equal(expected);
    expect(parseMergeAndPrint(query, schema)).to.equal(expectedWithSchema);
  });

  it('removes duplicate fragment spreads', () => {
    const query = `
      query Test {
        ...Fragment1
        ...Fragment1
      }

      fragment Fragment1 on Test {
        id
      }
    `;
    const expected = stripWhitespace(`
      query Test {
        ... on Test {
          id
        }
      }
    `);
    const expectedWithSchema = stripWhitespace(/* GraphQL */ `
      query Test {
        id
      }
    `);
    expect(parseMergeAndPrint(query)).to.equal(expected);
    expect(parseMergeAndPrint(query, schema)).to.equal(expectedWithSchema);
  });
});

function parseMergeAndPrint(query: string, maybeSchema?: GraphQLSchema) {
  return stripWhitespace(print(mergeAST(parse(query), maybeSchema)));
}

function stripWhitespace(str: string) {
  return str.replace(/\s/g, '');
}
