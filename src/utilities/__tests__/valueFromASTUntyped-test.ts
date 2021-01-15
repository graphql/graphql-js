import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { Maybe } from '../../jsutils/Maybe';
import type { ObjMap } from '../../jsutils/ObjMap';

import { parseValue } from '../../language/parser';

import { valueFromASTUntyped } from '../valueFromASTUntyped';

describe('valueFromASTUntyped', () => {
  function expectValueFrom(
    valueText: string,
    variables?: Maybe<ObjMap<unknown>>,
  ) {
    const ast = parseValue(valueText);
    const value = valueFromASTUntyped(ast, variables);
    return expect(value);
  }

  it('parses simple values', () => {
    expectValueFrom('null').to.equal(null);
    expectValueFrom('true').to.equal(true);
    expectValueFrom('false').to.equal(false);
    expectValueFrom('123').to.equal(123);
    expectValueFrom('123.456').to.equal(123.456);
    expectValueFrom('"abc123"').to.equal('abc123');
  });

  it('parses lists of values', () => {
    expectValueFrom('[true, false]').to.deep.equal([true, false]);
    expectValueFrom('[true, 123.45]').to.deep.equal([true, 123.45]);
    expectValueFrom('[true, null]').to.deep.equal([true, null]);
    expectValueFrom('[true, ["foo", 1.2]]').to.deep.equal([true, ['foo', 1.2]]);
  });

  it('parses input objects', () => {
    expectValueFrom('{ int: 123, bool: false }').to.deep.equal({
      int: 123,
      bool: false,
    });
    expectValueFrom('{ foo: [ { bar: "baz"} ] }').to.deep.equal({
      foo: [{ bar: 'baz' }],
    });
  });

  it('parses enum values as plain strings', () => {
    expectValueFrom('TEST_ENUM_VALUE').to.equal('TEST_ENUM_VALUE');
    expectValueFrom('[TEST_ENUM_VALUE]').to.deep.equal(['TEST_ENUM_VALUE']);
  });

  it('parses variables', () => {
    expectValueFrom('$testVariable', { testVariable: 'foo' }).to.equal('foo');
    expectValueFrom('[$testVariable]', { testVariable: 'foo' }).to.deep.equal([
      'foo',
    ]);
    expectValueFrom('{a:[$testVariable]}', {
      testVariable: 'foo',
    }).to.deep.equal({ a: ['foo'] });
    expectValueFrom('$testVariable', { testVariable: null }).to.equal(null);
    expectValueFrom('$testVariable', { testVariable: NaN }).to.satisfy(
      Number.isNaN,
    );
    expectValueFrom('$testVariable', {}).to.equal(undefined);
    expectValueFrom('$testVariable', null).to.equal(undefined);
  });
});
