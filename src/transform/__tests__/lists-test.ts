import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { invariant } from '../../jsutils/invariant.js';
import { isPromise } from '../../jsutils/isPromise.js';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';

import { parse } from '../../language/parser.js';

import type { GraphQLFieldResolver } from '../../type/definition.js';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import type { ExecutionResult } from '../../execution/types.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { execute, executeSync } from './execute.js';

describe('Execute: Accepts any iterable as list value', () => {
  function complete(rootValue: unknown) {
    return executeSync({
      schema: buildSchema('type Query { listField: [String] }'),
      document: parse('{ listField }'),
      rootValue,
    });
  }

  it('Accepts a Set as a List value', () => {
    const listField = new Set(['apple', 'banana', 'apple', 'coconut']);

    expect(complete({ listField })).to.deep.equal({
      data: { listField: ['apple', 'banana', 'coconut'] },
    });
  });

  it('Accepts a Generator function as a List value', () => {
    function* listField() {
      yield 'one';
      yield 2;
      yield true;
    }

    expect(complete({ listField })).to.deep.equal({
      data: { listField: ['one', '2', 'true'] },
    });
  });

  it('Accepts function arguments as a List value', () => {
    function getArgs(..._args: ReadonlyArray<string>) {
      return arguments;
    }
    const listField = getArgs('one', 'two');

    expect(complete({ listField })).to.deep.equal({
      data: { listField: ['one', 'two'] },
    });
  });

  it('Does not accept (Iterable) String-literal as a List value', () => {
    const listField = 'Singular';

    expectJSON(complete({ listField })).toDeepEqual({
      data: { listField: null },
      errors: [
        {
          message:
            'Expected Iterable, but did not find one for field "Query.listField".',
          locations: [{ line: 1, column: 3 }],
          path: ['listField'],
        },
      ],
    });
  });
});

describe('Execute: Accepts async iterables as list value', () => {
  function complete(rootValue: unknown, as: string = '[String]') {
    return execute({
      schema: buildSchema(`type Query { listField: ${as} }`),
      document: parse('{ listField }'),
      rootValue,
    });
  }

  function completeObjectList(
    resolve: GraphQLFieldResolver<{ index: number }, unknown>,
  ): PromiseOrValue<ExecutionResult> {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          listField: {
            resolve: async function* listField() {
              yield await Promise.resolve({ index: 0 });
              yield await Promise.resolve({ index: 1 });
              yield await Promise.resolve({ index: 2 });
            },
            type: new GraphQLList(
              new GraphQLObjectType({
                name: 'ObjectWrapper',
                fields: {
                  index: {
                    type: new GraphQLNonNull(GraphQLString),
                    resolve,
                  },
                },
              }),
            ),
          },
        },
      }),
    });
    const result = execute({
      schema,
      document: parse('{ listField { index } }'),
    });
    invariant(isPromise(result));
    return result.then((resolved) => {
      invariant(!('initialResult' in resolved));
      return resolved;
    });
  }

  it('Accepts an AsyncGenerator function as a List value', async () => {
    async function* listField() {
      yield await Promise.resolve('two');
      yield await Promise.resolve(4);
      yield await Promise.resolve(false);
    }

    expectJSON(await complete({ listField })).toDeepEqual({
      data: { listField: ['two', '4', 'false'] },
    });
  });

  it('Handles an AsyncGenerator function that throws', async () => {
    async function* listField() {
      yield await Promise.resolve('two');
      yield await Promise.resolve(4);
      throw new Error('bad');
    }

    expectJSON(await complete({ listField })).toDeepEqual({
      data: { listField: null },
      errors: [
        {
          message: 'bad',
          locations: [{ line: 1, column: 3 }],
          path: ['listField'],
        },
      ],
    });
  });

  it('Handles an AsyncGenerator function where an intermediate value triggers an error', async () => {
    async function* listField() {
      yield await Promise.resolve('two');
      yield await Promise.resolve({});
      yield await Promise.resolve(4);
    }

    expectJSON(await complete({ listField })).toDeepEqual({
      data: { listField: ['two', null, '4'] },
      errors: [
        {
          message: 'String cannot represent value: {}',
          locations: [{ line: 1, column: 3 }],
          path: ['listField', 1],
        },
      ],
    });
  });

  it('Handles errors from `completeValue` in AsyncIterables', async () => {
    async function* listField() {
      yield await Promise.resolve('two');
      yield await Promise.resolve({});
    }

    expectJSON(await complete({ listField })).toDeepEqual({
      data: { listField: ['two', null] },
      errors: [
        {
          message: 'String cannot represent value: {}',
          locations: [{ line: 1, column: 3 }],
          path: ['listField', 1],
        },
      ],
    });
  });

  it('Handles promises from `completeValue` in AsyncIterables', async () => {
    expectJSON(
      await completeObjectList(({ index }) => Promise.resolve(index)),
    ).toDeepEqual({
      data: { listField: [{ index: '0' }, { index: '1' }, { index: '2' }] },
    });
  });

  it('Handles rejected promises from `completeValue` in AsyncIterables', async () => {
    expectJSON(
      await completeObjectList(({ index }) => {
        if (index === 2) {
          return Promise.reject(new Error('bad'));
        }
        return Promise.resolve(index);
      }),
    ).toDeepEqual({
      data: { listField: [{ index: '0' }, { index: '1' }, null] },
      errors: [
        {
          message: 'bad',
          locations: [{ line: 1, column: 15 }],
          path: ['listField', 2, 'index'],
        },
      ],
    });
  });
  it('Handles nulls yielded by async generator', async () => {
    async function* listField() {
      yield await Promise.resolve(1);
      yield await Promise.resolve(null);
      yield await Promise.resolve(2);
    }
    const errors = [
      {
        message: 'Cannot return null for non-nullable field Query.listField.',
        locations: [{ line: 1, column: 3 }],
        path: ['listField', 1],
      },
    ];

    expect(await complete({ listField }, '[Int]')).to.deep.equal({
      data: { listField: [1, null, 2] },
    });
    expect(await complete({ listField }, '[Int]!')).to.deep.equal({
      data: { listField: [1, null, 2] },
    });
    expectJSON(await complete({ listField }, '[Int!]')).toDeepEqual({
      data: { listField: null },
      errors,
    });
    expectJSON(await complete({ listField }, '[Int!]!')).toDeepEqual({
      data: null,
      errors,
    });
  });

  it('Returns async iterable when list nulls', async () => {
    const values = [1, null, 2];
    let i = 0;
    let returned = false;
    const listField = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ value: values[i++], done: false }),
        return: () => {
          returned = true;
          return Promise.resolve({ value: undefined, done: true });
        },
      }),
    };
    const errors = [
      {
        message: 'Cannot return null for non-nullable field Query.listField.',
        locations: [{ line: 1, column: 3 }],
        path: ['listField', 1],
      },
    ];

    expectJSON(await complete({ listField }, '[Int!]')).toDeepEqual({
      data: { listField: null },
      errors,
    });
    assert(returned);
  });
});

