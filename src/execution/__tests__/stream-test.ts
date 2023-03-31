import { assert } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';

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
import { experimentalExecuteIncrementally } from '../execute.js';

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

async function complete(document: DocumentNode, rootValue: unknown = {}) {
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

async function completeAsync(
  document: DocumentNode,
  numCalls: number,
  rootValue: unknown = {},
) {
  const result = await experimentalExecuteIncrementally({
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

function createResolvablePromise<T>(): [Promise<T>, (value?: T) => void] {
  let resolveFn;
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  });
  return [promise, resolveFn as unknown as (value?: T) => void];
}

describe('Execute: stream directive', () => {
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
        incremental: [{ items: ['banana'], path: ['scalarList', 1] }],
        hasNext: true,
      },
      {
        incremental: [{ items: ['coconut'], path: ['scalarList', 2] }],
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
        incremental: [{ items: ['apple'], path: ['scalarList', 0] }],
        hasNext: true,
      },
      {
        incremental: [{ items: ['banana'], path: ['scalarList', 1] }],
        hasNext: true,
      },
      {
        incremental: [{ items: ['coconut'], path: ['scalarList', 2] }],
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
            items: ['banana'],
            path: ['scalarList', 1],
            label: 'scalar-stream',
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: ['coconut'],
            path: ['scalarList', 2],
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
            items: [['banana', 'banana', 'banana']],
            path: ['scalarListList', 1],
          },
        ],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [['coconut', 'coconut', 'coconut']],
            path: ['scalarListList', 2],
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
            path: ['friendList', 1],
            errors: [
              {
                message: 'bad',
                locations: [{ line: 3, column: 9 }],
                path: ['friendList', 1],
              },
            ],
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
        hasNext: true,
      },
      {
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
        hasNext: true,
      },
      {
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
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async *friendList() {},
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
  it('Can handle concurrent calls to .next() without waiting', async () => {
    const document = parse(`
      query { 
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await completeAsync(document, 3, {
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
          hasNext: true,
        },
      },
      { done: false, value: { hasNext: false } },
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
          path: ['friendList', 1],
        },
      ],
      data: {
        friendList: [{ name: 'Luke', id: '1' }, null],
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
            items: [null],
            path: ['friendList', 1],
            errors: [
              {
                message: 'bad',
                locations: [{ line: 3, column: 9 }],
                path: ['friendList', 1],
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
      nonNullFriendList: () => [friends[0], null],
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
            path: ['nonNullFriendList', 1],
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
            path: ['nonNullFriendList', 1],
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
            path: ['scalarList', 1],
            errors: [
              {
                message: 'String cannot represent value: {}',
                locations: [{ line: 3, column: 9 }],
                path: ['scalarList', 1],
              },
            ],
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
            path: ['friendList', 1],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['friendList', 1, 'nonNullName'],
              },
            ],
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
            path: ['friendList', 1],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['friendList', 1, 'nonNullName'],
              },
            ],
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
            path: ['nonNullFriendList', 1],
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
            path: ['nonNullFriendList', 1],
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
            path: ['friendList', 1],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['friendList', 1, 'nonNullName'],
              },
            ],
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
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
  });
  it('Handles async errors thrown by completeValue after initialCount is reached from async iterable for a non-nullable list', async () => {
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
        });
        yield await Promise.resolve({
          nonNullName: friends[1].name,
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
            path: ['nonNullFriendList', 1],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 4, column: 11 }],
                path: ['nonNullFriendList', 1, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
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
    expectJSON(result).toDeepEqual([
      {
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
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
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
            path: ['otherNestedObject'],
            errors: [
              {
                message: 'Oops',
                locations: [{ line: 5, column: 13 }],
                path: ['otherNestedObject', 'scalarField'],
              },
            ],
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
            path: ['nestedObject'],
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
          },
        ],
        hasNext: true,
      },
      {
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
            path: ['friendList', 0],
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Friend.nonNullName.',
                locations: [{ line: 4, column: 9 }],
                path: ['friendList', 0, 'nonNullName'],
              },
            ],
          },
        ],
        hasNext: true,
      },
      {
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
          if (requested) {
            // Ignores further errors when filtered.
            return Promise.reject(new Error('Oops'));
          }
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

    const executeResult = await experimentalExecuteIncrementally({
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
            path: ['nestedObject'],
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
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
  });
  it('Returns payloads in correct order when parent deferred fragment resolves slower than stream', async () => {
    const [slowFieldPromise, resolveSlowField] = createResolvablePromise();
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
    const executeResult = await experimentalExecuteIncrementally({
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
        hasNext: true,
      },
      done: false,
    });
    const result5 = await iterator.next();
    expectJSON(result5).toDeepEqual({
      value: { hasNext: false },
      done: false,
    });
    const result6 = await iterator.next();
    expectJSON(result6).toDeepEqual({
      value: undefined,
      done: true,
    });
  });
  it('Can @defer fields that are resolved after async iterable is complete', async () => {
    const [slowFieldPromise, resolveSlowField] = createResolvablePromise();
    const [iterableCompletionPromise, resolveIterableCompletion] =
      createResolvablePromise();

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

    const executeResult = await experimentalExecuteIncrementally({
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
    resolveIterableCompletion();
    const result2 = await result2Promise;
    expectJSON(result2).toDeepEqual({
      value: {
        incremental: [
          {
            data: { name: 'Luke' },
            path: ['friendList', 0],
            label: 'DeferName',
          },
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

    const result3Promise = iterator.next();
    resolveSlowField('Han');
    const result3 = await result3Promise;
    expectJSON(result3).toDeepEqual({
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
    const result4 = await iterator.next();
    expectJSON(result4).toDeepEqual({
      value: undefined,
      done: true,
    });
  });
  it('Can @defer fields that are resolved before async iterable is complete', async () => {
    const [slowFieldPromise, resolveSlowField] = createResolvablePromise();
    const [iterableCompletionPromise, resolveIterableCompletion] =
      createResolvablePromise();

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

    const executeResult = await experimentalExecuteIncrementally({
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

    const result3 = await iterator.next();
    expectJSON(result3).toDeepEqual({
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
    const result4Promise = iterator.next();
    resolveIterableCompletion();
    const result4 = await result4Promise;
    expectJSON(result4).toDeepEqual({
      value: { hasNext: false },
      done: false,
    });

    const result5 = await iterator.next();
    expectJSON(result5).toDeepEqual({
      value: undefined,
      done: true,
    });
  });
  it('Returns underlying async iterables when returned generator is returned', async () => {
    let returned = false;
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
        return: () => {
          returned = true;
        },
      }),
    };

    const document = parse(`
      query { 
        friendList @stream(initialCount: 1) {
          id
          ... @defer {
            name
          }
        }
      }
    `);

    const executeResult = await experimentalExecuteIncrementally({
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
    const returnPromise = iterator.return();

    const result2 = await iterator.next();
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

    const executeResult = await experimentalExecuteIncrementally({
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

    const returnPromise = iterator.return();

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      done: true,
      value: undefined,
    });
    await returnPromise;
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

    const executeResult = await experimentalExecuteIncrementally({
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

    const throwPromise = iterator.throw(new Error('bad'));

    const result2 = await iterator.next();
    expectJSON(result2).toDeepEqual({
      done: true,
      value: undefined,
    });
    try {
      await throwPromise; /* c8 ignore start */
      // Not reachable, always throws
      /* c8 ignore stop */
    } catch (e) {
      // ignore error
    }
    assert(returned);
  });
});
