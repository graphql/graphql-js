import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import type { GraphQLOutputType } from '../../type/definition';
import { GraphQLSchema } from '../../type/schema';
import { GraphQLString, GraphQLInt } from '../../type/scalars';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition';

import { execute } from '../execute';

// resolved() is shorthand for Promise.resolve()
const resolved = Promise.resolve.bind(Promise);

// rejected() is shorthand for Promise.reject()
const rejected = Promise.reject.bind(Promise);

/**
 * This function creates a test case passed to "it", there's a time delay
 * between when the test is created and when the test is run, so if testData
 * contains a rejection, testData should be a function that returns that
 * rejection so as not to trigger the "unhandled rejection" error watcher.
 */
function check(testType: GraphQLOutputType, testData: mixed, expected: mixed) {
  return async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          listField: { type: testType },
        }),
      }),
    });

    const response = await execute({
      schema,
      document: parse('{ listField }'),
      rootValue: { listField: testData },
    });
    expect(response).to.deep.equal(expected);
  };
}

describe('Execute: Accepts any iterable as list value', () => {
  it(
    'Accepts a Set as a List value',
    check(
      GraphQLList(GraphQLString),
      new Set(['apple', 'banana', 'apple', 'coconut']),
      { data: { listField: ['apple', 'banana', 'coconut'] } },
    ),
  );

  function* yieldItems() {
    yield 'one';
    yield 2;
    yield true;
  }

  it(
    'Accepts an Generator function as a List value',
    check(GraphQLList(GraphQLString), yieldItems(), {
      data: { listField: ['one', '2', 'true'] },
    }),
  );

  function getArgs(...args: Array<string>) {
    return args;
  }

  it(
    'Accepts function arguments as a List value',
    check(GraphQLList(GraphQLString), getArgs('one', 'two'), {
      data: { listField: ['one', 'two'] },
    }),
  );

  it(
    'Does not accept (Iterable) String-literal as a List value',
    check(GraphQLList(GraphQLString), 'Singular', {
      data: { listField: null },
      errors: [
        {
          message:
            'Expected Iterable, but did not find one for field "Query.listField".',
          locations: [{ line: 1, column: 3 }],
          path: ['listField'],
        },
      ],
    }),
  );
});

describe('Execute: Handles list nullability', () => {
  describe('[T]', () => {
    const type = GraphQLList(GraphQLInt);

    describe('Array<T>', () => {
      it(
        'Contains values',
        check(type, [1, 2], { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], { data: { listField: [1, null, 2] } }),
      );

      it('Returns null', check(type, null, { data: { listField: null } }));
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { listField: [1, null, 2] },
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), { data: { listField: null } }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: { listField: null },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { listField: [1, 2] },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { listField: [1, null, 2] },
        }),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          {
            data: { listField: [1, null, 2] },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 3 }],
                path: ['listField', 1],
              },
            ],
          },
        ),
      );
    });
  });

  describe('[T]!', () => {
    const type = GraphQLNonNull(GraphQLList(GraphQLInt));

    describe('Array<T>', () => {
      it(
        'Contains values',
        check(type, [1, 2], { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], { data: { listField: [1, null, 2] } }),
      );

      it(
        'Returns null',
        check(type, null, {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { listField: [1, null, 2] },
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: null,
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { listField: [1, 2] },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { listField: [1, null, 2] },
        }),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          {
            data: { listField: [1, null, 2] },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 3 }],
                path: ['listField', 1],
              },
            ],
          },
        ),
      );
    });
  });

  describe('[T!]', () => {
    const type = GraphQLList(GraphQLNonNull(GraphQLInt));

    describe('Array<T>', () => {
      it(
        'Contains values',
        check(type, [1, 2], { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], {
          data: { listField: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        }),
      );

      it('Returns null', check(type, null, { data: { listField: null } }));
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { listField: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), { data: { listField: null } }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: { listField: null },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { listField: [1, 2] },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { listField: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        }),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          {
            data: { listField: null },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 3 }],
                path: ['listField', 1],
              },
            ],
          },
        ),
      );
    });
  });

  describe('[T!]!', () => {
    const type = GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLInt)));

    describe('Array<T>', () => {
      it(
        'Contains values',
        check(type, [1, 2], { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        }),
      );

      it(
        'Returns null',
        check(type, null, {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { listField: [1, 2] } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: null,
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 3 }],
              path: ['listField'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { listField: [1, 2] },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: null,
          errors: [
            {
              message:
                'Cannot return null for non-nullable field Query.listField.',
              locations: [{ line: 1, column: 3 }],
              path: ['listField', 1],
            },
          ],
        }),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          {
            data: null,
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 3 }],
                path: ['listField', 1],
              },
            ],
          },
        ),
      );
    });
  });
});
