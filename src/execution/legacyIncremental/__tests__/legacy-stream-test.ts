import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.js';

import type { PromiseOrValue } from '../../../jsutils/PromiseOrValue.js';
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
  { name: 'Luke', id: 1 },
  { name: 'Han', id: 2 },
  { name: 'Leia', id: 3 },
];

const query = new GraphQLObjectType({
  fields: {
    scalarList: {
      type: new GraphQLList(GraphQLString),
    },
    scalarListList: {
      type: new GraphQLList(new GraphQLList(GraphQLString)),
    },
    friendList: {
      type: new GraphQLList(friendType),
    },
    nonNullFriendList: {
      type: new GraphQLList(new GraphQLNonNull(friendType)),
    },
    nestedObject: {
      type: new GraphQLObjectType({
        name: 'NestedObject',
        fields: {
          scalarField: {
            type: GraphQLString,
          },
          nonNullScalarField: {
            type: new GraphQLNonNull(GraphQLString),
          },
          nestedFriendList: { type: new GraphQLList(friendType) },
          deeperNestedObject: {
            type: new GraphQLObjectType({
              name: 'DeeperNestedObject',
              fields: {
                nonNullScalarField: {
                  type: new GraphQLNonNull(GraphQLString),
                },
                deeperNestedFriendList: { type: new GraphQLList(friendType) },
              },
            }),
          },
        },
      }),
    },
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

const cancelStreamSchema = buildSchema(`
  type CancelStreamUser {
    id: String
  }

  type CancelStreamTodo {
    id: String
    items: [String]
    author: CancelStreamUser
  }

  type Query {
    todos: [CancelStreamTodo]
  }
`);

async function complete(
  document: DocumentNode,
  rootValue: unknown = {},
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

async function completeAsync(
  document: DocumentNode,
  numCalls: number,
  rootValue: unknown = {},
) {
  const result = await legacyExecuteIncrementally({
    schema,
    document,
    rootValue,
  });

  assert('initialResult' in result);

  const iterator = result.subsequentResults[Symbol.asyncIterator]();

  const promises: Array<
    PromiseOrValue<
      IteratorResult<
        InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
      >
    >
  > = [{ done: false, value: result.initialResult }];
  for (let i = 0; i < numCalls; i++) {
    promises.push(iterator.next());
  }
  return Promise.all(promises);
}

describe('Execute: stream directive (legacy)', () => {
  it('Can stream a list field', async () => {
    const document = parse('{ scalarList @stream(initialCount: 1) }');
    const result = await complete(document, {
      scalarList: () => ['apple', 'banana', 'coconut'],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          scalarList: ['apple'],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: ['banana', 'coconut'],
            path: ['scalarList', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can use default value of initialCount', async () => {
    const document = parse('{ scalarList @stream }');
    const result = await complete(document, {
      scalarList: () => ['apple', 'banana', 'coconut'],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          scalarList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: ['apple', 'banana', 'coconut'],
            path: ['scalarList', 0],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Negative values of initialCount throw field errors', async () => {
    const document = parse('{ scalarList @stream(initialCount: -2) }');
    const result = await complete(document, {
      scalarList: () => ['apple', 'banana', 'coconut'],
    });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'initialCount must be a positive integer',
          locations: [
            {
              line: 1,
              column: 3,
            },
          ],
          path: ['scalarList'],
        },
      ],
      data: {
        scalarList: null,
      },
    });
  });
  it('Returns label from stream directive', async () => {
    const document = parse(
      '{ scalarList @stream(initialCount: 1, label: "scalar-stream") }',
    );
    const result = await complete(document, {
      scalarList: () => ['apple', 'banana', 'coconut'],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          scalarList: ['apple'],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: ['banana', 'coconut'],
            path: ['scalarList', 1],
            label: 'scalar-stream',
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can disable @stream using if argument', async () => {
    const document = parse(
      '{ scalarList @stream(initialCount: 0, if: false) }',
    );
    const result = await complete(document, {
      scalarList: () => ['apple', 'banana', 'coconut'],
    });
    expectJSON(result).toDeepEqual({
      data: { scalarList: ['apple', 'banana', 'coconut'] },
    });
  });
  it('Does not disable stream with null if argument', async () => {
    const document = parse(
      'query ($shouldStream: Boolean) { scalarList @stream(initialCount: 2, if: $shouldStream) }',
    );
    const result = await complete(document, {
      scalarList: () => ['apple', 'banana', 'coconut'],
    });
    expectJSON(result).toDeepEqual([
      {
        data: { scalarList: ['apple', 'banana'] },
        hasNext: true,
      },
      {
        incremental: [{ items: ['coconut'], path: ['scalarList', 2] }],
        hasNext: false,
      },
    ]);
  });
  it('Can stream multi-dimensional lists', async () => {
    const document = parse('{ scalarListList @stream(initialCount: 1) }');
    const result = await complete(document, {
      scalarListList: () => [
        ['apple', 'apple', 'apple'],
        ['banana', 'banana', 'banana'],
        ['coconut', 'coconut', 'coconut'],
      ],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          scalarListList: [['apple', 'apple', 'apple']],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [
              ['banana', 'banana', 'banana'],
              ['coconut', 'coconut', 'coconut'],
            ],
            path: ['scalarListList', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns a list of promises', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      friendList: () => friends.map((f) => Promise.resolve(f)),
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [
            {
              name: 'Luke',
              id: '1',
            },
            {
              name: 'Han',
              id: '2',
            },
          ],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [
              {
                name: 'Leia',
                id: '3',
              },
            ],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can stream in correct order with lists of promises', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      friendList: () => friends.map((f) => Promise.resolve(f)),
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Luke', id: '1' }],
            path: ['friendList', 0],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Han', id: '2' }],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Leia', id: '3' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Does not execute early if not specified', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `);
    const order: Array<number> = [];
    const result = await complete(document, {
      friendList: () =>
        friends.map((f, i) => ({
          id: async () => {
            const slowness = 3 - i;
            for (let j = 0; j < slowness; j++) {
              // eslint-disable-next-line no-await-in-loop
              await resolveOnNextTick();
            }
            order.push(i);
            return f.id;
          },
        })),
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '1' }],
            path: ['friendList', 0],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '2' }],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '3' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
    expect(order).to.deep.equal([0, 1, 2]);
  });
  it('Executes early if specified', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `);
    const order: Array<number> = [];
    const result = await complete(
      document,
      {
        friendList: () =>
          friends.map((f, i) => ({
            id: async () => {
              const slowness = 3 - i;
              for (let j = 0; j < slowness; j++) {
                // eslint-disable-next-line no-await-in-loop
                await resolveOnNextTick();
              }
              order.push(i);
              return f.id;
            },
          })),
      },
      true,
    );
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '1' }, { id: '2' }, { id: '3' }],
            path: ['friendList', 0],
          },
        ],
        hasNext: false,
      },
    ]);
    expect(order).to.deep.equal([2, 1, 0]);
  });
  it('Can stream a field that returns a list with nested promises', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      friendList: () =>
        friends.map((f) => ({
          name: Promise.resolve(f.name),
          id: Promise.resolve(f.id),
        })),
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [
            {
              name: 'Luke',
              id: '1',
            },
            {
              name: 'Han',
              id: '2',
            },
          ],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [
              {
                name: 'Leia',
                id: '3',
              },
            ],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles rejections in a field that returns a list of promises before initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      friendList: () =>
        friends.map((f, i) => {
          if (i === 1) {
            return Promise.reject(new Error('bad'));
          }
          return Promise.resolve(f);
        }),
    });
    expectJSON(result).toDeepEqual([
      {
        errors: [
          {
            message: 'bad',
            locations: [{ line: 3, column: 9 }],
            path: ['friendList', 1],
          },
        ],
        data: {
          friendList: [{ name: 'Luke', id: '1' }, null],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Leia', id: '3' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles rejections in a field that returns a list of promises after initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      friendList: () =>
        friends.map((f, i) => {
          if (i === 1) {
            return Promise.reject(new Error('bad'));
          }
          return Promise.resolve(f);
        }),
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [{ name: 'Luke', id: '1' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message: 'bad',
                locations: [{ line: 3, column: 9 }],
                path: ['friendList', 1],
              },
            ],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Leia', id: '3' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns an async iterable', async () => {
    const document = parse(`
      query {
        friendList @stream {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Luke', id: '1' }],
            path: ['friendList', 0],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [
              { name: 'Han', id: '2' },
              { name: 'Leia', id: '3' },
            ],
            path: ['friendList', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns an async iterable, using a non-zero initialCount', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [
            { name: 'Luke', id: '1' },
            { name: 'Han', id: '2' },
          ],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Leia', id: '3' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Negative values of initialCount throw field errors on a field that returns an async iterable', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: -2) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        // no-op, not called
      },
    });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'initialCount must be a positive integer',
          locations: [{ line: 3, column: 9 }],
          path: ['friendList'],
        },
      ],
      data: {
        friendList: null,
      },
    });
  });
  it('Does not execute early if not specified, when streaming from an async iterable', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `);
    const order: Array<number> = [];
    // eslint-disable-next-line @typescript-eslint/require-await
    const slowFriend = async (n: number) => ({
      id: async () => {
        const slowness = (3 - n) * 10;
        for (let j = 0; j < slowness; j++) {
          // eslint-disable-next-line no-await-in-loop
          await resolveOnNextTick();
        }
        order.push(n);
        return friends[n].id;
      },
    });
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve(slowFriend(0));
        yield await Promise.resolve(slowFriend(1));
        yield await Promise.resolve(slowFriend(2));
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '1' }],
            path: ['friendList', 0],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '2' }],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '3' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
    expect(order).to.deep.equal([0, 1, 2]);
  });
  it('Executes early if specified when streaming from an async iterable', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `);
    const order: Array<number> = [];
    const slowFriend = (n: number) => ({
      id: async () => {
        const slowness = (3 - n) * 10;
        for (let j = 0; j < slowness; j++) {
          // eslint-disable-next-line no-await-in-loop
          await resolveOnNextTick();
        }
        order.push(n);
        return friends[n].id;
      },
    });
    const result = await complete(
      document,
      {
        async *friendList() {
          yield await Promise.resolve(slowFriend(0));
          yield await Promise.resolve(slowFriend(1));
          yield await Promise.resolve(slowFriend(2));
        },
      },
      true,
    );
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '1' }, { id: '2' }, { id: '3' }],
            path: ['friendList', 0],
          },
        ],
        hasNext: false,
      },
    ]);
    expect(order).to.deep.equal([2, 1, 0]);
  });
  it('Can handle concurrent calls to .next() without waiting', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await completeAsync(document, 2, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    });
    expectJSON(result).toDeepEqual([
      {
        done: false,
        value: {
          data: {
            friendList: [
              { name: 'Luke', id: '1' },
              { name: 'Han', id: '2' },
            ],
          },
          hasNext: true,
        },
      },
      {
        done: false,
        value: {
          incremental: [
            {
              items: [{ name: 'Leia', id: '3' }],
              path: ['friendList', 2],
            },
          ],
          hasNext: false,
        },
      },
      { done: true, value: undefined },
    ]);
  });
  it('Handles error thrown in async iterable before initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        throw new Error('bad');
      },
    });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'bad',
          locations: [{ line: 3, column: 9 }],
          path: ['friendList'],
        },
      ],
      data: {
        friendList: null,
      },
    });
  });
  it('Handles error thrown in async iterable after initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        throw new Error('bad');
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [{ name: 'Luke', id: '1' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['friendList'],
            errors: [
              {
                message: 'bad',
                locations: [{ line: 3, column: 9 }],
                path: ['friendList'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles null returned in non-null list items after initialCount is reached', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          name
        }
      }
    `);
    const result = await complete(document, {
      nonNullFriendList: () => [friends[0], null, friends[1]],
    });

    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ name: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Query.nonNullFriendList.',
                locations: [{ line: 3, column: 9 }],
                path: ['nonNullFriendList', 1],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles null returned in non-null async iterable list items after initialCount is reached', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          name
        }
      }
    `);
    const result = await complete(document, {
      async *nonNullFriendList() {
        try {
          yield await Promise.resolve(friends[0]);
          yield await Promise.resolve(null); /* c8 ignore start */
          // Not reachable, early return
        } finally {
          /* c8 ignore stop */
          // eslint-disable-next-line no-unsafe-finally
          throw new Error('Oops');
        }
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ name: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Query.nonNullFriendList.',
                locations: [{ line: 3, column: 9 }],
                path: ['nonNullFriendList', 1],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles errors thrown by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query {
        scalarList @stream(initialCount: 1)
      }
    `);
    const result = await complete(document, {
      scalarList: () => [friends[0].name, {}],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          scalarList: ['Luke'],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message: 'String cannot represent value: {}',
                locations: [{ line: 3, column: 9 }],
                path: ['scalarList', 1],
              },
            ],
            path: ['scalarList', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    const result = await complete(document, {
      friendList: () => [
        Promise.resolve({ nonNullName: friends[0].name }),
        Promise.resolve({
          nonNullName: () => Promise.reject(new Error('Oops')),
        }),
        Promise.resolve({ nonNullName: friends[1].name }),
      ],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['friendList', 1, 'nonNullName'],
              },
            ],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ nonNullName: 'Han' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles nested async errors thrown by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    const result = await complete(document, {
      friendList: () => [
        { nonNullName: Promise.resolve(friends[0].name) },
        { nonNullName: Promise.reject(new Error('Oops')) },
        { nonNullName: Promise.resolve(friends[1].name) },
      ],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['friendList', 1, 'nonNullName'],
              },
            ],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ nonNullName: 'Han' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached for a non-nullable list', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    const result = await complete(document, {
      nonNullFriendList: () => [
        Promise.resolve({ nonNullName: friends[0].name }),
        Promise.resolve({
          nonNullName: () => Promise.reject(new Error('Oops')),
        }),
        Promise.resolve({ nonNullName: friends[1].name }),
      ],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['nonNullFriendList', 1, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles nested async errors thrown by completeValue after initialCount is reached for a non-nullable list', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    const result = await complete(document, {
      nonNullFriendList: () => [
        { nonNullName: Promise.resolve(friends[0].name) },
        { nonNullName: Promise.reject(new Error('Oops')) },
        { nonNullName: Promise.resolve(friends[1].name) },
      ],
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['nonNullFriendList', 1, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached from async iterable', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve({ nonNullName: friends[0].name });
        yield await Promise.resolve({
          nonNullName: () => Promise.reject(new Error('Oops')),
        });
        yield await Promise.resolve({ nonNullName: friends[1].name });
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['friendList', 1, 'nonNullName'],
              },
            ],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ nonNullName: 'Han' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached from async generator for a non-nullable list', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    const result = await complete(document, {
      async *nonNullFriendList() {
        yield await Promise.resolve({ nonNullName: friends[0].name });
        yield await Promise.resolve({
          nonNullName: () => Promise.reject(new Error('Oops')),
        }); /* c8 ignore start */
      } /* c8 ignore stop */,
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['nonNullFriendList', 1, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached from async iterable for a non-nullable list when the async iterable does not provide a return method) ', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    let count = 0;
    const result = await complete(document, {
      nonNullFriendList: {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            switch (count++) {
              case 0:
                return Promise.resolve({
                  done: false,
                  value: { nonNullName: friends[0].name },
                });
              case 1:
                return Promise.resolve({
                  done: false,
                  value: {
                    nonNullName: () => Promise.reject(new Error('Oops')),
                  },
                });
              // Not reached
              /* c8 ignore next 5 */
              case 2:
                return Promise.resolve({
                  done: false,
                  value: { nonNullName: friends[1].name },
                });
            }
          },
        }),
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['nonNullFriendList', 1, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached from async iterable for a non-nullable list when the async iterable provides concurrent next/return methods and has a slow return ', async () => {
    const document = parse(`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `);
    let count = 0;
    let returned = false;
    const result = await complete(document, {
      nonNullFriendList: {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            /* c8 ignore next 3 */
            if (returned) {
              return Promise.resolve({ done: true });
            }
            switch (count++) {
              case 0:
                return Promise.resolve({
                  done: false,
                  value: { nonNullName: friends[0].name },
                });
              case 1:
                return Promise.resolve({
                  done: false,
                  value: {
                    nonNullName: () => Promise.reject(new Error('Oops')),
                  },
                });
              // Not reached
              /* c8 ignore next 5 */
              case 2:
                return Promise.resolve({
                  done: false,
                  value: { nonNullName: friends[1].name },
                });
            }
          },
          return: async () => {
            await resolveOnNextTick();
            returned = true;
            return { done: true };
          },
        }),
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nonNullFriendList: [{ nonNullName: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: null,
            path: ['nonNullFriendList'],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['nonNullFriendList', 1, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
    expect(returned).to.equal(true);
  });
  it('Filters payloads that are nulled', async () => {
    const document = parse(`
      query {
        nestedObject {
          nonNullScalarField
          nestedFriendList @stream(initialCount: 0) {
            name
          }
        }
      }
    `);
    const result = await complete(document, {
      nestedObject: {
        nonNullScalarField: () => Promise.resolve(null),
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]); /* c8 ignore start */
        } /* c8 ignore stop */,
      },
    });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Cannot return null for non-nullable field NestedObject.nonNullScalarField.',
          locations: [{ line: 4, column: 11 }],
          path: ['nestedObject', 'nonNullScalarField'],
        },
      ],
      data: {
        nestedObject: null,
      },
    });
  });
  it('Filters payloads that are nulled by a later synchronous error', async () => {
    const document = parse(`
      query {
        nestedObject {
          nestedFriendList @stream(initialCount: 0) {
            name
          }
          nonNullScalarField
        }
      }
    `);
    const result = await complete(document, {
      nestedObject: {
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]); /* c8 ignore start */
        } /* c8 ignore stop */,
        nonNullScalarField: () => null,
      },
    });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Cannot return null for non-nullable field NestedObject.nonNullScalarField.',
          locations: [{ line: 7, column: 11 }],
          path: ['nestedObject', 'nonNullScalarField'],
        },
      ],
      data: {
        nestedObject: null,
      },
    });
  });
  it('Does not filter payloads when null error is in a different path', async () => {
    const document = parse(`
      query {
        otherNestedObject: nestedObject {
          ... @defer {
            scalarField
          }
        }
        nestedObject {
          nestedFriendList @stream(initialCount: 0) {
            name
          }
        }
      }
    `);
    const result = await complete(document, {
      nestedObject: {
        scalarField: () => Promise.reject(new Error('Oops')),
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]);
        },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          otherNestedObject: {},
          nestedObject: { nestedFriendList: [] },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { scalarField: null },
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 5, column: 13 }],
                path: ['otherNestedObject', 'scalarField'],
              },
            ],
            path: ['otherNestedObject'],
          },
          {
            items: [{ name: 'Luke' }],
            path: ['nestedObject', 'nestedFriendList', 0],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Cancels async stream items when null bubbles past the stream', async () => {
    const document = parse(`
      query {
        nestedObject {
          nestedFriendList @stream(initialCount: 0) {
            name
          }
          nonNullScalarField
        }
      }
    `);
    const { promise: friendsStarted, resolve: resolveFriendsStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: nonNullPromise, resolve: resolveNonNull } =
      promiseWithResolvers<string | null>();
    const { promise: namePromise, resolve: resolveName } =
      promiseWithResolvers<string>();

    const resultPromise = legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        nestedObject: {
          nestedFriendList() {
            resolveFriendsStarted();
            return [{ name: namePromise }];
          },
          nonNullScalarField() {
            return nonNullPromise;
          },
        },
      },
      enableEarlyExecution: true,
    });

    await friendsStarted;
    await resolveOnNextTick();
    resolveNonNull(null);

    const result = await resultPromise;
    assert(!('initialResult' in result));
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Cannot return null for non-nullable field NestedObject.nonNullScalarField.',
          locations: [{ line: 7, column: 11 }],
          path: ['nestedObject', 'nonNullScalarField'],
        },
      ],
      data: {
        nestedObject: null,
      },
    });

    resolveName('Luke');
  });
  it('Filters stream payloads that are nulled in a deferred payload', async () => {
    const document = parse(`
      query {
        nestedObject {
          ... @defer {
            deeperNestedObject {
              nonNullScalarField
              deeperNestedFriendList @stream(initialCount: 0) {
                name
              }
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      nestedObject: {
        deeperNestedObject: {
          nonNullScalarField: () => Promise.resolve(null),
          async *deeperNestedFriendList() {
            yield await Promise.resolve(friends[0]); /* c8 ignore start */
          } /* c8 ignore stop */,
        },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nestedObject: {},
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              deeperNestedObject: null,
            },
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field DeeperNestedObject.nonNullScalarField.',
                locations: [{ line: 6, column: 15 }],
                path: [
                  'nestedObject',
                  'deeperNestedObject',
                  'nonNullScalarField',
                ],
              },
            ],
            path: ['nestedObject'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Filters defer payloads that are nulled in a stream response', async () => {
    const document = parse(`
    query {
      friendList @stream(initialCount: 0) {
        nonNullName
        ... @defer {
          name
        }
      }
    }
  `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve({
          name: friends[0].name,
          nonNullName: () => Promise.resolve(null),
        });
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Friend.nonNullName.',
                locations: [{ line: 4, column: 9 }],
                path: ['friendList', 0, 'nonNullName'],
              },
            ],
            path: ['friendList', 0],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Returns iterator and ignores errors when stream payloads are filtered', async () => {
    let returned = false;
    let requested = false;
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          /* c8 ignore start */
          if (requested) {
            // stream is filtered, next is not called, and so this is not reached.
            return Promise.reject(new Error('Oops'));
          } /* c8 ignore stop */
          requested = true;
          const friend = friends[0];
          return Promise.resolve({
            done: false,
            value: {
              name: friend.name,
              nonNullName: null,
            },
          });
        },
        return: () => {
          returned = true;
          // Ignores errors from return.
          return Promise.reject(new Error('Oops'));
        },
      }),
    };

    const document = parse(`
      query {
        nestedObject {
          ... @defer {
            deeperNestedObject {
              nonNullScalarField
              deeperNestedFriendList @stream(initialCount: 0) {
                name
              }
            }
          }
        }
      }
    `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        nestedObject: {
          deeperNestedObject: {
            nonNullScalarField: () => Promise.resolve(null),
            deeperNestedFriendList: iterable,
          },
        },
      },
      enableEarlyExecution: true,
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        nestedObject: {},
      },
      hasNext: true,
    });

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      done: false,
      value: {
        incremental: [
          {
            data: {
              deeperNestedObject: null,
            },
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field DeeperNestedObject.nonNullScalarField.',
                locations: [{ line: 6, column: 15 }],
                path: [
                  'nestedObject',
                  'deeperNestedObject',
                  'nonNullScalarField',
                ],
              },
            ],
            path: ['nestedObject'],
          },
        ],
        hasNext: false,
      },
    });

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({ done: true, value: undefined });

    assert(returned);
  });
  it('Handles promises returned by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          id
          name
        }
      }
    `);
    const result = await complete(document, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve({
          id: friends[2].id,
          name: () => Promise.resolve(friends[2].name),
        });
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          friendList: [{ id: '1', name: 'Luke' }],
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '2', name: 'Han' }],
            path: ['friendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '3', name: 'Leia' }],
            path: ['friendList', 2],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles overlapping deferred and non-deferred streams', async () => {
    const document = parse(`
      query {
        nestedObject {
          nestedFriendList @stream(initialCount: 0) {
            id
          }
        }
        nestedObject {
          ... @defer {
            nestedFriendList @stream(initialCount: 0) {
              id
              name
            }
          }
        }
      }
    `);
    const result = await complete(document, {
      nestedObject: {
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]);
          yield await Promise.resolve(friends[1]);
        },
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: {
          nestedObject: {
            nestedFriendList: [],
          },
        },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              nestedFriendList: [],
            },
            path: ['nestedObject'],
          },
          {
            items: [{ id: '1' }],
            path: ['nestedObject', 'nestedFriendList', 0],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '1', name: 'Luke' }],
            path: ['nestedObject', 'nestedFriendList', 0],
          },
          {
            items: [{ id: '2' }],
            path: ['nestedObject', 'nestedFriendList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ id: '2', name: 'Han' }],
            path: ['nestedObject', 'nestedFriendList', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Re-promotes a completed stream when a slower sibling defer resolves later', async () => {
    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers<string>();
    const document = parse(`
      query {
        nestedObject {
          ... @defer {
            nestedFriendList @stream { name }
          }
          ... @defer {
            scalarField
            nestedFriendList @stream { name }
          }
        }
      }
    `);
    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        nestedObject: {
          nestedFriendList: () => friends,
          scalarField: slowFieldPromise,
        },
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        nestedObject: {},
      },
      hasNext: true,
    });

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            data: {
              nestedFriendList: [],
            },
            path: ['nestedObject'],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    resolveSlowField('slow');

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ name: 'Luke' }, { name: 'Han' }, { name: 'Leia' }],
            path: ['nestedObject', 'nestedFriendList', 0],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: {
        incremental: [
          {
            data: {
              nestedFriendList: [],
              scalarField: 'slow',
            },
            path: ['nestedObject'],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result5 = await iterator.next();
    expectJSON(result5).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ name: 'Luke' }, { name: 'Han' }, { name: 'Leia' }],
            path: ['nestedObject', 'nestedFriendList', 0],
          },
        ],
        hasNext: false,
      },
      done: false,
    });

    const result6 = await iterator.next();
    expectJSON(result6).toDeepEqual({
      done: true,
      value: undefined,
    });
  });
  it('Returns payloads in correct order when parent deferred fragment resolves slower than stream', async () => {
    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    const document = parse(`
      query {
        nestedObject {
          ... DeferFragment @defer
        }
      }
      fragment DeferFragment on NestedObject {
        scalarField
        nestedFriendList @stream(initialCount: 0) {
          name
        }
      }
    `);
    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        nestedObject: {
          scalarField: () => slowFieldPromise,
          async *nestedFriendList() {
            yield await Promise.resolve(friends[0]);
            yield await Promise.resolve(friends[1]);
          },
        },
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        nestedObject: {},
      },
      hasNext: true,
    });

    const result2Promise = iterator.next();
    resolveSlowField('slow');
    const result2 = await result2Promise;
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            data: { scalarField: 'slow', nestedFriendList: [] },
            path: ['nestedObject'],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ name: 'Luke' }],
            path: ['nestedObject', 'nestedFriendList', 0],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ name: 'Han' }],
            path: ['nestedObject', 'nestedFriendList', 1],
          },
        ],
        hasNext: false,
      },
      done: false,
    });

    const result5 = await iterator.next();
    expectJSON(result5).toDeepEqual({
      value: undefined,
      done: true,
    });
  });
  it('Can @defer fields that are resolved after async iterable is complete', async () => {
    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    const {
      promise: iterableCompletionPromise,
      resolve: resolveIterableCompletion,
    } = promiseWithResolvers();

    const document = parse(`
    query {
      friendList @stream(label:"stream-label") {
        ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        async *friendList() {
          yield await Promise.resolve(friends[0]);
          yield await Promise.resolve({
            id: friends[1].id,
            name: () => slowFieldPromise,
          });
          await iterableCompletionPromise;
        },
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        friendList: [],
      },
      hasNext: true,
    });

    const result2Promise = iterator.next();
    resolveIterableCompletion(null);
    const result2 = await result2Promise;
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ id: '1' }],
            path: ['friendList', 0],
            label: 'stream-label',
          },
          {
            data: { name: 'Luke' },
            path: ['friendList', 0],
            label: 'DeferName',
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result3Promise = iterator.next();
    resolveSlowField('Han');
    const result3 = await result3Promise;
    expectJSON(result3).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ id: '2' }],
            path: ['friendList', 1],
            label: 'stream-label',
          },
        ],
        hasNext: true,
      },
      done: false,
    });
    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: {
        incremental: [
          {
            data: { name: 'Han' },
            path: ['friendList', 1],
            label: 'DeferName',
          },
        ],
        hasNext: false,
      },
      done: false,
    });
    const result5 = await iterator.next();
    expectJSON(result5).toDeepEqual({
      value: undefined,
      done: true,
    });
  });
  it('Can @defer fields that are resolved before async iterable is complete', async () => {
    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    const {
      promise: iterableCompletionPromise,
      resolve: resolveIterableCompletion,
    } = promiseWithResolvers();

    const document = parse(`
    query {
      friendList @stream(initialCount: 1, label:"stream-label") {
        ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        async *friendList() {
          yield await Promise.resolve(friends[0]);
          yield await Promise.resolve({
            id: friends[1].id,
            name: () => slowFieldPromise,
          });
          await iterableCompletionPromise;
        },
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        friendList: [{ id: '1' }],
      },
      hasNext: true,
    });

    const result2Promise = iterator.next();
    resolveSlowField('Han');
    const result2 = await result2Promise;
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            data: { name: 'Luke' },
            path: ['friendList', 0],
            label: 'DeferName',
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      value: {
        incremental: [
          {
            items: [{ id: '2' }],
            path: ['friendList', 1],
            label: 'stream-label',
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: {
        incremental: [
          {
            data: { name: 'Han' },
            path: ['friendList', 1],
            label: 'DeferName',
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const result5Promise = iterator.next();
    resolveIterableCompletion(null);
    const result5 = await result5Promise;
    expectJSON(result5).toDeepEqual({
      value: {
        hasNext: false,
      },
      done: false,
    });

    const result6 = await iterator.next();
    expectJSON(result6).toDeepEqual({
      value: undefined,
      done: true,
    });
  });
  it('Returns underlying async iterables when returned generator is returned', async () => {
    let returned = false;
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise(() => {
            /* never resolves */
          }),
        return: () => {
          returned = true;
        },
      }),
    };

    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        friendList: iterable,
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        friendList: [],
      },
      hasNext: true,
    });

    const result2Promise = iterator.next();
    const returnPromise = iterator.return();

    const result2 = await result2Promise;
    expectJSON(result2).toDeepEqual({
      done: true,
      value: undefined,
    });
    await returnPromise;
    assert(returned);
  });
  it('Can return async iterable when underlying iterable does not have a return method', async () => {
    let index = 0;
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          const friend = friends[index++];
          if (friend == null) {
            return Promise.resolve({ done: true, value: undefined });
          }
          return Promise.resolve({ done: false, value: friend });
        },
      }),
    };

    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          name
          id
        }
      }
    `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        friendList: iterable,
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        friendList: [
          {
            id: '1',
            name: 'Luke',
          },
        ],
      },
      hasNext: true,
    });

    await iterator.return();

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      done: true,
      value: undefined,
    });
  });
  it('Returns underlying async iterables when returned generator is thrown', async () => {
    let index = 0;
    let returned = false;
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          const friend = friends[index++];
          if (friend == null) {
            return Promise.resolve({ done: true, value: undefined });
          }
          return Promise.resolve({ done: false, value: friend });
        },
        return: () => {
          returned = true;
        },
      }),
    };
    const document = parse(`
      query {
        friendList @stream(initialCount: 1) {
          ... @defer {
            name
          }
          id
        }
      }
    `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        friendList: iterable,
      },
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        friendList: [
          {
            id: '1',
          },
        ],
      },
      hasNext: true,
    });

    await expectPromise(iterator.throw(new Error('bad'))).toRejectWith('bad');

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      done: true,
      value: undefined,
    });

    assert(returned);
  });
  it('Returns underlying async iterables when uses resource is disposed', async () => {
    let index = 0;
    let returned = false;
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          const friend = friends[index++];
          if (friend == null) {
            return Promise.resolve({ done: true, value: undefined });
          }
          return Promise.resolve({ done: false, value: friend });
        },
        return: () => {
          returned = true;
        },
      }),
    };

    const document = parse(`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        friendList: iterable,
      },
    });
    assert('initialResult' in executeResult);

    {
      await using iterator =
        executeResult.subsequentResults[Symbol.asyncIterator]();

      const result1 = executeResult.initialResult;
      expectJSON(result1).toDeepEqual({
        data: {
          friendList: [],
        },
        hasNext: true,
      });

      expectJSON(await iterator.next()).toDeepEqual({
        done: false,
        value: {
          incremental: [
            {
              items: [{ id: '1' }, { id: '2' }],
              path: ['friendList', 0],
            },
          ],
          hasNext: true,
        },
      });
    }

    assert(returned);
  });
  it('limits stream batches to the default capacity (100)', async () => {
    const document = parse(`
      query {
        friendList @stream {
          id
        }
      }
    `);

    const executeResult = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        async *friendList() {
          for (let i = 0; i < 101; i++) {
            // eslint-disable-next-line no-await-in-loop
            yield await Promise.resolve(friends[i % 3]);
          }
        },
      },
      enableEarlyExecution: true,
    });
    assert('initialResult' in executeResult);
    const iterator = executeResult.subsequentResults[Symbol.asyncIterator]();

    const result1 = executeResult.initialResult;
    expectJSON(result1).toDeepEqual({
      data: {
        friendList: [],
      },
      hasNext: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      done: false,
      value: {
        incremental: [
          {
            items: Array.from({ length: 100 }, (_, i) => ({
              id: ((i % 3) + 1).toString(),
            })),
            path: ['friendList', 0],
          },
        ],
        hasNext: true,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
      done: false,
      value: {
        incremental: [
          {
            items: [{ id: '2' }],
            path: ['friendList', 100],
          },
        ],
        hasNext: false,
      },
    });

    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      done: true,
      value: undefined,
    });
  });
});

describe('Execute: stream directive (legacy cancellation)', () => {
  it('should stop streamed execution when aborted', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items @stream
        }
      }
    `);

    const resultPromise = (async () => {
      const result = await legacyExecuteIncrementally({
        schema: cancellationSchema,
        document,
        rootValue: {
          todo: {
            id: '1',
            items: [Promise.resolve('item')],
          },
        },
        abortSignal: abortController.signal,
      });

      if ('initialResult' in result) {
        for await (const _patch of result.subsequentResults) {
          // Consume to surface cancellation.
        }
      }
      return result;
    })();

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('cancels streaming when aborted during async iterator next', async () => {
    const abortController = new AbortController();
    const document = parse('{ scalarList @stream(initialCount: 0) }');

    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: nextReturned, resolve: resolveNextReturned } =
      promiseWithResolvers<IteratorResult<unknown>>();
    let done = false;
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        done = true;
        resolveNextStarted();
        return nextReturned;
      },
    };

    const result = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        scalarList: () => asyncIterator,
      },
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextPromise = iterator.next();
    await nextStarted;
    abortController.abort();

    resolveNextReturned({ value: 'value', done: false });
    await expectPromise(nextPromise).toRejectWith('This operation was aborted');
  });

  it('cancels streaming when aborted while item promise is pending', async () => {
    const abortController = new AbortController();
    const document = parse('{ scalarList @stream(initialCount: 0) }');

    const { promise: itemPromise, resolve: resolveItem } =
      promiseWithResolvers<string>();
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let done = false;
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        done = true;
        resolveNextStarted();
        return Promise.resolve({ value: itemPromise, done: false });
      },
    };

    const result = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        scalarList: () => asyncIterator,
      },
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextPromise = iterator.next();
    await nextStarted;
    abortController.abort();

    resolveItem('value');
    await expectPromise(nextPromise).toRejectWith('This operation was aborted');
  });

  it('stops when the stream queue is back-pressured and the consumer cancels', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const { promise: reachedCapacity, resolve: resolveReachedCapacity } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let count = 0;
    let done = false;
    const iterator = {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (done) {
          return { value: undefined, done: true };
        }
        count += 1;
        if (count === 100) {
          resolveReachedCapacity();
        }
        if (count > 100) {
          done = true;
        }
        return { value: String(count), done: false };
      },
    };

    const result = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        scalarList: () => iterator,
      },
      enableEarlyExecution: true,
    });
    assert('initialResult' in result);

    await reachedCapacity;
    await resolveOnNextTick();
    const stream = result.subsequentResults[Symbol.asyncIterator]();
    await expectPromise(stream.return()).toResolve();
  });

  it('cancels tasks and streams when aborted before initial execution finishes', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items @stream(initialCount: 0)
          ... @defer {
            author {
              id
            }
          }
        }
        blocker
      }
    `);

    const { promise: blockerPromise, resolve: resolveBlocker } =
      promiseWithResolvers<string>();
    const { promise: blockerStarted, resolve: resolveBlockerStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: itemsStarted, resolve: resolveItemsStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    const resultPromise = legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      abortSignal: abortController.signal,
      rootValue: {
        blocker() {
          resolveBlockerStarted();
          return blockerPromise;
        },
        todo: {
          id: 'todo',
          items() {
            resolveItemsStarted();
            return ['a', 'b'];
          },
          author() {
            return { id: 'author' };
          },
        },
      },
    });

    await itemsStarted;
    await blockerStarted;

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );

    resolveBlocker('done');
  });

  it('should ignore repeated cancellation attempts during incremental execution', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items @stream(initialCount: 0)
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    let streamReturnCount = 0;
    let nextPromiseResolved = false;
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: nextPromise, resolve: resolveNext } =
      promiseWithResolvers<IteratorResult<string>>();
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (nextPromiseResolved) {
          return Promise.resolve({ value: undefined, done: true });
        }
        nextPromiseResolved = true;
        resolveNextStarted();
        return nextPromise;
      },
      return() {
        streamReturnCount += 1;
        return Promise.resolve({ value: undefined, done: true });
      },
    };

    const { promise: authorStarted, resolve: resolveAuthorStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: authorPromise, resolve: resolveAuthor } =
      promiseWithResolvers<{ id: string }>();
    const rootValue = {
      todo: {
        id: 'todo',
        items: () => asyncIterator,
        author() {
          resolveAuthorStarted();
          return authorPromise;
        },
      },
    };

    const result = await legacyExecuteIncrementally({
      schema: cancellationSchema,
      document,
      rootValue,
      enableEarlyExecution: true,
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextResultPromise = iterator.next();

    await authorStarted;
    await nextStarted;

    abortController.abort();
    await resolveOnNextTick();

    let firstResult:
      | IteratorResult<SubsequentIncrementalExecutionResult>
      | undefined;
    try {
      firstResult =
        (await nextResultPromise) as IteratorResult<SubsequentIncrementalExecutionResult>;
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('This operation was aborted');
    }
    if (firstResult && !firstResult.done) {
      try {
        const followUp = await iterator.next();
        expect(followUp.done).to.equal(true);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal('This operation was aborted');
      }
    }
    expect(streamReturnCount).to.equal(1);

    const priorStreamReturnCount = streamReturnCount;
    abortController.abort();
    await resolveOnNextTick();

    expect(streamReturnCount).to.equal(priorStreamReturnCount);

    resolveNext({ value: 'value', done: false });
    resolveAuthor({ id: 'author' });
  });

  it('cancels stream item executors with deferred work and nested streams', async () => {
    const document = parse(`
      query {
        todos @stream(initialCount: 0) {
          id
          items @stream(initialCount: 0)
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const { promise: idPromise, resolve: resolveId } =
      promiseWithResolvers<string>();
    const { promise: idStarted, resolve: resolveIdStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    const result = await legacyExecuteIncrementally({
      schema: cancelStreamSchema,
      document,
      enableEarlyExecution: true,
      rootValue: {
        todos: [
          {
            id() {
              resolveIdStarted();
              return idPromise;
            },
            items: ['a'],
            author: { id: 'author' },
          },
        ],
      },
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    await idStarted;
    await expectPromise(iterator.return()).toResolve();
    await resolveOnNextTick();

    resolveId('todo');
    await resolveOnNextTick();
  });

  it('stops streaming when a pending stream item resolves after cancellation', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const { promise: itemPromise, resolve: resolveItem } =
      promiseWithResolvers<string>();
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let done = false;
    const iterator = {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (done) {
          return { value: undefined, done: true };
        }
        done = true;
        resolveNextStarted();
        return { value: itemPromise, done: false };
      },
    };

    const result = await legacyExecuteIncrementally({
      schema,
      document,
      rootValue: {
        scalarList: () => iterator,
      },
    });
    assert('initialResult' in result);

    const stream = result.subsequentResults[Symbol.asyncIterator]();
    const nextPromise = stream.next();

    await nextStarted;
    const returnPromise = stream.return();
    await resolveOnNextTick();

    resolveItem('value');

    await expectPromise(returnPromise).toResolve();
    await expectPromise(nextPromise).toResolve();
  });
});
