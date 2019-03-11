/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { valueFromASTUntyped } from '../valueFromASTUntyped';
import { parseValue } from '../../language';

describe('valueFromASTUntyped', () => {
  function testCase(valueText, expected) {
    expect(valueFromASTUntyped(parseValue(valueText))).to.deep.equal(expected);
  }

  function testCaseWithVars(valueText, variables, expected) {
    expect(valueFromASTUntyped(parseValue(valueText), variables)).to.deep.equal(
      expected,
    );
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
    testCase('[true, false]', [true, false]);
    testCase('[true, 123.45]', [true, 123.45]);
    testCase('[true, null]', [true, null]);
    testCase('[true, ["foo", 1.2]]', [true, ['foo', 1.2]]);
  });

  it('parses input objects', () => {
    testCase('{ int: 123, bool: false }', { int: 123, bool: false });
    testCase('{ foo: [ { bar: "baz"} ] }', { foo: [{ bar: 'baz' }] });
  });

  it('parses enum values as plain strings', () => {
    testCase('TEST_ENUM_VALUE', 'TEST_ENUM_VALUE');
    testCase('[TEST_ENUM_VALUE]', ['TEST_ENUM_VALUE']);
  });

  it('parses variables', () => {
    testCaseWithVars('$testVariable', { testVariable: 'foo' }, 'foo');
    testCaseWithVars('[$testVariable]', { testVariable: 'foo' }, ['foo']);
    testCaseWithVars(
      '{a:[$testVariable]}',
      { testVariable: 'foo' },
      { a: ['foo'] },
    );
    testCaseWithVars('$testVariable', { testVariable: null }, null);
    testCaseWithVars('$testVariable', {}, undefined);
  });
});
