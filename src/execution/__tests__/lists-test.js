import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { execute } from '../execute';

import { buildSchema } from '../../utilities/buildASTSchema';

describe('Execute: Accepts any iterable as list value', () => {
  function complete(rootValue: mixed) {
    return execute({
      schema: buildSchema('type Query { listField: [String] }'),
      document: parse('{ listField }'),
      rootValue,
    });
  }

  it('Accepts a Set as a List value', async () => {
    const listField = new Set(['apple', 'banana', 'apple', 'coconut']);

    expect(await complete({ listField })).to.deep.equal({
      data: { listField: ['apple', 'banana', 'coconut'] },
    });
  });

  it('Accepts an Generator function as a List value', async () => {
    function* yieldItems() {
      yield 'one';
      yield 2;
      yield true;
    }
    const listField = yieldItems();

    expect(await complete({ listField })).to.deep.equal({
      data: { listField: ['one', '2', 'true'] },
    });
  });

  it('Accepts function arguments as a List value', async () => {
    function getArgs(...args: Array<string>) {
      return args;
    }
    const listField = getArgs('one', 'two');

    expect(await complete({ listField })).to.deep.equal({
      data: { listField: ['one', 'two'] },
    });
  });

  it('Does not accept (Iterable) String-literal as a List value', async () => {
    const listField = 'Singular';

    expect(await complete({ listField })).to.deep.equal({
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
  describe('[T]', () => {
    function complete(rootValue: mixed) {
      return execute({
        schema: buildSchema('type Query { listField: [Int] }'),
        document: parse('{ listField }'),
        rootValue,
      });
    }

    describe('Array<T>', () => {
      it('Contains values', async () => {
        const listField = [1, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [1, null, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
        });
      });

      it('Returns null', async () => {
        const listField = null;

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
        });
      });
    });

    describe('Promise<Array<T>>', () => {
      it('Contains values', async () => {
        const listField = Promise.resolve([1, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = Promise.resolve([1, null, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
        });
      });

      it('Returns null', async () => {
        const listField = Promise.resolve(null);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
        });
      });

      it('Rejected', async () => {
        const listField = Promise.reject(new Error('bad'));

        expect(await complete({ listField })).to.deep.equal({
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
    });

    describe('Array<Promise<T>>', () => {
      it('Contains values', async () => {
        const listField = [Promise.resolve(1), Promise.resolve(2)];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.resolve(null),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
        });
      });

      it('Contains reject', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.reject(new Error('bad')),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });
    });
  });

  describe('[T]!', () => {
    function complete(rootValue: mixed) {
      return execute({
        schema: buildSchema('type Query { listField: [Int]! }'),
        document: parse('{ listField }'),
        rootValue,
      });
    }

    describe('Array<T>', () => {
      it('Contains values', async () => {
        const listField = [1, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [1, null, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
        });
      });

      it('Returns null', async () => {
        const listField = null;

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        });
      });
    });

    describe('Promise<Array<T>>', () => {
      it('Contains values', async () => {
        const listField = Promise.resolve([1, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = Promise.resolve([1, null, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
        });
      });

      it('Returns null', async () => {
        const listField = Promise.resolve(null);

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        });
      });

      it('Rejected', async () => {
        const listField = Promise.reject(new Error('bad'));

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        });
      });
    });

    describe('Array<Promise<T>>', () => {
      it('Contains values', async () => {
        const listField = [Promise.resolve(1), Promise.resolve(2)];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.resolve(null),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
        });
      });

      it('Contains reject', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.reject(new Error('bad')),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, null, 2] },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });
    });
  });

  describe('[T!]', () => {
    function complete(rootValue: mixed) {
      return execute({
        schema: buildSchema('type Query { listField: [Int!] }'),
        document: parse('{ listField }'),
        rootValue,
      });
    }

    describe('Array<T>', () => {
      it('Contains values', async () => {
        const listField = [1, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [1, null, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });

      it('Returns null', async () => {
        const listField = null;

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
        });
      });
    });

    describe('Promise<Array<T>>', () => {
      it('Contains values', async () => {
        const listField = Promise.resolve([1, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = Promise.resolve([1, null, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });

      it('Returns null', async () => {
        const listField = Promise.resolve(null);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
        });
      });

      it('Rejected', async () => {
        const listField = Promise.reject(new Error('bad'));

        expect(await complete({ listField })).to.deep.equal({
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
    });

    describe('Array<Promise<T>>', () => {
      it('Contains values', async () => {
        const listField = [Promise.resolve(1), Promise.resolve(2)];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.resolve(null),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });

      it('Contains reject', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.reject(new Error('bad')),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: null },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });
    });
  });

  describe('[T!]!', () => {
    function complete(rootValue: mixed) {
      return execute({
        schema: buildSchema('type Query { listField: [Int!]! }'),
        document: parse('{ listField }'),
        rootValue,
      });
    }

    describe('Array<T>', () => {
      it('Contains values', async () => {
        const listField = [1, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [1, null, 2];

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });

      it('Returns null', async () => {
        const listField = null;

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        });
      });
    });

    describe('Promise<Array<T>>', () => {
      it('Contains values', async () => {
        const listField = Promise.resolve([1, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = Promise.resolve([1, null, 2]);

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });

      it('Returns null', async () => {
        const listField = Promise.resolve(null);

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        });
      });

      it('Rejected', async () => {
        const listField = Promise.reject(new Error('bad'));

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        });
      });
    });

    describe('Array<Promise<T>>', () => {
      it('Contains values', async () => {
        const listField = [Promise.resolve(1), Promise.resolve(2)];

        expect(await complete({ listField })).to.deep.equal({
          data: { listField: [1, 2] },
        });
      });

      it('Contains null', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.resolve(null),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });

      it('Contains reject', async () => {
        const listField = [
          Promise.resolve(1),
          Promise.reject(new Error('bad')),
          Promise.resolve(2),
        ];

        expect(await complete({ listField })).to.deep.equal({
          data: null,
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        });
      });
    });
  });
});
