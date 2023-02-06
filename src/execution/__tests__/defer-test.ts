import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import type { DocumentNode } from '../../language/ast.js';
import { parse } from '../../language/parser.js';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition.js';
import { GraphQLID, GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import type {
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../execute.js';
import { execute, experimentalExecuteIncrementally } from '../execute.js';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    promiseNonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => Promise.resolve(null),
    },
  },
  name: 'Friend',
});

const friends = [
  { name: 'Han', id: 2 },
  { name: 'Leia', id: 3 },
  { name: 'C-3PO', id: 4 },
];

const deeperObject = new GraphQLObjectType({
  fields: {
    foo: { type: GraphQLString, resolve: () => 'foo' },
    bar: { type: GraphQLString, resolve: () => 'bar' },
    baz: { type: GraphQLString, resolve: () => 'baz' },
    bak: { type: GraphQLString, resolve: () => 'bak' },
  },
  name: 'DeeperObject',
});

const nestedObject = new GraphQLObjectType({
  fields: {
    deeperObject: { type: deeperObject, resolve: () => ({}) },
  },
  name: 'NestedObject',
});

const anotherNestedObject = new GraphQLObjectType({
  fields: {
    deeperObject: { type: deeperObject, resolve: () => ({}) },
  },
  name: 'AnotherNestedObject',
});

const c = new GraphQLObjectType({
  fields: {
    d: { type: GraphQLString, resolve: () => 'd' },
  },
  name: 'c',
});

const e = new GraphQLObjectType({
  fields: {
    f: { type: GraphQLString, resolve: () => 'f' },
  },
  name: 'e',
});

const b = new GraphQLObjectType({
  fields: {
    c: { type: c, resolve: () => ({}) },
    e: { type: e, resolve: () => ({}) },
  },
  name: 'b',
});

const a = new GraphQLObjectType({
  fields: {
    b: { type: b, resolve: () => ({}) },
  },
  name: 'a',
});

const g = new GraphQLObjectType({
  fields: {
    h: { type: GraphQLString, resolve: () => 'h' },
  },
  name: 'g',
});

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    slowField: {
      type: GraphQLString,
      resolve: async () => {
        await resolveOnNextTick();
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
    asyncFriends: {
      type: new GraphQLList(friendType),
      async *resolve() {
        yield await Promise.resolve(friends[0]);
      },
    },
    nestedObject: { type: nestedObject, resolve: () => ({}) },
    anotherNestedObject: { type: anotherNestedObject, resolve: () => ({}) },
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
    a: { type: a, resolve: () => ({}) },
    g: { type: g, resolve: () => ({}) },
  },
  name: 'Query',
});

const schema = new GraphQLSchema({ query });

