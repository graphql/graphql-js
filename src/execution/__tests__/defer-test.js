import { expect } from 'chai';
import { describe, it } from 'mocha';

import isAsyncIterable from '../../jsutils/isAsyncIterable';
import { parse } from '../../language/parser';

import { GraphQLID, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';
import { GraphQLObjectType, GraphQLList } from '../../type/definition';

import { execute } from '../execute';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
  name: 'Friend',
});

const friends = [
  { name: 'Han', id: 2 },
  { name: 'Leia', id: 3 },
  { name: 'C-3PO', id: 4 },
];

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    errorField: {
      type: GraphQLString,
      resolve: () => {
        throw new Error('bad');
      },
    },
    friends: {
      type: new GraphQLList(friendType),
      resolve: () => friends,
    },
  },
  name: 'Hero',
});

const hero = { name: 'Luke', id: 1 };

const query = new GraphQLObjectType({
  fields: {
    hero: {
      type: heroType,
      resolve: () => hero,
    },
  },
  name: 'Query',
});

async function complete(document) {
  const schema = new GraphQLSchema({ query });

  const result = await execute({
    schema,
    document,
    rootValue: {},
  });

  if (isAsyncIterable(result)) {
    const results = [];
    for await (const patch of result) {
      results.push(patch);
    }
    return results;
  }
  return result;
}

describe('Execute: defer directive', () => {
  it('Can defer fragments containing scalar types', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        id
        name
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          hero: {
            id: '1',
          },
        },
        hasNext: true,
      },
      {
        data: {
          id: '1',
          name: 'Luke',
        },
        path: ['hero'],
        hasNext: false,
      },
    ]);
  });
  it('Can disable defer using if argument', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer(if: false)
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal({
      data: {
        hero: {
          id: '1',
          name: 'Luke',
        },
      },
    });
  });
  it('Can defer fragments containing on the top level Query field', async () => {
    const document = parse(`
      query HeroNameQuery {
        ...QueryFragment @defer(label: "DeferQuery")
      }
      fragment QueryFragment on Query {
        hero {
          id
        }
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {},
        hasNext: true,
      },
      {
        data: {
          hero: {
            id: '1',
          },
        },
        path: [],
        label: 'DeferQuery',
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment within an already deferred fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...TopFragment @defer(label: "DeferTop")
        }
      }
      fragment TopFragment on Hero {
        name
        ...NestedFragment @defer(label: "DeferNested")
      }
      fragment NestedFragment on Hero {
        friends {
          name
        }
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          hero: {
            id: '1',
          },
        },
        hasNext: true,
      },
      {
        data: {
          friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
        },
        path: ['hero'],
        label: 'DeferNested',
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
        },
        path: ['hero'],
        label: 'DeferTop',
        hasNext: false,
      },
    ]);
  });
  it('Can defer an inline fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ... on Hero @defer(label: "InlineDeferred") {
            name
          }
        }
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: { name: 'Luke' },
        path: ['hero'],
        label: 'InlineDeferred',
        hasNext: false,
      },
    ]);
  });
  it('Handles errors thrown in deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        errorField
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: { errorField: null },
        path: ['hero'],
        errors: [
          {
            message: 'bad',
            locations: [{ line: 9, column: 9 }],
            path: ['hero', 'errorField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
});
