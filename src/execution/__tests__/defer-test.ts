import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';
import { isAsyncIterable } from '../../jsutils/isAsyncIterable';
import { parse } from '../../language/parser';

import { GraphQLID, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';
import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../../type/definition';

import type { DocumentNode } from '../../language/ast';

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
    slowField: {
      type: GraphQLString,
      resolve: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return 'slow';
      },
    },
    errorField: {
      type: GraphQLString,
      resolve: () => {
        throw new Error('bad');
      },
    },
    nonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => null,
    },
    promiseNonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => Promise.resolve(null),
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

async function complete(
  document: DocumentNode,
  opts?: { enableDeferStream?: boolean },
) {
  const enableDeferStream = opts?.enableDeferStream ?? true;
  const schema = new GraphQLSchema({ query, enableDeferStream });

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
  it('Should ignore @defer if not enabled', async () => {
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
    const result = await complete(document, { enableDeferStream: false });

    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          id: '1',
          name: 'Luke',
        },
      },
    });
  });
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

    expectJSON(result).toDeepEqual([
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

    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          id: '1',
          name: 'Luke',
        },
      },
    });
  });
  it('Can defer fragments on the top level Query field', async () => {
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

    expectJSON(result).toDeepEqual([
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
  it('Can defer fragments with errors on the top level Query field', async () => {
    const document = parse(`
      query HeroNameQuery {
        ...QueryFragment @defer(label: "DeferQuery")
      }
      fragment QueryFragment on Query {
        hero {
          errorField
        }
      }
    `);
    const result = await complete(document);

    expectJSON(result).toDeepEqual([
      {
        data: {},
        hasNext: true,
      },
      {
        data: {
          hero: {
            errorField: null,
          },
        },
        errors: [
          {
            message: 'bad',
            locations: [{ line: 7, column: 11 }],
            path: ['hero', 'errorField'],
          },
        ],
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

    expectJSON(result).toDeepEqual([
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

    expectJSON(result).toDeepEqual([
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
    expectJSON(result).toDeepEqual([
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
  it('Handles non-nullable errors thrown in deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        nonNullErrorField
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: null,
        path: ['hero'],
        errors: [
          {
            message:
              'Cannot return null for non-nullable field Hero.nonNullErrorField.',
            locations: [{ line: 9, column: 9 }],
            path: ['hero', 'nonNullErrorField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async non-nullable errors thrown in deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        promiseNonNullErrorField
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: null,
        path: ['hero'],
        errors: [
          {
            message:
              'Cannot return null for non-nullable field Hero.promiseNonNullErrorField.',
            locations: [{ line: 9, column: 9 }],
            path: ['hero', 'promiseNonNullErrorField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Returns payloads in correct order', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        slowField
        friends {
          ...NestedFragment @defer
        }
      }
      fragment NestedFragment on Friend {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: { id: '1' },
        },
        hasNext: true,
      },
      {
        data: {
          slowField: 'slow',
          friends: [{}, {}, {}],
        },
        path: ['hero'],
        hasNext: true,
      },
      {
        data: { name: 'Han' },
        path: ['hero', 'friends', 0],
        hasNext: true,
      },
      {
        data: { name: 'Leia' },
        path: ['hero', 'friends', 1],
        hasNext: true,
      },
      {
        data: { name: 'C-3PO' },
        path: ['hero', 'friends', 2],
        hasNext: false,
      },
    ]);
  });
});