async function complete(document: DocumentNode) {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue: {},
  });

  if ('initialResult' in result) {
    const results: Array<
      InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
    > = [result.initialResult];
    for await (const patch of result.subsequentResults) {
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
        incremental: [
          {
            data: {
              name: 'Luke',
            },
            path: ['hero'],
          },
        ],
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
  it('Does not disable defer with null if argument', async () => {
    const document = parse(`
      query HeroNameQuery($shouldDefer: Boolean) {
        hero {
          id
          ...NameFragment @defer(if: $shouldDefer)
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: 'Luke' },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can defer fragments on the top level Query field', async () => {
    const document = parse(`
      query HeroNameQuery {
        ...QueryFragment @defer
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
        incremental: [
          {
            data: {
              hero: {
                id: '1',
              },
            },
            path: [],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can defer fragments with errors on the top level Query field', async () => {
    const document = parse(`
      query HeroNameQuery {
        ...QueryFragment @defer
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
        incremental: [
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
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment within an already deferred fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...TopFragment @defer
        }
      }
      fragment TopFragment on Hero {
        name
        ...NestedFragment @defer
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
        incremental: [
          {
            data: {
              name: 'Luke',
              friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment that is also not deferred, deferred fragment is first', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...TopFragment @defer
          ...TopFragment
        }
      }
      fragment TopFragment on Hero {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            id: '1',
            name: 'Luke',
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {},
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment that is also not deferred, non-deferred fragment is first', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...TopFragment
          ...TopFragment @defer
        }
      }
      fragment TopFragment on Hero {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            id: '1',
            name: 'Luke',
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {},
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Can defer an inline fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ... on Hero @defer {
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
        incremental: [{ data: { name: 'Luke' }, path: ['hero'] }],
        hasNext: false,
      },
    ]);
  });

  it('Can deduplicate multiple defers on the same object', async () => {
    const document = parse(`
      query {
        hero {
          friends {
            ... @defer {
              ...FriendFrag
              ... @defer {
                ...FriendFrag
                ... @defer {
                  ...FriendFrag
                  ... @defer {
                    ...FriendFrag
                  }
                }
              }
            }
          }
        }
      }

      fragment FriendFrag on Friend {
        id
        name
      }
    `);
    const result = await complete(document);

    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [{}, {}, {}] } },
        hasNext: true,
      },
      {
        incremental: [
          { data: { id: '2', name: 'Han' }, path: ['hero', 'friends', 0] },
          { data: { id: '3', name: 'Leia' }, path: ['hero', 'friends', 1] },
          { data: { id: '4', name: 'C-3PO' }, path: ['hero', 'friends', 2] },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Can deduplicate leaf fields present in the initial payload', async () => {
    const document = parse(`
      query {
        hero {
          nestedObject {
            deeperObject {
              foo
            }
          }
          anotherNestedObject {
            deeperObject {
              foo
            }
          }
          ... @defer {
            nestedObject {
              deeperObject {
                bar
              }
            }
            anotherNestedObject {
              deeperObject {
                foo
              }
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            nestedObject: {
              deeperObject: {
                foo: 'foo',
              },
            },
            anotherNestedObject: {
              deeperObject: {
                foo: 'foo',
              },
            },
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              nestedObject: {
                deeperObject: {
                  bar: 'bar',
                },
              },
              anotherNestedObject: {
                deeperObject: {},
              },
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Can deduplicate leaf fields present in a parent defer payload', async () => {
    const document = parse(`
      query {
        hero {
          ... @defer {
            nestedObject {
              deeperObject {
                foo
                ... @defer {
                  foo
                  bar
                }
              }
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {},
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              nestedObject: {
                deeperObject: {
                  foo: 'foo',
                },
              },
            },
            path: ['hero'],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              bar: 'bar',
            },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not completely deduplicate fields with deferred fragments at multiple levels', async () => {
    const document = parse(`
      query {
        hero {
          nestedObject {
            deeperObject {
              foo
            }
          }
          ... @defer {
            nestedObject {
              deeperObject {
                foo
                bar
              }
              ... @defer {
                deeperObject {
                  foo
                  bar
                  baz
                  ... @defer {
                    foo
                    bar
                    baz
                    bak
                  }
                }
              }
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            nestedObject: {
              deeperObject: {
                foo: 'foo',
              },
            },
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              bar: 'bar',
              baz: 'baz',
              bak: 'bak',
            },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
          {
            data: {
              deeperObject: {
                bar: 'bar',
                baz: 'baz',
              },
            },
            path: ['hero', 'nestedObject'],
          },
          {
            data: {
              nestedObject: {
                deeperObject: {
                  bar: 'bar',
                },
              },
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Can combine multiple fields from deferred fragments from different branches occurring at the same level', async () => {
    const document = parse(`
      query {
        hero {
          nestedObject {
            deeperObject {
              ... @defer {
                foo
              }
            }
          }
          ... @defer {
            nestedObject {
              deeperObject {
                ... @defer {
                  foo
                  bar
                }
              }
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            nestedObject: {
              deeperObject: {},
            },
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              foo: 'foo',
              bar: 'bar',
            },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
          {
            data: {
              nestedObject: {
                deeperObject: {},
              },
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Can deduplicate fields with deferred fragments in different branches at multiple non-overlapping levels', async () => {
    const document = parse(`
      query {
        a {
          b {
            c {
              d
            }
            ... @defer {
              e {
                f
              }
            }
          }
        }
        ... @defer {
          a {
            b {
              e {
                f
              }
            }
          }
          g {
            h
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: {
            b: {
              c: {
                d: 'd',
              },
            },
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              e: {
                f: 'f',
              },
            },
            path: ['a', 'b'],
          },
          {
            data: {
              a: {
                b: {
                  e: {
                    f: 'f',
                  },
                },
              },
              g: {
                h: 'h',
              },
            },
            path: [],
          },
        ],
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
        incremental: [
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
        incremental: [
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
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles non-nullable errors thrown outside deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          nonNullErrorField
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        id
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Hero.nonNullErrorField.',
          locations: [
            {
              line: 4,
              column: 11,
            },
          ],
          path: ['hero', 'nonNullErrorField'],
        },
      ],
      data: {
        hero: null,
      },
    });
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
        incremental: [
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
        incremental: [
          {
            data: { slowField: 'slow', friends: [{}, {}, {}] },
            path: ['hero'],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          { data: { name: 'Han' }, path: ['hero', 'friends', 0] },
          { data: { name: 'Leia' }, path: ['hero', 'friends', 1] },
          { data: { name: 'C-3PO' }, path: ['hero', 'friends', 2] },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Returns payloads from synchronous data in correct order', async () => {
    const document = parse(`
    query HeroNameQuery {
      hero {
        id
        ...NameFragment @defer
      }
    }
    fragment NameFragment on Hero {
      name
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
        incremental: [
          {
            data: {
              name: 'Luke',
              friends: [{}, {}, {}],
            },
            path: ['hero'],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          { data: { name: 'Han' }, path: ['hero', 'friends', 0] },
          { data: { name: 'Leia' }, path: ['hero', 'friends', 1] },
          { data: { name: 'C-3PO' }, path: ['hero', 'friends', 2] },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Filters deferred payloads when a list item returned by an async iterable is nulled', async () => {
    const document = parse(`
    query {
      hero {
        asyncFriends {
          promiseNonNullErrorField
          ...NameFragment @defer 
        }
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          asyncFriends: [null],
        },
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Friend.promiseNonNullErrorField.',
          locations: [{ line: 5, column: 11 }],
          path: ['hero', 'asyncFriends', 0, 'promiseNonNullErrorField'],
        },
      ],
    });
  });

  it('original execute function throws error if anything is deferred and everything else is sync', () => {
    const doc = `
    query Deferred {
      ... @defer { hero { id } }
    }
  `;
    expect(() =>
      execute({
        schema,
        document: parse(doc),
        rootValue: {},
      }),
    ).to.throw(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });

  it('original execute function resolves to error if anything is deferred and something else is async', async () => {
    const doc = `
    query Deferred {
      hero { slowField }
      ... @defer { hero { id } }
    }
  `;
    await expectPromise(
      execute({
        schema,
        document: parse(doc),
        rootValue: {},
      }),
    ).toRejectWith(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });
});
