import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';

import { execute, executeSync } from '../execute';

describe('Execute: Accepts any iterable as list value', () => {
  function complete(rootValue: mixed) {
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
    function getArgs(..._args: Array<string>) {
      return arguments;
    }
    const listField = getArgs('one', 'two');

    expect(complete({ listField })).to.deep.equal({
      data: { listField: ['one', 'two'] },
    });
  });

  it('Does not accept (Iterable) String-literal as a List value', () => {
    const listField = 'Singular';

    expect(complete({ listField })).to.deep.equal({
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
  async function complete(args: {| listField: mixed, as: string |}) {
    const { listField, as } = args;
    const schema = buildSchema(`type Query { listField: ${as} }`);
    const document = parse('{ listField }');

    const result = await executeQuery(listField);
    // Promise<Array<T>> === Array<T>
    expect(await executeQuery(promisify(listField))).to.deep.equal(result);
    if (Array.isArray(listField)) {
      const listOfPromises = listField.map(promisify);

      // Array<Promise<T>> === Array<T>
      expect(await executeQuery(listOfPromises)).to.deep.equal(result);
      // Promise<Array<Promise<T>>> === Array<T>
      expect(await executeQuery(promisify(listOfPromises))).to.deep.equal(
        result,
      );
    }
    return result;

    function executeQuery(listValue: mixed) {
      return execute({ schema, document, rootValue: { listField: listValue } });
    }

    function promisify(value: mixed): Promise<mixed> {
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
    expect(await complete({ listField, as: '[Int!]' })).to.deep.equal({
      data: { listField: null },
      errors,
    });
    expect(await complete({ listField, as: '[Int!]!' })).to.deep.equal({
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
    expect(await complete({ listField, as: '[Int]!' })).to.deep.equal({
      data: null,
      errors,
    });
    expect(await complete({ listField, as: '[Int!]' })).to.deep.equal({
      data: { listField: null },
    });
    expect(await complete({ listField, as: '[Int!]!' })).to.deep.equal({
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

    expect(await complete({ listField, as: '[Int]' })).to.deep.equal({
      data: { listField: [1, null, 2] },
      errors,
    });
    expect(await complete({ listField, as: '[Int]!' })).to.deep.equal({
      data: { listField: [1, null, 2] },
      errors,
    });
    expect(await complete({ listField, as: '[Int!]' })).to.deep.equal({
      data: { listField: null },
      errors,
    });
    expect(await complete({ listField, as: '[Int!]!' })).to.deep.equal({
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

    expect(await complete({ listField, as: '[Int]' })).to.deep.equal({
      data: { listField: null },
      errors,
    });
    expect(await complete({ listField, as: '[Int]!' })).to.deep.equal({
      data: null,
      errors,
    });
    expect(await complete({ listField, as: '[Int!]' })).to.deep.equal({
      data: { listField: null },
      errors,
    });
    expect(await complete({ listField, as: '[Int!]!' })).to.deep.equal({
      data: null,
      errors,
    });
  });
});
