import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import type { DocumentNode } from '../../language/ast.js';
import { parse } from '../../language/parser.js';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition.js';
import { GraphQLID, GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { execute, experimentalExecuteIncrementally } from '../execute.js';
import type {
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../types.js';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    nonNullName: { type: new GraphQLNonNull(GraphQLString) },
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
    foo: { type: GraphQLString },
    bar: { type: GraphQLString },
    baz: { type: GraphQLString },
    bak: { type: GraphQLString },
  },
  name: 'DeeperObject',
});

const nestedObject = new GraphQLObjectType({
  fields: {
    deeperObject: { type: deeperObject },
    name: { type: GraphQLString },
  },
  name: 'NestedObject',
});

const anotherNestedObject = new GraphQLObjectType({
  fields: {
    deeperObject: { type: deeperObject },
  },
  name: 'AnotherNestedObject',
});

const hero = {
  name: 'Luke',
  id: 1,
  friends,
  nestedObject,
  anotherNestedObject,
};

const c = new GraphQLObjectType({
  fields: {
    d: { type: GraphQLString },
    nonNullErrorField: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: 'c',
});

const e = new GraphQLObjectType({
  fields: {
    f: { type: GraphQLString },
  },
  name: 'e',
});

const b = new GraphQLObjectType({
  fields: {
    c: { type: c },
    e: { type: e },
  },
  name: 'b',
});

const a = new GraphQLObjectType({
  fields: {
    b: { type: b },
    someField: { type: GraphQLString },
  },
  name: 'a',
});

const g = new GraphQLObjectType({
  fields: {
    h: { type: GraphQLString },
  },
  name: 'g',
});

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    nonNullName: { type: new GraphQLNonNull(GraphQLString) },
    friends: {
      type: new GraphQLList(friendType),
    },
    nestedObject: { type: nestedObject },
    anotherNestedObject: { type: anotherNestedObject },
  },
  name: 'Hero',
});

const query = new GraphQLObjectType({
  fields: {
    hero: {
      type: heroType,
    },
    a: { type: a },
    g: { type: g },
  },
  name: 'Query',
});

const schema = new GraphQLSchema({ query });