describe('Execute: Handles list nullability', () => {
  async function complete(args: { listField: unknown; as: string }) {
    const { listField, as } = args;
    const schema = buildSchema(`type Query { listField: ${as} }`);
    const document = parse('{ listField }');

    const result = await executeQuery(listField);
    // Promise<Array<T>> === Array<T>
    expectJSON(await executeQuery(promisify(listField))).toDeepEqual(result);
    if (Array.isArray(listField)) {
      const listOfPromises = listField.map(promisify);

      // Array<Promise<T>> === Array<T>
      expectJSON(await executeQuery(listOfPromises)).toDeepEqual(result);
      // Promise<Array<Promise<T>>> === Array<T>
      expectJSON(await executeQuery(promisify(listOfPromises))).toDeepEqual(
        result,
      );
    }
    return result;

    function executeQuery(listValue: unknown) {
      return execute({ schema, document, rootValue: { listField: listValue } });
    }

    function promisify(value: unknown): Promise<unknown> {
      return value instanceof Error
        ? Promise.reject(value)
        : Promise.resolve(value);
    }
  }

  it('Contains values', async () => {
    const listField = [1, 2];

    expect(await complete({ listField, as: '[Int]' })).to.deep.equal({
      data: { listField: [1, 2] },
    });
    expect(await complete({ listField, as: '[Int]!' })).to.deep.equal({
      data: { listField: [1, 2] },
    });
    expect(await complete({ listField, as: '[Int!]' })).to.deep.equal({
      data: { listField: [1, 2] },
    });
    expect(await complete({ listField, as: '[Int!]!' })).to.deep.equal({
      data: { listField: [1, 2] },
    });
  });

  it('Contains null', async () => {
    const listField = [1, null, 2];
    const errors = [
      {
        message: 'Cannot return null for non-nullable field Query.listField.',
        locations: [{ line: 1, column: 3 }],
        path: ['listField', 1],
      },
    ];

    expect(await complete({ listField, as: '[Int]' })).to.deep.equal({
      data: { listField: [1, null, 2] },
    });
    expect(await complete({ listField, as: '[Int]!' })).to.deep.equal({
      data: { listField: [1, null, 2] },
    });
    expectJSON(await complete({ listField, as: '[Int!]' })).toDeepEqual({
      data: { listField: null },
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int!]!' })).toDeepEqual({
      data: null,
      errors,
    });
  });

  it('Returns null', async () => {
    const listField = null;
    const errors = [
      {
        message: 'Cannot return null for non-nullable field Query.listField.',
        locations: [{ line: 1, column: 3 }],
        path: ['listField'],
      },
    ];

    expect(await complete({ listField, as: '[Int]' })).to.deep.equal({
      data: { listField: null },
    });
    expectJSON(await complete({ listField, as: '[Int]!' })).toDeepEqual({
      data: null,
      errors,
    });
    expect(await complete({ listField, as: '[Int!]' })).to.deep.equal({
      data: { listField: null },
    });
    expectJSON(await complete({ listField, as: '[Int!]!' })).toDeepEqual({
      data: null,
      errors,
    });
  });

  it('Contains error', async () => {
    const listField = [1, new Error('bad'), 2];
    const errors = [
      {
        message: 'bad',
        locations: [{ line: 1, column: 3 }],
        path: ['listField', 1],
      },
    ];

    expectJSON(await complete({ listField, as: '[Int]' })).toDeepEqual({
      data: { listField: [1, null, 2] },
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int]!' })).toDeepEqual({
      data: { listField: [1, null, 2] },
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int!]' })).toDeepEqual({
      data: { listField: null },
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int!]!' })).toDeepEqual({
      data: null,
      errors,
    });
  });

  it('Results in error', async () => {
    const listField = new Error('bad');
    const errors = [
      {
        message: 'bad',
        locations: [{ line: 1, column: 3 }],
        path: ['listField'],
      },
    ];

    expectJSON(await complete({ listField, as: '[Int]' })).toDeepEqual({
      data: { listField: null },
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int]!' })).toDeepEqual({
      data: null,
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int!]' })).toDeepEqual({
      data: { listField: null },
      errors,
    });
    expectJSON(await complete({ listField, as: '[Int!]!' })).toDeepEqual({
      data: null,
      errors,
    });
  });
});
