/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../execute';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
} from '../../type';

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
function check(testType, testData, expected) {
  return async () => {
    const data = { test: testData };

    const dataType = new GraphQLObjectType({
      name: 'DataType',
      fields: () => ({
        test: { type: testType },
        nest: { type: dataType, resolve: () => data },
      }),
    });

    const schema = new GraphQLSchema({ query: dataType });

    const ast = parse('{ nest { test } }');

    const response = await execute(schema, ast, data);
    expect(response).to.deep.equal(expected);
  };
}

describe('Execute: Accepts any iterable as list value', () => {
  it(
    'Accepts a Set as a List value',
    check(
      GraphQLList(GraphQLString),
      new Set(['apple', 'banana', 'apple', 'coconut']),
      { data: { nest: { test: ['apple', 'banana', 'coconut'] } } },
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
      data: { nest: { test: ['one', '2', 'true'] } },
    }),
  );

  function getArgs(..._args) {
    return arguments;
  }

  it(
    'Accepts function arguments as a List value',
    check(GraphQLList(GraphQLString), getArgs('one', 'two'), {
      data: { nest: { test: ['one', 'two'] } },
    }),
  );

  it(
    'Does not accept (Iterable) String-literal as a List value',
    check(GraphQLList(GraphQLString), 'Singular', {
      data: { nest: { test: null } },
      errors: [
        {
          message:
            'Expected Iterable, but did not find one for field DataType.test.',
          locations: [{ line: 1, column: 10 }],
          path: ['nest', 'test'],
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
        check(type, [1, 2], { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], { data: { nest: { test: [1, null, 2] } } }),
      );

      it('Returns null', check(type, null, { data: { nest: { test: null } } }));
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { nest: { test: [1, null, 2] } },
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), { data: { nest: { test: null } } }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: { nest: { test: null } },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { nest: { test: [1, 2] } },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { nest: { test: [1, null, 2] } },
        }),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          {
            data: { nest: { test: [1, null, 2] } },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 10 }],
                path: ['nest', 'test', 1],
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
        check(type, [1, 2], { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], { data: { nest: { test: [1, null, 2] } } }),
      );

      it(
        'Returns null',
        check(type, null, {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { nest: { test: [1, null, 2] } },
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: { nest: null },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { nest: { test: [1, 2] } },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { nest: { test: [1, null, 2] } },
        }),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          {
            data: { nest: { test: [1, null, 2] } },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 10 }],
                path: ['nest', 'test', 1],
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
        check(type, [1, 2], { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], {
          data: { nest: { test: null } },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test', 1],
            },
          ],
        }),
      );

      it('Returns null', check(type, null, { data: { nest: { test: null } } }));
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { nest: { test: null } },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test', 1],
            },
          ],
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), { data: { nest: { test: null } } }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: { nest: { test: null } },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { nest: { test: [1, 2] } },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { nest: { test: null } },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test', 1],
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
            data: { nest: { test: null } },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 10 }],
                path: ['nest', 'test', 1],
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
        check(type, [1, 2], { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, [1, null, 2], {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test', 1],
            },
          ],
        }),
      );

      it(
        'Returns null',
        check(type, null, {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), { data: { nest: { test: [1, 2] } } }),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test', 1],
            },
          ],
        }),
      );

      it(
        'Returns null',
        check(type, resolved(null), {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), {
          data: { nest: null },
          errors: [
            {
              message: 'bad',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test'],
            },
          ],
        }),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], {
          data: { nest: { test: [1, 2] } },
        }),
      );

      it(
        'Contains null',
        check(type, [resolved(1), resolved(null), resolved(2)], {
          data: { nest: null },
          errors: [
            {
              message:
                'Cannot return null for non-nullable field DataType.test.',
              locations: [{ line: 1, column: 10 }],
              path: ['nest', 'test', 1],
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
            data: { nest: null },
            errors: [
              {
                message: 'bad',
                locations: [{ line: 1, column: 10 }],
                path: ['nest', 'test', 1],
              },
            ],
          },
        ),
      );
    });
  });
});