async function complete(
  document: DocumentNode,
  rootValue: unknown = { hero },
  enableEarlyExecution = false,
) {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
    enableEarlyExecution,
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
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              name: 'Luke',
            },
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
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
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: 'Luke' },
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });
  it('Does not execute deferred fragments early when not specified', async () => {
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
    const order: Array<string> = [];
    const result = await complete(document, {
      hero: {
        ...hero,
        id: async () => {
          await resolveOnNextTick();
          await resolveOnNextTick();
          order.push('slow-id');
          return hero.id;
        },
        name: () => {
          order.push('fast-name');
          return hero.name;
        },
      },
    });

    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            id: '1',
          },
        },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              name: 'Luke',
            },
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
    expect(order).to.deep.equal(['slow-id', 'fast-name']);
  });
  it('Does execute deferred fragments early when specified', async () => {
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
    const order: Array<string> = [];
    const result = await complete(
      document,
      {
        hero: {
          ...hero,
          id: async () => {
            await resolveOnNextTick();
            await resolveOnNextTick();
            order.push('slow-id');
            return hero.id;
          },
          name: () => {
            order.push('fast-name');
            return hero.name;
          },
        },
      },
      true,
    );

    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            id: '1',
          },
        },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              name: 'Luke',
            },
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
    expect(order).to.deep.equal(['fast-name', 'slow-id']);
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
        pending: [{ id: '0', path: [], label: 'DeferQuery' }],
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
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
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
          name
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        name: () => {
          throw new Error('bad');
        },
      },
    });

    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [{ id: '0', path: [], label: 'DeferQuery' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              hero: {
                name: null,
              },
            },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 7, column: 11 }],
                path: ['hero', 'name'],
              },
            ],
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment within an already deferred fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ...TopFragment @defer(label: "DeferTop")
        }
      }
      fragment TopFragment on Hero {
        id
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
          hero: {},
        },
        pending: [{ id: '0', path: ['hero'], label: 'DeferTop' }],
        hasNext: true,
      },
      {
        pending: [{ id: '1', path: ['hero'], label: 'DeferNested' }],
        incremental: [
          {
            data: {
              id: '1',
            },
            id: '0',
          },
          {
            data: {
              friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
            },
            id: '1',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment that is also not deferred, deferred fragment is first', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ...TopFragment @defer(label: "DeferTop")
          ...TopFragment
        }
      }
      fragment TopFragment on Hero {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          name: 'Luke',
        },
      },
    });
  });
  it('Can defer a fragment that is also not deferred, non-deferred fragment is first', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ...TopFragment
          ...TopFragment @defer(label: "DeferTop")
        }
      }
      fragment TopFragment on Hero {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          name: 'Luke',
        },
      },
    });
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
        pending: [{ id: '0', path: ['hero'], label: 'InlineDeferred' }],
        hasNext: true,
      },
      {
        incremental: [{ data: { name: 'Luke' }, id: '0' }],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('Does not emit empty defer fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ... @defer {
            name @skip(if: true)
          }
        }
      }
      fragment TopFragment on Hero {
        name
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      data: {
        hero: {},
      },
    });
  });

  it('Emits children of empty defer fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ... @defer {
            ... @defer {
              name
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
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [{ data: { name: 'Luke' }, id: '0' }],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('Can separately emit defer fragments with different labels with varying fields', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ... @defer(label: "DeferID") {
            id
          }
          ... @defer(label: "DeferName") {
            name
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
        pending: [
          { id: '0', path: ['hero'], label: 'DeferID' },
          { id: '1', path: ['hero'], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            id: '0',
          },
          {
            data: {
              name: 'Luke',
            },
            id: '1',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Separately emits defer fragments with different labels with varying subfields', async () => {
    const document = parse(`
      query HeroNameQuery {
        ... @defer(label: "DeferID") {
          hero {
            id
          }
        }
        ... @defer(label: "DeferName") {
          hero {
            name
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [
          { id: '0', path: [], label: 'DeferID' },
          { id: '1', path: [], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: {} },
            id: '0',
          },
          {
            data: { id: '1' },
            id: '0',
            subPath: ['hero'],
          },
          {
            data: { name: 'Luke' },
            id: '1',
            subPath: ['hero'],
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Separately emits defer fragments with different labels with varying subfields that return promises', async () => {
    const document = parse(`
      query HeroNameQuery {
        ... @defer(label: "DeferID") {
          hero {
            id
          }
        }
        ... @defer(label: "DeferName") {
          hero {
            name
          }
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        id: () => Promise.resolve('1'),
        name: () => Promise.resolve('Luke'),
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [
          { id: '0', path: [], label: 'DeferID' },
          { id: '1', path: [], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: {} },
            id: '0',
          },
          {
            data: { id: '1' },
            id: '0',
            subPath: ['hero'],
          },
          {
            data: { name: 'Luke' },
            id: '1',
            subPath: ['hero'],
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Separately emits defer fragments with varying subfields of same priorities but different level of defers', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ... @defer(label: "DeferID") {
            id
          }
        }
        ... @defer(label: "DeferName") {
          hero {
            name
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
        pending: [
          { id: '0', path: ['hero'], label: 'DeferID' },
          { id: '1', path: [], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            id: '0',
          },
          {
            data: {
              name: 'Luke',
            },
            id: '1',
            subPath: ['hero'],
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Separately emits nested defer fragments with varying subfields of same priorities but different level of defers', async () => {
    const document = parse(`
      query HeroNameQuery {
        ... @defer(label: "DeferName") {
          hero {
            name
            ... @defer(label: "DeferID") {
              id
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [{ id: '0', path: [], label: 'DeferName' }],
        hasNext: true,
      },
      {
        pending: [{ id: '1', path: ['hero'], label: 'DeferID' }],
        incremental: [
          {
            data: {
              hero: {
                name: 'Luke',
              },
            },
            id: '0',
          },
          {
            data: {
              id: '1',
            },
            id: '1',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Initiates deferred grouped field sets only if they have been released as pending', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            ... @defer {
              b {
                c { d }
              }
            }
          }
        }
        ... @defer {
          a {
            someField
            ... @defer {
              b {
                e { f }
              }
            }
          }
        }
      }
    `);

    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    let cResolverCalled = false;
    let eResolverCalled = false;
    const executeResult = experimentalExecuteIncrementally({
      schema,
      document,
      rootValue: {
        a: {
          someField: slowFieldPromise,
          b: {
            c: () => {
              cResolverCalled = true;
              return { d: 'd' };
            },
            e: () => {
              eResolverCalled = true;
              return { f: 'f' };
            },
          },
        },
      },
      enableEarlyExecution: false,
    });

    assert('initialResult' in executeResult);

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {},
      pending: [
        { id: '0', path: [] },
        { id: '1', path: [] },
      ],
      hasNext: true,
    });

    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    expect(cResolverCalled).to.equal(false);
    expect(eResolverCalled).to.equal(false);

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      value: {
        pending: [{ id: '2', path: ['a'] }],
        incremental: [
          {
            data: { a: {} },
            id: '0',
          },
          {
            data: { b: {} },
            id: '2',
          },
          {
            data: { c: { d: 'd' } },
            id: '2',
            subPath: ['b'],
          },
        ],
        completed: [{ id: '0' }, { id: '2' }],
        hasNext: true,
      },
      done: false,
    });

    expect(cResolverCalled).to.equal(true);
    expect(eResolverCalled).to.equal(false);

    resolveSlowField('someField');

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      value: {
        pending: [{ id: '3', path: ['a'] }],
        incremental: [
          {
            data: { someField: 'someField' },
            id: '1',
            subPath: ['a'],
          },
          {
            data: { e: { f: 'f' } },
            id: '3',
            subPath: ['b'],
          },
        ],
        completed: [{ id: '1' }, { id: '3' }],
        hasNext: false,
      },
      done: false,
    });

    expect(eResolverCalled).to.equal(true);

    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: undefined,
      done: true,
    });
  });

  it('Initiates unique deferred grouped field sets after those that are common to sibling defers', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            ... @defer {
              b {
                c { d }
              }
            }
          }
        }
        ... @defer {
          a {
            ... @defer {
              b {
                c { d }
                e { f }
              }
            }
          }
        }
      }
    `);

    const { promise: cPromise, resolve: resolveC } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let cResolverCalled = false;
    let eResolverCalled = false;
    const executeResult = experimentalExecuteIncrementally({
      schema,
      document,
      rootValue: {
        a: {
          b: {
            c: async () => {
              cResolverCalled = true;
              await cPromise;
              return { d: 'd' };
            },
            e: () => {
              eResolverCalled = true;
              return { f: 'f' };
            },
          },
        },
      },
      enableEarlyExecution: false,
    });

    assert('initialResult' in executeResult);

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {},
      pending: [
        { id: '0', path: [] },
        { id: '1', path: [] },
      ],
      hasNext: true,
    });

    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    expect(cResolverCalled).to.equal(false);
    expect(eResolverCalled).to.equal(false);

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      value: {
        pending: [
          { id: '2', path: ['a'] },
          { id: '3', path: ['a'] },
        ],
        incremental: [
          {
            data: { a: {} },
            id: '0',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: true,
      },
      done: false,
    });

    resolveC();

    expect(cResolverCalled).to.equal(true);
    expect(eResolverCalled).to.equal(false);

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      value: {
        incremental: [
          {
            data: { b: { c: { d: 'd' } } },
            id: '2',
          },
          {
            data: { e: { f: 'f' } },
            id: '3',
            subPath: ['b'],
          },
        ],
        completed: [{ id: '2' }, { id: '3' }],
        hasNext: false,
      },
      done: false,
    });

    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: undefined,
      done: true,
    });
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
        pending: [
          { id: '0', path: ['hero', 'friends', 0] },
          { id: '1', path: ['hero', 'friends', 1] },
          { id: '2', path: ['hero', 'friends', 2] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          { data: { id: '2', name: 'Han' }, id: '0' },
          { data: { id: '3', name: 'Leia' }, id: '1' },
          { data: { id: '4', name: 'C-3PO' }, id: '2' },
        ],
        completed: [{ id: '0' }, { id: '1' }, { id: '2' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicates fields present in the initial payload', async () => {
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
    const result = await complete(document, {
      hero: {
        nestedObject: { deeperObject: { foo: 'foo', bar: 'bar' } },
        anotherNestedObject: { deeperObject: { foo: 'foo' } },
      },
    });
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
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { bar: 'bar' },
            id: '0',
            subPath: ['nestedObject', 'deeperObject'],
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicates fields present in a parent defer payload', async () => {
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
    const result = await complete(document, {
      hero: { nestedObject: { deeperObject: { foo: 'foo', bar: 'bar' } } },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {},
        },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        pending: [{ id: '1', path: ['hero', 'nestedObject', 'deeperObject'] }],
        incremental: [
          {
            data: {
              nestedObject: {
                deeperObject: { foo: 'foo' },
              },
            },
            id: '0',
          },
          {
            data: {
              bar: 'bar',
            },
            id: '1',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicates fields with deferred fragments at multiple levels', async () => {
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
    const result = await complete(document, {
      hero: {
        nestedObject: {
          deeperObject: { foo: 'foo', bar: 'bar', baz: 'baz', bak: 'bak' },
        },
      },
    });
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
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        pending: [
          { id: '1', path: ['hero', 'nestedObject'] },
          { id: '2', path: ['hero', 'nestedObject', 'deeperObject'] },
        ],
        incremental: [
          {
            data: { bar: 'bar' },
            id: '0',
            subPath: ['nestedObject', 'deeperObject'],
          },
          {
            data: { baz: 'baz' },
            id: '1',
            subPath: ['deeperObject'],
          },
          {
            data: { bak: 'bak' },
            id: '2',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }, { id: '2' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicates multiple fields from deferred fragments from different branches occurring at the same level', async () => {
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
    const result = await complete(document, {
      hero: { nestedObject: { deeperObject: { foo: 'foo', bar: 'bar' } } },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            nestedObject: {
              deeperObject: {},
            },
          },
        },
        pending: [
          { id: '0', path: ['hero', 'nestedObject', 'deeperObject'] },
          { id: '1', path: ['hero', 'nestedObject', 'deeperObject'] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              foo: 'foo',
            },
            id: '0',
          },
          {
            data: {
              bar: 'bar',
            },
            id: '1',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicate fields with deferred fragments in different branches at multiple non-overlapping levels', async () => {
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
    const result = await complete(document, {
      a: {
        b: {
          c: { d: 'd' },
          e: { f: 'f' },
        },
      },
      g: { h: 'h' },
    });
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
        pending: [
          { id: '0', path: ['a', 'b'] },
          { id: '1', path: [] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { e: { f: 'f' } },
            id: '0',
          },
          {
            data: { g: { h: 'h' } },
            id: '1',
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Correctly bundles varying subfields into incremental data records unique by defer combination, ignoring fields in a fragment masked by a parent defer', async () => {
    const document = parse(`
      query HeroNameQuery {
        ... @defer {
          hero {
            id
          }
        }
        ... @defer {
          hero {
            name
            shouldBeWithNameDespiteAdditionalDefer: name
            ... @defer {
              shouldBeWithNameDespiteAdditionalDefer: name
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [
          { id: '0', path: [] },
          { id: '1', path: [] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: {} },
            id: '0',
          },
          {
            data: { id: '1' },
            id: '0',
            subPath: ['hero'],
          },
          {
            data: {
              name: 'Luke',
              shouldBeWithNameDespiteAdditionalDefer: 'Luke',
            },
            id: '1',
            subPath: ['hero'],
          },
        ],
        completed: [{ id: '0' }, { id: '1' }],
        hasNext: false,
      },
    ]);
  });

  it('Nulls cross defer boundaries, null first', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            someField
            b {
              c {
                nonNullErrorField
              }
            }
          }
        }
        a {
          ... @defer {
            b {
              c {
                d
              }
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      a: { b: { c: { d: 'd' } }, someField: 'someField' },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: {},
        },
        pending: [
          { id: '0', path: [] },
          { id: '1', path: ['a'] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: {} } },
            id: '1',
          },
          {
            data: { d: 'd' },
            id: '1',
            subPath: ['b', 'c'],
          },
        ],
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 8, column: 17 }],
                path: ['a', 'b', 'c', 'nonNullErrorField'],
              },
            ],
          },
          { id: '1' },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Nulls cross defer boundaries, value first', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            b {
              c {
                d
              }
            }
          }
        }
        a {
          ... @defer {
            someField
            b {
              c {
                nonNullErrorField
              }
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      a: {
        b: { c: { d: 'd' }, nonNullErrorFIeld: null },
        someField: 'someField',
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: {},
        },
        pending: [
          { id: '0', path: [] },
          { id: '1', path: ['a'] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: {} } },
            id: '1',
          },
          {
            data: { d: 'd' },
            id: '0',
            subPath: ['a', 'b', 'c'],
          },
        ],
        completed: [
          { id: '0' },
          {
            id: '1',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 17, column: 17 }],
                path: ['a', 'b', 'c', 'nonNullErrorField'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Handles multiple erroring deferred grouped field sets', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            b {
              c {
                someError: nonNullErrorField
              }
            }
          }
        }
        ... @defer {
          a {
            b {
              c {
                anotherError: nonNullErrorField
              }
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      a: {
        b: { c: { nonNullErrorField: null } },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [
          { id: '0', path: [] },
          { id: '1', path: [] },
        ],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 7, column: 17 }],
                path: ['a', 'b', 'c', 'someError'],
              },
            ],
          },
          {
            id: '1',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 16, column: 17 }],
                path: ['a', 'b', 'c', 'anotherError'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Handles multiple erroring deferred grouped field sets for the same fragment', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            b {
              someC: c {
                d: d
              }
              anotherC: c {
                d: d
              }
            }
          }
        }
        ... @defer {
          a {
            b {
              someC: c {
                someError: nonNullErrorField
              }
              anotherC: c {
                anotherError: nonNullErrorField
              }
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      a: {
        b: { c: { d: 'd', nonNullErrorField: null } },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [
          { id: '0', path: [] },
          { id: '1', path: [] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { a: { b: { someC: {}, anotherC: {} } } },
            id: '0',
          },
          {
            data: { d: 'd' },
            id: '0',
            subPath: ['a', 'b', 'someC'],
          },
          {
            data: { d: 'd' },
            id: '0',
            subPath: ['a', 'b', 'anotherC'],
          },
        ],
        completed: [
          {
            id: '1',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 19, column: 17 }],
                path: ['a', 'b', 'someC', 'someError'],
              },
            ],
          },
          { id: '0' },
        ],
        hasNext: false,
      },
    ]);
  });

  it('filters a payload with a null that cannot be merged', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            someField
            b {
              c {
                nonNullErrorField
              }
            }
          }
        }
        a {
          ... @defer {
            b {
              c {
                d
              }
            }
          }
        }
      }
    `);
    const result = await complete(
      document,
      {
        a: {
          b: {
            c: {
              d: 'd',
              nonNullErrorField: async () => {
                await resolveOnNextTick();
                return null;
              },
            },
          },
          someField: 'someField',
        },
      },
      true,
    );
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: {},
        },
        pending: [
          { id: '0', path: [] },
          { id: '1', path: ['a'] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: {} } },
            id: '1',
          },
          {
            data: { d: 'd' },
            id: '1',
            subPath: ['b', 'c'],
          },
        ],
        completed: [{ id: '1' }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 8, column: 17 }],
                path: ['a', 'b', 'c', 'nonNullErrorField'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Cancels deferred fields when initial result exhibits null bubbling', async () => {
    const document = parse(`
      query {
        hero {
          nonNullName
        }
        ... @defer {
          hero {
            name
          }
        }
      }
    `);
    const result = await complete(
      document,
      {
        hero: {
          ...hero,
          nonNullName: () => null,
        },
      },
      true,
    );
    expectJSON(result).toDeepEqual({
      data: {
        hero: null,
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Hero.nonNullName.',
          locations: [{ line: 4, column: 11 }],
          path: ['hero', 'nonNullName'],
        },
      ],
    });
  });

  it('Cancels deferred fields when deferred result exhibits null bubbling', async () => {
    const document = parse(`
      query {
        ... @defer {
          hero {
            nonNullName
            name
          }
        }
      }
    `);
    const result = await complete(
      document,
      {
        hero: {
          ...hero,
          nonNullName: () => null,
        },
      },
      true,
    );
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [{ id: '0', path: [] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              hero: null,
            },
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Hero.nonNullName.',
                locations: [{ line: 5, column: 13 }],
                path: ['hero', 'nonNullName'],
              },
            ],
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicates list fields', async () => {
    const document = parse(`
      query {
        hero {
          friends {
            name
          }
          ... @defer {
            friends {
              name
            }
          }
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
        },
      },
    });
  });

  it('Deduplicates async iterable list fields', async () => {
    const document = parse(`
      query {
        hero {
          friends {
            name
          }
          ... @defer {
            friends {
              name
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        friends: async function* resolve() {
          yield await Promise.resolve(friends[0]);
        },
      },
    });
    expectJSON(result).toDeepEqual({
      data: { hero: { friends: [{ name: 'Han' }] } },
    });
  });

  it('Deduplicates empty async iterable list fields', async () => {
    const document = parse(`
      query {
        hero {
          friends {
            name
          }
          ... @defer {
            friends {
              name
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        // eslint-disable-next-line require-yield
        friends: async function* resolve() {
          await resolveOnNextTick();
        },
      },
    });
    expectJSON(result).toDeepEqual({
      data: { hero: { friends: [] } },
    });
  });

  it('Does not deduplicate list fields with non-overlapping fields', async () => {
    const document = parse(`
      query {
        hero {
          friends {
            name
          }
          ... @defer {
            friends {
              id
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
            friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
          },
        },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { id: '2' },
            id: '0',
            subPath: ['friends', 0],
          },
          {
            data: { id: '3' },
            id: '0',
            subPath: ['friends', 1],
          },
          {
            data: { id: '4' },
            id: '0',
            subPath: ['friends', 2],
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('Deduplicates list fields that return empty lists', async () => {
    const document = parse(`
      query {
        hero {
          friends {
            name
          }
          ... @defer {
            friends {
              name
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        friends: () => [],
      },
    });
    expectJSON(result).toDeepEqual({
      data: { hero: { friends: [] } },
    });
  });

  it('Deduplicates null object fields', async () => {
    const document = parse(`
      query {
        hero {
          nestedObject {
            name
          }
          ... @defer {
            nestedObject {
              name
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        nestedObject: () => null,
      },
    });
    expectJSON(result).toDeepEqual({
      data: { hero: { nestedObject: null } },
    });
  });

  it('Deduplicates promise object fields', async () => {
    const document = parse(`
      query {
        hero {
          nestedObject {
            name
          }
          ... @defer {
            nestedObject {
              name
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      hero: {
        nestedObject: () => Promise.resolve({ name: 'foo' }),
      },
    });
    expectJSON(result).toDeepEqual({
      data: { hero: { nestedObject: { name: 'foo' } } },
    });
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
        name
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        name: () => {
          throw new Error('bad');
        },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: null },
            id: '0',
            errors: [
              {
                message: 'bad',
                locations: [{ line: 9, column: 9 }],
                path: ['hero', 'name'],
              },
            ],
          },
        ],
        completed: [{ id: '0' }],
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
        nonNullName
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        nonNullName: () => null,
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Hero.nonNullName.',
                locations: [{ line: 9, column: 9 }],
                path: ['hero', 'nonNullName'],
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
          nonNullName
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        id
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        nonNullName: () => null,
      },
    });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Hero.nonNullName.',
          locations: [
            {
              line: 4,
              column: 11,
            },
          ],
          path: ['hero', 'nonNullName'],
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
        nonNullName
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        nonNullName: () => Promise.resolve(null),
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Hero.nonNullName.',
                locations: [{ line: 9, column: 9 }],
                path: ['hero', 'nonNullName'],
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
        name
        friends {
          ...NestedFragment @defer
        }
      }
      fragment NestedFragment on Friend {
        name
      }
    `);
    const result = await complete(document, {
      hero: {
        ...hero,
        name: async () => {
          await resolveOnNextTick();
          return 'slow';
        },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: { id: '1' },
        },
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        pending: [
          { id: '1', path: ['hero', 'friends', 0] },
          { id: '2', path: ['hero', 'friends', 1] },
          { id: '3', path: ['hero', 'friends', 2] },
        ],
        incremental: [
          {
            data: { name: 'slow', friends: [{}, {}, {}] },
            id: '0',
          },
          { data: { name: 'Han' }, id: '1' },
          { data: { name: 'Leia' }, id: '2' },
          { data: { name: 'C-3PO' }, id: '3' },
        ],
        completed: [{ id: '0' }, { id: '1' }, { id: '2' }, { id: '3' }],
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
        pending: [{ id: '0', path: ['hero'] }],
        hasNext: true,
      },
      {
        pending: [
          { id: '1', path: ['hero', 'friends', 0] },
          { id: '2', path: ['hero', 'friends', 1] },
          { id: '3', path: ['hero', 'friends', 2] },
        ],
        incremental: [
          {
            data: {
              name: 'Luke',
              friends: [{}, {}, {}],
            },
            id: '0',
          },
          { data: { name: 'Han' }, id: '1' },
          { data: { name: 'Leia' }, id: '2' },
          { data: { name: 'C-3PO' }, id: '3' },
        ],
        completed: [{ id: '0' }, { id: '1' }, { id: '2' }, { id: '3' }],
        hasNext: false,
      },
    ]);
  });

  it('Filters deferred payloads when a list item returned by an async iterable is nulled', async () => {
    const document = parse(`
    query {
      hero {
        friends {
          nonNullName
          ...NameFragment @defer
        }
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);
    const result = await complete(document, {
      hero: {
        ...hero,
        async *friends() {
          yield await Promise.resolve({
            ...friends[0],
            nonNullName: () => Promise.resolve(null),
          });
        },
      },
    });
    expectJSON(result).toDeepEqual({
      data: {
        hero: {
          friends: [null],
        },
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Friend.nonNullName.',
          locations: [{ line: 5, column: 11 }],
          path: ['hero', 'friends', 0, 'nonNullName'],
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
      hero { name }
      ... @defer { hero { id } }
    }
  `;
    await expectPromise(
      execute({
        schema,
        document: parse(doc),
        rootValue: {
          hero: {
            ...hero,
            name: async () => {
              await resolveOnNextTick();
              return 'slow';
            },
          },
        },
      }),
    ).toRejectWith(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });
});
