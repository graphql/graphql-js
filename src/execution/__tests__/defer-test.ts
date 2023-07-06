import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isPromise } from '../../jsutils/isPromise.js';

import type { DocumentNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import { parse } from '../../language/parser.js';

import type { FieldDetails } from '../../type/definition.js';
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
} from '../IncrementalPublisher.js';

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

async function complete(document: DocumentNode, rootValue: unknown = { hero }) {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
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
        pending: [{ path: ['hero'] }],
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
        completed: [{ path: ['hero'] }],
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
  it('Can provides correct info about deferred execution state when resolver could defer', async () => {
    let fieldDetails: ReadonlyArray<FieldDetails> | undefined;
    let deferPriority;
    let published;
    let resumed;

    const SomeType = new GraphQLObjectType({
      name: 'SomeType',
      fields: {
        someField: {
          type: GraphQLString,
          resolve: () => Promise.resolve('someField'),
        },
        deferredField: {
          type: GraphQLString,
          resolve: async (_parent, _args, _context, info) => {
            fieldDetails = info.fieldDetails;
            deferPriority = info.deferPriority;
            published = info.published;
            await published;
            resumed = true;
          },
        },
      },
    });

    const someSchema = new GraphQLSchema({ query: SomeType });

    const document = parse(`
      query {
        someField
        ... @defer {
          deferredField
        }
      }
    `);

    const operation = document.definitions[0];
    assert(operation.kind === Kind.OPERATION_DEFINITION);
    const fragment = operation.selectionSet.selections[1];
    assert(fragment.kind === Kind.INLINE_FRAGMENT);
    const field = fragment.selectionSet.selections[0];

    const result = experimentalExecuteIncrementally({
      schema: someSchema,
      document,
    });

    expect(fieldDetails).to.equal(undefined);
    expect(deferPriority).to.equal(undefined);
    expect(published).to.equal(undefined);
    expect(resumed).to.equal(undefined);

    const initialPayload = await result;
    assert('initialResult' in initialPayload);
    const iterator = initialPayload.subsequentResults[Symbol.asyncIterator]();
    await iterator.next();

    assert(fieldDetails !== undefined);
    expect(fieldDetails[0].node).to.equal(field);
    expect(fieldDetails[0].target?.deferPriority).to.equal(1);
    expect(deferPriority).to.equal(1);
    expect(isPromise(published)).to.equal(true);
    expect(resumed).to.equal(true);
  });
  it('Can provides correct info about deferred execution state when deferred field is masked by non-deferred field', async () => {
    let fieldDetails: ReadonlyArray<FieldDetails> | undefined;
    let deferPriority;
    let published;

    const SomeType = new GraphQLObjectType({
      name: 'SomeType',
      fields: {
        someField: {
          type: GraphQLString,
          resolve: (_parent, _args, _context, info) => {
            fieldDetails = info.fieldDetails;
            deferPriority = info.deferPriority;
            published = info.published;
            return 'someField';
          },
        },
      },
    });

    const someSchema = new GraphQLSchema({ query: SomeType });

    const document = parse(`
      query {
        someField
        ... @defer {
          someField
        }
      }
    `);

    const operation = document.definitions[0];
    assert(operation.kind === Kind.OPERATION_DEFINITION);
    const node1 = operation.selectionSet.selections[0];
    const fragment = operation.selectionSet.selections[1];
    assert(fragment.kind === Kind.INLINE_FRAGMENT);
    const node2 = fragment.selectionSet.selections[0];

    const result = experimentalExecuteIncrementally({
      schema: someSchema,
      document,
    });

    const initialPayload = await result;
    assert('initialResult' in initialPayload);
    expect(initialPayload.initialResult).to.deep.equal({
      data: {
        someField: 'someField',
      },
      pending: [{ path: [] }],
      hasNext: true,
    });

    assert(fieldDetails !== undefined);
    expect(fieldDetails[0].node).to.equal(node1);
    expect(fieldDetails[0].target).to.equal(undefined);
    expect(fieldDetails[1].node).to.equal(node2);
    expect(fieldDetails[1].target?.deferPriority).to.equal(1);
    expect(deferPriority).to.equal(0);
    expect(published).to.equal(true);
  });
  it('Can provides correct info about deferred execution state when resolver need not defer', async () => {
    let deferPriority;
    let published;
    const SomeType = new GraphQLObjectType({
      name: 'SomeType',
      fields: {
        deferredField: {
          type: GraphQLString,
          resolve: (_parent, _args, _context, info) => {
            deferPriority = info.deferPriority;
            published = info.published;
          },
        },
      },
    });

    const someSchema = new GraphQLSchema({ query: SomeType });

    const document = parse(`
      query {
        ... @defer {
          deferredField
        }
      }
    `);

    const result = experimentalExecuteIncrementally({
      schema: someSchema,
      document,
    });

    expect(deferPriority).to.equal(undefined);
    expect(published).to.equal(undefined);

    const initialPayload = await result;
    assert('initialResult' in initialPayload);
    const iterator = initialPayload.subsequentResults[Symbol.asyncIterator]();
    await iterator.next();

    expect(deferPriority).to.equal(1);
    expect(published).to.equal(true);
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: 'Luke' },
            path: ['hero'],
          },
        ],
        completed: [{ path: ['hero'] }],
        hasNext: false,
      },
    ]);
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
        pending: [{ path: [], label: 'DeferQuery' }],
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
        completed: [{ path: [], label: 'DeferQuery' }],
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
        pending: [{ path: [], label: 'DeferQuery' }],
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
          },
        ],
        completed: [{ path: [], label: 'DeferQuery' }],
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
        pending: [
          { path: ['hero'], label: 'DeferTop' },
          { path: ['hero'], label: 'DeferNested' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
          },
          {
            data: {
              friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
            },
            path: ['hero'],
          },
        ],
        completed: [
          { path: ['hero'], label: 'DeferTop' },
          { path: ['hero'], label: 'DeferNested' },
        ],
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
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            name: 'Luke',
          },
        },
        pending: [{ path: ['hero'], label: 'DeferTop' }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'], label: 'DeferTop' }],
        hasNext: false,
      },
    ]);
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
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            name: 'Luke',
          },
        },
        pending: [{ path: ['hero'], label: 'DeferTop' }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'], label: 'DeferTop' }],
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
        pending: [{ path: ['hero'], label: 'InlineDeferred' }],
        hasNext: true,
      },
      {
        incremental: [{ data: { name: 'Luke' }, path: ['hero'] }],
        completed: [{ path: ['hero'], label: 'InlineDeferred' }],
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
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {},
        },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
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
          { path: ['hero'], label: 'DeferID' },
          { path: ['hero'], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
          },
          {
            data: {
              name: 'Luke',
            },
            path: ['hero'],
          },
        ],
        completed: [
          { path: ['hero'], label: 'DeferID' },
          { path: ['hero'], label: 'DeferName' },
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
        pending: [
          { path: [], label: 'DeferID' },
          { path: [], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: {} },
            path: [],
          },
          {
            data: { id: '1' },
            path: ['hero'],
          },
          {
            data: { name: 'Luke' },
            path: ['hero'],
          },
        ],
        completed: [
          { path: [], label: 'DeferID' },
          { path: [], label: 'DeferName' },
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
        pending: [
          { path: [], label: 'DeferID' },
          { path: [], label: 'DeferName' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { hero: {} },
            path: [],
          },
          {
            data: { id: '1' },
            path: ['hero'],
          },
          {
            data: { name: 'Luke' },
            path: ['hero'],
          },
        ],
        completed: [
          { path: [], label: 'DeferID' },
          { path: [], label: 'DeferName' },
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
        pending: [
          { path: [], label: 'DeferName' },
          { path: ['hero'], label: 'DeferID' },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
          },
          {
            data: {
              name: 'Luke',
            },
            path: ['hero'],
          },
        ],
        completed: [
          { path: ['hero'], label: 'DeferID' },
          { path: [], label: 'DeferName' },
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
        pending: [{ path: [], label: 'DeferName' }],
        hasNext: true,
      },
      {
        pending: [{ path: ['hero'], label: 'DeferID' }],
        incremental: [
          {
            data: {
              hero: {
                name: 'Luke',
              },
            },
            path: [],
          },
        ],
        completed: [{ path: [], label: 'DeferName' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              id: '1',
            },
            path: ['hero'],
          },
        ],
        completed: [{ path: ['hero'], label: 'DeferID' }],
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
        pending: [
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 2] },
          { path: ['hero', 'friends', 2] },
          { path: ['hero', 'friends', 2] },
          { path: ['hero', 'friends', 2] },
        ],
        hasNext: true,
      },
      {
        incremental: [
          { data: { id: '2', name: 'Han' }, path: ['hero', 'friends', 0] },
          { data: { id: '3', name: 'Leia' }, path: ['hero', 'friends', 1] },
          { data: { id: '4', name: 'C-3PO' }, path: ['hero', 'friends', 2] },
        ],
        completed: [
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 2] },
          { path: ['hero', 'friends', 2] },
          { path: ['hero', 'friends', 2] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 2] },
        ],
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { bar: 'bar' },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        completed: [{ path: ['hero'] }],
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        pending: [{ path: ['hero', 'nestedObject', 'deeperObject'] }],
        incremental: [
          {
            data: {
              nestedObject: {
                deeperObject: { foo: 'foo' },
              },
            },
            path: ['hero'],
          },
        ],
        completed: [{ path: ['hero'] }],
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
        completed: [{ path: ['hero', 'nestedObject', 'deeperObject'] }],
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { bar: 'bar' },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
          {
            data: { baz: 'baz' },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
          {
            data: { bak: 'bak' },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        completed: [
          { path: ['hero'] },
          { path: ['hero', 'nestedObject'] },
          { path: ['hero', 'nestedObject', 'deeperObject'] },
        ],
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
          { path: ['hero'] },
          { path: ['hero', 'nestedObject', 'deeperObject'] },
        ],
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
              bar: 'bar',
            },
            path: ['hero', 'nestedObject', 'deeperObject'],
          },
        ],
        completed: [
          { path: ['hero'] },
          { path: ['hero', 'nestedObject', 'deeperObject'] },
          { path: ['hero', 'nestedObject', 'deeperObject'] },
        ],
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
        pending: [{ path: [] }, { path: ['a', 'b'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { e: { f: 'f' } },
            path: ['a', 'b'],
          },
          {
            data: { g: { h: 'h' } },
            path: [],
          },
        ],
        completed: [{ path: ['a', 'b'] }, { path: [] }],
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
        pending: [{ path: [] }, { path: ['a'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: {} } },
            path: ['a'],
          },
          {
            data: { d: 'd' },
            path: ['a', 'b', 'c'],
          },
        ],
        completed: [
          {
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
          { path: ['a'] },
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
        pending: [{ path: [] }, { path: ['a'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: {} } },
            path: ['a'],
          },
          {
            data: { d: 'd' },
            path: ['a', 'b', 'c'],
          },
        ],
        completed: [
          {
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
          { path: [] },
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
    const result = await complete(document, {
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
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          a: {},
        },
        pending: [{ path: [] }, { path: ['a'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { b: { c: {} } },
            path: ['a'],
          },
          {
            data: { d: 'd' },
            path: ['a', 'b', 'c'],
          },
        ],
        completed: [{ path: ['a'] }],
        hasNext: true,
      },
      {
        completed: [
          {
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
    const result = await complete(document, {
      hero: {
        ...hero,
        nonNullName: () => null,
      },
    });
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
    const result = await complete(document, {
      hero: {
        ...hero,
        nonNullName: () => null,
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {},
        pending: [{ path: [] }],
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
        completed: [{ path: [] }],
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
    expectJSON(result).toDeepEqual([
      {
        data: {
          hero: {
            friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
          },
        },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
        hasNext: false,
      },
    ]);
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [{ name: 'Han' }] } },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
        hasNext: false,
      },
    ]);
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [] } },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { id: '2' },
            path: ['hero', 'friends', 0],
          },
          {
            data: { id: '3' },
            path: ['hero', 'friends', 1],
          },
          {
            data: { id: '4' },
            path: ['hero', 'friends', 2],
          },
        ],
        completed: [{ path: ['hero'] }],
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { friends: [] } },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
        hasNext: false,
      },
    ]);
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { nestedObject: null } },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
        hasNext: false,
      },
    ]);
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
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { nestedObject: { name: 'foo' } } },
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [{ path: ['hero'] }],
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: null },
            path: ['hero'],
            errors: [
              {
                message: 'bad',
                locations: [{ line: 9, column: 9 }],
                path: ['hero', 'name'],
              },
            ],
          },
        ],
        completed: [{ path: ['hero'] }],
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [
          {
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        completed: [
          {
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              name: 'slow',
              friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
            },
            path: ['hero'],
          },
        ],
        completed: [
          { path: ['hero'] },
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 2] },
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
        pending: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        pending: [
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 2] },
        ],
        incremental: [
          {
            data: {
              name: 'Luke',
              friends: [{}, {}, {}],
            },
            path: ['hero'],
          },
        ],
        completed: [{ path: ['hero'] }],
        hasNext: true,
      },
      {
        incremental: [
          { data: { name: 'Han' }, path: ['hero', 'friends', 0] },
          { data: { name: 'Leia' }, path: ['hero', 'friends', 1] },
          { data: { name: 'C-3PO' }, path: ['hero', 'friends', 2] },
        ],
        completed: [
          { path: ['hero', 'friends', 0] },
          { path: ['hero', 'friends', 1] },
          { path: ['hero', 'friends', 2] },
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
