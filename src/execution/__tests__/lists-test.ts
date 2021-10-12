import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';

import { execute, executeSync } from '../execute';

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

  it('Accepts an Generator function as a List value', () => {
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
