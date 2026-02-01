import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.js';

import { promiseWithResolvers } from '../../../jsutils/promiseWithResolvers.js';

import type { DocumentNode } from '../../../language/ast.js';
import { parse } from '../../../language/parser.js';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../type/definition.js';
import { GraphQLID, GraphQLString } from '../../../type/scalars.js';
import { GraphQLSchema } from '../../../type/schema.js';

import { buildSchema } from '../../../utilities/buildASTSchema.js';

import type {
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../BranchingIncrementalExecutor.js';
import { legacyExecuteIncrementally } from '../legacyExecuteIncrementally.js';

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
    nonNullErrorField: { type: new GraphQLNonNull(GraphQLString) },
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

const cancellationSchema = buildSchema(`
  type Todo {
    id: ID
    items: [String]
    author: User
  }

  type User {
    id: ID
    name: String
  }

  type Query {
    todo: Todo
    nonNullableTodo: Todo!
    blocker: String
    scalarList: [String]
    slowScalarList: [String]
  }

  type Mutation {
    foo: String
    bar: String
  }

  type Subscription {
    foo: String
  }
`);

async function complete(
  document: DocumentNode,
  rootValue: unknown = { hero },
  enableEarlyExecution = false,
) {
  const result = await legacyExecuteIncrementally({
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

async function completeCancellation(
  document: DocumentNode,
  rootValue: unknown,
  abortSignal: AbortSignal,
  enableEarlyExecution = false,
) {
  const result = await legacyExecuteIncrementally({
    schema: cancellationSchema,
    document,
    rootValue,
    enableEarlyExecution,
    abortSignal,
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

describe('Execute: defer directive (legacy)', () => {
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
            label: 'DeferQuery',
          },
        ],
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
            path: [],
            label: 'DeferQuery',
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
            label: 'DeferTop',
          },
          {
            data: {
              friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
            },
            path: ['hero'],
            label: 'DeferNested',
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Emits deferred fragments even when also selected without @defer, deferred fragment is first', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            name: 'Luke',
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
            label: 'DeferTop',
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Skips deferred fragments when also selected without @defer, non-deferred fragment is first', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: 'Luke' },
            path: ['hero'],
            label: 'InlineDeferred',
          },
        ],
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
        hasNext: true,
      },
      {
        incremental: [{ data: { name: 'Luke' }, path: ['hero'] }],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
            label: 'DeferID',
          },
          {
            data: {
              name: 'Luke',
            },
            path: ['hero'],
            label: 'DeferName',
          },
        ],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: { id: '1' } },
            path: [],
            label: 'DeferID',
          },
          {
            data: { hero: { name: 'Luke' } },
            path: [],
            label: 'DeferName',
          },
        ],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: { id: '1' } },
            path: [],
            label: 'DeferID',
          },
          {
            data: { hero: { name: 'Luke' } },
            path: [],
            label: 'DeferName',
          },
        ],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
            label: 'DeferID',
          },
          {
            data: {
              hero: { name: 'Luke' },
            },
            path: [],
            label: 'DeferName',
          },
        ],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              hero: {
                name: 'Luke',
              },
            },
            path: [],
            label: 'DeferName',
          },
          {
            data: {
              id: '1',
            },
            path: ['hero'],
            label: 'DeferID',
          },
        ],
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
    const executeResult = legacyExecuteIncrementally({
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
      hasNext: true,
    });

    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    expect(cResolverCalled).to.equal(false);
    expect(eResolverCalled).to.equal(false);

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            data: { a: {} },
            path: [],
          },
          {
            data: { b: { c: { d: 'd' } } },
            path: ['a'],
          },
        ],
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
        incremental: [
          {
            data: { a: { someField: 'someField' } },
            path: [],
          },
          {
            data: { b: { e: { f: 'f' } } },
            path: ['a'],
          },
        ],
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

  it('Initiates unique deferred grouped field sets together with those that are common to sibling defers', async () => {
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
    const executeResult = legacyExecuteIncrementally({
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
      hasNext: true,
    });

    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    expect(cResolverCalled).to.equal(false);
    expect(eResolverCalled).to.equal(false);

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            data: { a: {} },
            path: [],
          },
          {
            data: { a: {} },
            path: [],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    resolveC();

    expect(cResolverCalled).to.equal(true);
    expect(eResolverCalled).to.equal(true);

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      value: {
        incremental: [
          {
            data: { b: { c: { d: 'd' } } },
            path: ['a'],
          },
          {
            data: { b: { c: { d: 'd' }, e: { f: 'f' } } },
            path: ['a'],
          },
        ],
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

  it('Skips duplicate nested defers on the same object', async () => {
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

  it('Does not deduplicate fields present in the initial payload', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              nestedObject: { deeperObject: { bar: 'bar' } },
              anotherNestedObject: { deeperObject: { foo: 'foo' } },
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate fields present in a parent defer payload', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              nestedObject: {
                deeperObject: { foo: 'foo' },
              },
            },
            path: ['hero'],
          },
          {
            data: {
              foo: 'foo',
              bar: 'bar',
            },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Skips duplicate fields with deferred fragments at multiple levels', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              nestedObject: {
                deeperObject: { foo: 'foo', bar: 'bar' },
              },
            },
            path: ['hero'],
          },
          {
            data: {
              deeperObject: { foo: 'foo', bar: 'bar', baz: 'baz' },
            },
            path: ['hero', 'nestedObject'],
          },
          {
            data: { foo: 'foo', bar: 'bar', baz: 'baz', bak: 'bak' },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate multiple fields from deferred fragments from different branches occurring at the same level', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              foo: 'foo',
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
          {
            data: {
              foo: 'foo',
              bar: 'bar',
            },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate fields with deferred fragments in different branches at multiple non-overlapping levels', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { e: { f: 'f' } },
            path: ['a', 'b'],
          },
          {
            data: { a: { b: { e: { f: 'f' } } }, g: { h: 'h' } },
            path: [],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Correctly bundles varying subfields into incremental data records, duplicating fields from a parent defer', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: { id: '1' } },
            path: [],
          },
          {
            data: {
              hero: {
                name: 'Luke',
                shouldBeWithNameDespiteAdditionalDefer: 'Luke',
              },
            },
            path: [],
          },
          {
            data: {
              shouldBeWithNameDespiteAdditionalDefer: 'Luke',
            },
            path: ['hero'],
          },
        ],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: { d: 'd' } } },
            path: ['a'],
          },
          {
            data: { a: { b: { c: null }, someField: 'someField' } },
            path: [],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: null }, someField: 'someField' },
            path: ['a'],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 17, column: 17 }],
                path: ['a', 'b', 'c', 'nonNullErrorField'],
              },
            ],
          },
          {
            data: { a: { b: { c: { d: 'd' } } } },
            path: [],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Nulls cross defer boundaries, failed fragment with slower overlapping child execution groups, ignores overlap', async () => {
    const document = parse(`
      query {
        ... @defer {
          a {
            someField
            nonNullErrorField
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
              e {
                f
              }
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      a: {
        b: { c: { d: 'd' }, e: { f: 'f' } },
        someField: Promise.resolve('someField'),
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: {},
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { e: { f: 'f' } }, someField: 'someField' },
            path: ['a'],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { a: null },
            path: [],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field a.nonNullErrorField.',
                locations: [{ line: 6, column: 13 }],
                path: ['a', 'nonNullErrorField'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Handles cancelling child deferred fragments if parent fragment fails', async () => {
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
          ... @defer {
            a {
              someField
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: { d: 'd' } } },
            path: ['a'],
          },
          {
            data: { a: { b: { c: null }, someField: 'someField' } },
            path: [],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 8, column: 17 }],
                path: ['a', 'b', 'c', 'nonNullErrorField'],
              },
            ],
          },
          {
            data: { a: { someField: 'someField' } },
            path: [],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Handles multiple erroring deferred grouped field sets', async () => {
    const document = parse(`
      query {
        a {
          b {
            c {
              ... @defer {
                someError: nonNullErrorField
              }
            }
          }
        }
        a {
          b {
            c {
              ... @defer {
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
        data: { a: { b: { c: {} } } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: null,
            path: ['a', 'b', 'c'],
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
            data: null,
            path: ['a', 'b', 'c'],
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
        a {
          b {
            c {
              ... @defer {
                someError: nonNullErrorField
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
        data: { a: { b: { c: {} } } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: null,
            path: ['a', 'b', 'c'],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field c.nonNullErrorField.',
                locations: [{ line: 7, column: 17 }],
                path: ['a', 'b', 'c', 'someError'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('allows payloads with overlapping null and non-null values', async () => {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: { d: 'd' } } },
            path: ['a'],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { a: { b: { c: null }, someField: 'someField' } },
            path: [],
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

  it('Cancels deferred fields when initial result exhibits null bubbling cancelling the defer', async () => {
    const document = parse(`
      query {
        hero {
          nonNullName
          ... @defer {
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

  it('Does not cancel deferred fields when initial result exhibits null bubbling that does not reach the defer point', async () => {
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
    expectJSON(result).toDeepEqual([
      {
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: { name: 'Luke' } },
            path: [],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Keeps deferred work outside nulled error paths', async () => {
    const document = parse(`
      query {
        a {
          ... @defer {
            someField
          }
          nonNullErrorField
        }
        g {
          ... @defer {
            h
          }
        }
      }
    `);
    const result = await complete(document, {
      a: {
        someField: 'someField',
        nonNullErrorField: null,
      },
      g: {
        h: 'value',
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: null,
          g: {},
        },
        errors: [
          {
            message:
              'Cannot return null for non-nullable field a.nonNullErrorField.',
            locations: [{ line: 7, column: 11 }],
            path: ['a', 'nonNullErrorField'],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              h: 'value',
            },
            path: ['g'],
          },
        ],
        hasNext: false,
      },
    ]);
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
            path: [],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate list fields', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate async iterable list fields', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [{ name: 'Han' }] } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { friends: [{ name: 'Han' }] },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate empty async iterable list fields', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [] } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { friends: [] },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              friends: [{ id: '2' }, { id: '3' }, { id: '4' }],
            },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate list fields that return empty lists', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [] } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { friends: [] },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate null object fields', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { nestedObject: null } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { nestedObject: null },
            path: ['hero'],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Does not deduplicate promise object fields', async () => {
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { nestedObject: { name: 'foo' } } },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { nestedObject: { name: 'foo' } },
            path: ['hero'],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: null },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 9, column: 9 }],
                path: ['hero', 'name'],
              },
            ],
            path: ['hero'],
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
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: 'slow', friends: [{}, {}, {}] },
            path: ['hero'],
          },
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
          locations: [{ line: 5, column: 13 }],
          path: ['hero', 'friends', 0, 'nonNullName'],
        },
      ],
    });
  });

  it('should allow deferred execution when passed abortSignal, if not aborted', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... on Todo @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const result = await legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      rootValue: {
        todo: {
          author: { id: '1' },
        },
      },
      abortSignal: abortController.signal,
    });

    assert('initialResult' in result);

    const { initialResult, subsequentResults } = result;

    expectJSON(initialResult).toDeepEqual({
      data: {
        todo: {
          id: null,
        },
      },
      hasNext: true,
    });

    const payload1 = await subsequentResults.next();
    expectJSON(payload1).toDeepEqual({
      done: false,
      value: {
        incremental: [
          {
            data: { author: { id: '1' } },
            path: ['todo'],
          },
        ],
        hasNext: false,
      },
    });
  });

  it('should stop deferred execution when aborted', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... on Todo @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const resultPromise = legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      rootValue: {
        todo: async () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next */
            author: () => expect.fail('Should not be called'),
          }),
      },
      abortSignal: abortController.signal,
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop deferred execution when aborted mid-execution', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        ... on Query @defer {
          todo {
            id
            author {
              id
            }
          }
        }
      }
    `);

    const resultPromise = completeCancellation(
      document,
      {
        todo: () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next 2 */
            author: () =>
              Promise.resolve(() => expect.fail('Should not be called')),
          }),
      },
      abortController.signal,
    );

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('cancels pending deferred execution groups', async () => {
    const abortController = new AbortController();
    const { promise: slowPromise } = promiseWithResolvers<unknown>();
    const document = parse('{ scalarList ... @defer { slowScalarList } }');

    const result = await legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      rootValue: {
        scalarList: () => ['a'],
        slowScalarList: () => slowPromise,
      },
      enableEarlyExecution: true,
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    abortController.abort();

    await expectPromise(iterator.next()).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should ignore deferred payloads resolved after cancellation', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const { promise: authorStarted, resolve: resolveAuthorStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: authorPromise, resolve: resolveAuthor } =
      promiseWithResolvers<{ id: string }>();

    const result = await legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      abortSignal: abortController.signal,
      enableEarlyExecution: true,
      rootValue: {
        todo: {
          id: 'todo',
          author() {
            resolveAuthorStarted();
            return authorPromise;
          },
        },
      },
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextResultPromise = iterator.next();

    await authorStarted;
    abortController.abort();

    resolveAuthor({ id: 'author' });

    await expectPromise(nextResultPromise).toRejectWith(
      'This operation was aborted',
    );
    await expectPromise(authorPromise).toResolve();
  });

  it('should ignore deferred errors after cancellation', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const { promise: authorStarted, resolve: resolveAuthorStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: authorPromise, reject: rejectAuthor } =
      promiseWithResolvers<{ id: string }>();

    const result = await legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      abortSignal: abortController.signal,
      enableEarlyExecution: true,
      rootValue: {
        todo: {
          id: 'todo',
          author() {
            resolveAuthorStarted();
            return authorPromise;
          },
        },
      },
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextResultPromise = iterator.next();

    await authorStarted;
    abortController.abort();

    rejectAuthor(new Error('late error'));

    await expectPromise(nextResultPromise).toRejectWith(
      'This operation was aborted',
    );
    await expectPromise(authorPromise).toRejectWith('late error');
  });
});
