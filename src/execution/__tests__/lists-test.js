/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { formatError } from '../../error';
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

    // Formatting errors for ease of test writing.
    let result;
    if (response.errors) {
      result = {
        data: response.data,
        errors: response.errors.map(formatError),
      };
    } else {
      result = response;
    }
    expect(result).to.deep.equal(expected);
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

  function getArgs() {
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
    check(GraphQLList(GraphQLString), 'Singluar', {
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
  function allChecks(type, expected) {
    describe('Array<T>', () => {
      it('Contains values', check(type, [1, 2], expected.containsValues));
      it('Contains null', check(type, [1, null, 2], expected.containsNull));
      it('Returns null', check(type, null, expected.returnsNull));
    });

    describe('Promise<Array<T>>', () => {
      it(
        'Contains values',
        check(type, resolved([1, 2]), expected.containsValues),
      );

      it(
        'Contains null',
        check(type, resolved([1, null, 2]), expected.containsNull),
      );

      it('Returns null', check(type, resolved(null), expected.returnsNull));

      it(
        'Rejected',
        check(type, () => rejected(new Error('bad')), expected.rejected),
      );
    });

    describe('Array<Promise<T>>', () => {
      it(
        'Contains values',
        check(type, [resolved(1), resolved(2)], expected.containsValues),
      );

      it(
        'Contains null',
        check(
          type,
          [resolved(1), resolved(null), resolved(2)],
          expected.containsNull,
        ),
      );

      it(
        'Contains reject',
        check(
          type,
          () => [resolved(1), rejected(new Error('bad')), resolved(2)],
          expected.containsReject,
        ),
      );
    });
  }

  const dataOk = { nest: { test: [1, 2] } };
  const dataOkWithNull = { nest: { test: [1, null, 2] } };
  const dataNull = { nest: null };
  const dataNullDeep = { nest: { test: null } };
  /*
    In these errors, the variable name including "1" means the error
    relates to the 1-th (i.e. second) item in the return value.
  */
  const errorsReject = [
    {
      message: 'bad',
      locations: [{ line: 1, column: 10 }],
      path: ['nest', 'test'],
    },
  ];
  const errorsReject1 = [
    {
      message: 'bad',
      locations: [{ line: 1, column: 10 }],
      path: ['nest', 'test', 1],
    },
  ];
  const errorsNonNull = [
    {
      message: 'Cannot return null for non-nullable field DataType.test.',
      locations: [{ line: 1, column: 10 }],
      path: ['nest', 'test'],
    },
  ];
  const errorsNonNull1 = [
    {
      message: 'Cannot return null for non-nullable field DataType.test.',
      locations: [{ line: 1, column: 10 }],
      path: ['nest', 'test', 1],
    },
  ];

  /*
    The first arg to allChecks is a type.
    The second arg is an object which describes the "expected" return
    values when a field with that type's resolver behaves as follows:
      containsValues: returns [1, 2]
      containsNull: returns [1, null, 2]
      returnsNull: returns null
      rejected: is a rejecting promise
      containsReject: returns an array that includes a rejecting promise
  */
  describe('[T]', () => {
    allChecks(GraphQLList(GraphQLInt), {
      containsValues: { data: dataOk },
      containsNull: { data: dataOkWithNull },
      returnsNull: { data: dataNullDeep },
      rejected: { data: dataNullDeep, errors: errorsReject },
      containsReject: { data: dataOkWithNull, errors: errorsReject1 },
    });
  });

  describe('[T]!', () => {
    allChecks(GraphQLNonNull(GraphQLList(GraphQLInt)), {
      containsValues: { data: dataOk },
      containsNull: { data: dataOkWithNull },
      returnsNull: { data: dataNull, errors: errorsNonNull },
      rejected: { data: dataNull, errors: errorsReject },
      containsReject: { data: dataOkWithNull, errors: errorsReject1 },
    });
  });

  describe('[T!]', () => {
    allChecks(GraphQLList(GraphQLNonNull(GraphQLInt)), {
      containsValues: { data: dataOk },
      containsNull: { data: dataNullDeep, errors: errorsNonNull1 },
      returnsNull: { data: dataNullDeep },
      rejected: { data: dataNullDeep, errors: errorsReject },
      containsReject: { data: dataNullDeep, errors: errorsReject1 },
    });
  });

  describe('[T!]!', () => {
    allChecks(GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLInt))), {
      containsValues: { data: dataOk },
      containsNull: { data: dataNull, errors: errorsNonNull1 },
      returnsNull: { data: dataNull, errors: errorsNonNull },
      rejected: { data: dataNull, errors: errorsReject },
      containsReject: { data: dataNull, errors: errorsReject1 },
    });
  });
});
