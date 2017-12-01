/**
 *  Copyright (c) 2017, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { scalarValueFromAST } from '../scalarValueFromAST';
import { parseValue } from '../../language';

describe('scalarValueFromAST', () => {

  function testCase(valueText, expected) {
    expect(
      scalarValueFromAST(parseValue(valueText))
    ).to.deep.equal(expected);
  }

  function testNegativeCase(valueText, errorMsg) {
    expect(
      () => scalarValueFromAST(parseValue(valueText))
    ).to.throw(errorMsg);
  }

  it('parses simple values', () => {
    testCase('null', null);
    testCase('true', true);
    testCase('false', false);
    testCase('123', 123);
    testCase('123.456', 123.456);
    testCase('"abc123"', 'abc123');
  });

  it('parses lists of values', () => {
    testCase('[true, false]', [ true, false ]);
    testCase('[true, 123.45]', [ true, 123.45 ]);
    testCase('[true, null]', [ true, null ]);
    testCase('[true, ["foo", 1.2]]', [ true, [ 'foo', 1.2 ] ]);
  });

  it('parses input objects', () => {
    testCase(
      '{ int: 123, requiredBool: false }',
      { int: 123, requiredBool: false }
    );
    testCase(
      '{ foo: [{ bar: "baz"}]}',
      { foo: [ { bar: 'baz'} ] }
    );
  });

  it('rejects enum values and query variables', () => {
    testNegativeCase('TEST_ENUM_VALUE', 'Scalar value can not contain Enum.');
    testNegativeCase(
      '$test_variable',
      'Scalar value can not contain Query variable.'
    );
    testNegativeCase('[TEST_ENUM_VALUE]', 'Scalar value can not contain Enum.');
    testNegativeCase(
      '[$test_variable]',
      'Scalar value can not contain Query variable.'
    );
    testNegativeCase(
      '{foo: TEST_ENUM_VALUE}',
      'Scalar value can not contain Enum.'
    );
    testNegativeCase(
      '{bar: $test_variable}',
      'Scalar value can not contain Query variable.'
    );
  });

});
