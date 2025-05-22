import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parseConstValue } from '../../language/parser.js';

import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../scalars.js';

describe('Type System: Specified scalar types', () => {
  describe('GraphQLInt', () => {
    it('coerceInputValue', () => {
      function coerceInputValue(value: unknown) {
        return GraphQLInt.coerceInputValue(value);
      }

      expect(coerceInputValue(1)).to.equal(1);
      expect(coerceInputValue(0)).to.equal(0);
      expect(coerceInputValue(-1)).to.equal(-1);

      expect(() => coerceInputValue(9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: 9876504321',
      );
      expect(() => coerceInputValue(-9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: -9876504321',
      );
      expect(() => coerceInputValue(0.1)).to.throw(
        'Int cannot represent non-integer value: 0.1',
      );
      expect(() => coerceInputValue(NaN)).to.throw(
        'Int cannot represent non-integer value: NaN',
      );
      expect(() => coerceInputValue(Infinity)).to.throw(
        'Int cannot represent non-integer value: Infinity',
      );

      expect(() => coerceInputValue(undefined)).to.throw(
        'Int cannot represent non-integer value: undefined',
      );
      expect(() => coerceInputValue(null)).to.throw(
        'Int cannot represent non-integer value: null',
      );
      expect(() => coerceInputValue('')).to.throw(
        'Int cannot represent non-integer value: ""',
      );
      expect(() => coerceInputValue('123')).to.throw(
        'Int cannot represent non-integer value: "123"',
      );
      expect(() => coerceInputValue(false)).to.throw(
        'Int cannot represent non-integer value: false',
      );
      expect(() => coerceInputValue(true)).to.throw(
        'Int cannot represent non-integer value: true',
      );
      expect(() => coerceInputValue([1])).to.throw(
        'Int cannot represent non-integer value: [1]',
      );
      expect(() => coerceInputValue({ value: 1 })).to.throw(
        'Int cannot represent non-integer value: { value: 1 }',
      );
    });

    it('coerceInputLiteral', () => {
      function coerceInputLiteral(str: string) {
        /* @ts-expect-error to be removed in v18 when all custom scalars will have default method */
        return GraphQLInt.coerceInputLiteral(parseConstValue(str));
      }

      expect(coerceInputLiteral('1')).to.equal(1);
      expect(coerceInputLiteral('0')).to.equal(0);
      expect(coerceInputLiteral('-1')).to.equal(-1);

      expect(() => coerceInputLiteral('9876504321')).to.throw(
        'Int cannot represent non 32-bit signed integer value: 9876504321',
      );
      expect(() => coerceInputLiteral('-9876504321')).to.throw(
        'Int cannot represent non 32-bit signed integer value: -9876504321',
      );

      expect(() => coerceInputLiteral('1.0')).to.throw(
        'Int cannot represent non-integer value: 1.0',
      );
      expect(() => coerceInputLiteral('null')).to.throw(
        'Int cannot represent non-integer value: null',
      );
      expect(() => coerceInputLiteral('""')).to.throw(
        'Int cannot represent non-integer value: ""',
      );
      expect(() => coerceInputLiteral('"123"')).to.throw(
        'Int cannot represent non-integer value: "123"',
      );
      expect(() => coerceInputLiteral('false')).to.throw(
        'Int cannot represent non-integer value: false',
      );
      expect(() => coerceInputLiteral('[1]')).to.throw(
        'Int cannot represent non-integer value: [1]',
      );
      expect(() => coerceInputLiteral('{ value: 1 }')).to.throw(
        'Int cannot represent non-integer value: { value: 1 }',
      );
      expect(() => coerceInputLiteral('ENUM_VALUE')).to.throw(
        'Int cannot represent non-integer value: ENUM_VALUE',
      );
    });

    it('coerceOutputValue', () => {
      function coerceOutputValue(value: unknown) {
        return GraphQLInt.coerceOutputValue(value);
      }

      expect(coerceOutputValue(1)).to.equal(1);
      expect(coerceOutputValue('123')).to.equal(123);
      expect(coerceOutputValue(0)).to.equal(0);
      expect(coerceOutputValue(-1)).to.equal(-1);
      expect(coerceOutputValue(1e5)).to.equal(100000);
      expect(coerceOutputValue(false)).to.equal(0);
      expect(coerceOutputValue(true)).to.equal(1);

      const customValueOfObj = {
        value: 5,
        valueOf() {
          return this.value;
        },
      };
      expect(coerceOutputValue(customValueOfObj)).to.equal(5);

      // The GraphQL specification does not allow serializing non-integer values
      // as Int to avoid accidental data loss.
      expect(() => coerceOutputValue(0.1)).to.throw(
        'Int cannot represent non-integer value: 0.1',
      );
      expect(() => coerceOutputValue(1.1)).to.throw(
        'Int cannot represent non-integer value: 1.1',
      );
      expect(() => coerceOutputValue(-1.1)).to.throw(
        'Int cannot represent non-integer value: -1.1',
      );
      expect(() => coerceOutputValue('-1.1')).to.throw(
        'Int cannot represent non-integer value: "-1.1"',
      );

      // Maybe a safe JavaScript int, but bigger than 2^32, so not
      // representable as a GraphQL Int
      expect(() => coerceOutputValue(9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: 9876504321',
      );
      expect(() => coerceOutputValue(-9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: -9876504321',
      );

      // Too big to represent as an Int in JavaScript or GraphQL
      expect(() => coerceOutputValue(1e100)).to.throw(
        'Int cannot represent non 32-bit signed integer value: 1e+100',
      );
      expect(() => coerceOutputValue(-1e100)).to.throw(
        'Int cannot represent non 32-bit signed integer value: -1e+100',
      );
      expect(() => coerceOutputValue('one')).to.throw(
        'Int cannot represent non-integer value: "one"',
      );

      // Doesn't represent number
      expect(() => coerceOutputValue('')).to.throw(
        'Int cannot represent non-integer value: ""',
      );
      expect(() => coerceOutputValue(NaN)).to.throw(
        'Int cannot represent non-integer value: NaN',
      );
      expect(() => coerceOutputValue(Infinity)).to.throw(
        'Int cannot represent non-integer value: Infinity',
      );
      expect(() => coerceOutputValue([5])).to.throw(
        'Int cannot represent non-integer value: [5]',
      );
    });
  });

  describe('GraphQLFloat', () => {
    it('coerceInputValue', () => {
      function coerceInputValue(value: unknown) {
        return GraphQLFloat.coerceInputValue(value);
      }

      expect(coerceInputValue(1)).to.equal(1);
      expect(coerceInputValue(0)).to.equal(0);
      expect(coerceInputValue(-1)).to.equal(-1);
      expect(coerceInputValue(0.1)).to.equal(0.1);
      expect(coerceInputValue(Math.PI)).to.equal(Math.PI);

      expect(() => coerceInputValue(NaN)).to.throw(
        'Float cannot represent non numeric value: NaN',
      );
      expect(() => coerceInputValue(Infinity)).to.throw(
        'Float cannot represent non numeric value: Infinity',
      );

      expect(() => coerceInputValue(undefined)).to.throw(
        'Float cannot represent non numeric value: undefined',
      );
      expect(() => coerceInputValue(null)).to.throw(
        'Float cannot represent non numeric value: null',
      );
      expect(() => coerceInputValue('')).to.throw(
        'Float cannot represent non numeric value: ""',
      );
      expect(() => coerceInputValue('123')).to.throw(
        'Float cannot represent non numeric value: "123"',
      );
      expect(() => coerceInputValue('123.5')).to.throw(
        'Float cannot represent non numeric value: "123.5"',
      );
      expect(() => coerceInputValue(false)).to.throw(
        'Float cannot represent non numeric value: false',
      );
      expect(() => coerceInputValue(true)).to.throw(
        'Float cannot represent non numeric value: true',
      );
      expect(() => coerceInputValue([0.1])).to.throw(
        'Float cannot represent non numeric value: [0.1]',
      );
      expect(() => coerceInputValue({ value: 0.1 })).to.throw(
        'Float cannot represent non numeric value: { value: 0.1 }',
      );
    });

    it('coerceInputLiteral', () => {
      function coerceInputLiteral(str: string) {
        /* @ts-expect-error to be removed in v18 when all custom scalars will have default method */
        return GraphQLFloat.coerceInputLiteral(parseConstValue(str));
      }

      expect(coerceInputLiteral('1')).to.equal(1);
      expect(coerceInputLiteral('0')).to.equal(0);
      expect(coerceInputLiteral('-1')).to.equal(-1);
      expect(coerceInputLiteral('0.1')).to.equal(0.1);
      expect(coerceInputLiteral(Math.PI.toString())).to.equal(Math.PI);

      expect(() => coerceInputLiteral('null')).to.throw(
        'Float cannot represent non numeric value: null',
      );
      expect(() => coerceInputLiteral('""')).to.throw(
        'Float cannot represent non numeric value: ""',
      );
      expect(() => coerceInputLiteral('"123"')).to.throw(
        'Float cannot represent non numeric value: "123"',
      );
      expect(() => coerceInputLiteral('"123.5"')).to.throw(
        'Float cannot represent non numeric value: "123.5"',
      );
      expect(() => coerceInputLiteral('false')).to.throw(
        'Float cannot represent non numeric value: false',
      );
      expect(() => coerceInputLiteral('[0.1]')).to.throw(
        'Float cannot represent non numeric value: [0.1]',
      );
      expect(() => coerceInputLiteral('{ value: 0.1 }')).to.throw(
        'Float cannot represent non numeric value: { value: 0.1 }',
      );
      expect(() => coerceInputLiteral('ENUM_VALUE')).to.throw(
        'Float cannot represent non numeric value: ENUM_VALUE',
      );
    });

    it('coerceOutputValue', () => {
      function coerceOutputValue(value: unknown) {
        return GraphQLFloat.coerceOutputValue(value);
      }

      expect(coerceOutputValue(1)).to.equal(1.0);
      expect(coerceOutputValue(0)).to.equal(0.0);
      expect(coerceOutputValue('123.5')).to.equal(123.5);
      expect(coerceOutputValue(-1)).to.equal(-1.0);
      expect(coerceOutputValue(0.1)).to.equal(0.1);
      expect(coerceOutputValue(1.1)).to.equal(1.1);
      expect(coerceOutputValue(-1.1)).to.equal(-1.1);
      expect(coerceOutputValue('-1.1')).to.equal(-1.1);
      expect(coerceOutputValue(false)).to.equal(0.0);
      expect(coerceOutputValue(true)).to.equal(1.0);

      const customValueOfObj = {
        value: 5.5,
        valueOf() {
          return this.value;
        },
      };
      expect(coerceOutputValue(customValueOfObj)).to.equal(5.5);

      expect(() => coerceOutputValue(NaN)).to.throw(
        'Float cannot represent non numeric value: NaN',
      );
      expect(() => coerceOutputValue(Infinity)).to.throw(
        'Float cannot represent non numeric value: Infinity',
      );
      expect(() => coerceOutputValue('one')).to.throw(
        'Float cannot represent non numeric value: "one"',
      );
      expect(() => coerceOutputValue('')).to.throw(
        'Float cannot represent non numeric value: ""',
      );
      expect(() => coerceOutputValue([5])).to.throw(
        'Float cannot represent non numeric value: [5]',
      );
    });
  });

  describe('GraphQLString', () => {
    it('coerceInputValue', () => {
      function coerceInputValue(value: unknown) {
        return GraphQLString.coerceInputValue(value);
      }

      expect(coerceInputValue('foo')).to.equal('foo');

      expect(() => coerceInputValue(undefined)).to.throw(
        'String cannot represent a non string value: undefined',
      );
      expect(() => coerceInputValue(null)).to.throw(
        'String cannot represent a non string value: null',
      );
      expect(() => coerceInputValue(1)).to.throw(
        'String cannot represent a non string value: 1',
      );
      expect(() => coerceInputValue(NaN)).to.throw(
        'String cannot represent a non string value: NaN',
      );
      expect(() => coerceInputValue(false)).to.throw(
        'String cannot represent a non string value: false',
      );
      expect(() => coerceInputValue(['foo'])).to.throw(
        'String cannot represent a non string value: ["foo"]',
      );
      expect(() => coerceInputValue({ value: 'foo' })).to.throw(
        'String cannot represent a non string value: { value: "foo" }',
      );
    });

    it('coerceInputLiteral', () => {
      function coerceInputLiteral(str: string) {
        /* @ts-expect-error to be removed in v18 when all custom scalars will have default method */
        return GraphQLString.coerceInputLiteral(parseConstValue(str));
      }

      expect(coerceInputLiteral('"foo"')).to.equal('foo');
      expect(coerceInputLiteral('"""bar"""')).to.equal('bar');

      expect(() => coerceInputLiteral('null')).to.throw(
        'String cannot represent a non string value: null',
      );
      expect(() => coerceInputLiteral('1')).to.throw(
        'String cannot represent a non string value: 1',
      );
      expect(() => coerceInputLiteral('0.1')).to.throw(
        'String cannot represent a non string value: 0.1',
      );
      expect(() => coerceInputLiteral('false')).to.throw(
        'String cannot represent a non string value: false',
      );
      expect(() => coerceInputLiteral('["foo"]')).to.throw(
        'String cannot represent a non string value: ["foo"]',
      );
      expect(() => coerceInputLiteral('{ value: "foo" }')).to.throw(
        'String cannot represent a non string value: { value: "foo" }',
      );
      expect(() => coerceInputLiteral('ENUM_VALUE')).to.throw(
        'String cannot represent a non string value: ENUM_VALUE',
      );
    });

    it('coerceOutputValue', () => {
      function coerceOutputValue(value: unknown) {
        return GraphQLString.coerceOutputValue(value);
      }

      expect(coerceOutputValue('string')).to.equal('string');
      expect(coerceOutputValue(1)).to.equal('1');
      expect(coerceOutputValue(-1.1)).to.equal('-1.1');
      expect(coerceOutputValue(true)).to.equal('true');
      expect(coerceOutputValue(false)).to.equal('false');

      const valueOf = () => 'valueOf string';
      const toJSON = () => 'toJSON string';

      const valueOfAndToJSONValue = { valueOf, toJSON };
      expect(coerceOutputValue(valueOfAndToJSONValue)).to.equal(
        'valueOf string',
      );

      const onlyToJSONValue = { toJSON };
      expect(coerceOutputValue(onlyToJSONValue)).to.equal('toJSON string');

      expect(() => coerceOutputValue(NaN)).to.throw(
        'String cannot represent value: NaN',
      );

      expect(() => coerceOutputValue([1])).to.throw(
        'String cannot represent value: [1]',
      );

      const badObjValue = {};
      expect(() => coerceOutputValue(badObjValue)).to.throw(
        'String cannot represent value: {}',
      );

      const badValueOfObjValue = { valueOf: 'valueOf string' };
      expect(() => coerceOutputValue(badValueOfObjValue)).to.throw(
        'String cannot represent value: { valueOf: "valueOf string" }',
      );
    });
  });

  describe('GraphQLBoolean', () => {
    it('coerceInputValue', () => {
      function coerceInputValue(value: unknown) {
        return GraphQLBoolean.coerceInputValue(value);
      }

      expect(coerceInputValue(true)).to.equal(true);
      expect(coerceInputValue(false)).to.equal(false);

      expect(() => coerceInputValue(undefined)).to.throw(
        'Boolean cannot represent a non boolean value: undefined',
      );
      expect(() => coerceInputValue(null)).to.throw(
        'Boolean cannot represent a non boolean value: null',
      );
      expect(() => coerceInputValue(0)).to.throw(
        'Boolean cannot represent a non boolean value: 0',
      );
      expect(() => coerceInputValue(1)).to.throw(
        'Boolean cannot represent a non boolean value: 1',
      );
      expect(() => coerceInputValue(NaN)).to.throw(
        'Boolean cannot represent a non boolean value: NaN',
      );
      expect(() => coerceInputValue('')).to.throw(
        'Boolean cannot represent a non boolean value: ""',
      );
      expect(() => coerceInputValue('false')).to.throw(
        'Boolean cannot represent a non boolean value: "false"',
      );
      expect(() => coerceInputValue([false])).to.throw(
        'Boolean cannot represent a non boolean value: [false]',
      );
      expect(() => coerceInputValue({ value: false })).to.throw(
        'Boolean cannot represent a non boolean value: { value: false }',
      );
    });

    it('coerceInputLiteral', () => {
      function coerceInputLiteral(str: string) {
        /* @ts-expect-error to be removed in v18 when all custom scalars will have default method */
        return GraphQLBoolean.coerceInputLiteral(parseConstValue(str));
      }

      expect(coerceInputLiteral('true')).to.equal(true);
      expect(coerceInputLiteral('false')).to.equal(false);

      expect(() => coerceInputLiteral('null')).to.throw(
        'Boolean cannot represent a non boolean value: null',
      );
      expect(() => coerceInputLiteral('0')).to.throw(
        'Boolean cannot represent a non boolean value: 0',
      );
      expect(() => coerceInputLiteral('1')).to.throw(
        'Boolean cannot represent a non boolean value: 1',
      );
      expect(() => coerceInputLiteral('0.1')).to.throw(
        'Boolean cannot represent a non boolean value: 0.1',
      );
      expect(() => coerceInputLiteral('""')).to.throw(
        'Boolean cannot represent a non boolean value: ""',
      );
      expect(() => coerceInputLiteral('"false"')).to.throw(
        'Boolean cannot represent a non boolean value: "false"',
      );
      expect(() => coerceInputLiteral('[false]')).to.throw(
        'Boolean cannot represent a non boolean value: [false]',
      );
      expect(() => coerceInputLiteral('{ value: false }')).to.throw(
        'Boolean cannot represent a non boolean value: { value: false }',
      );
      expect(() => coerceInputLiteral('ENUM_VALUE')).to.throw(
        'Boolean cannot represent a non boolean value: ENUM_VALUE',
      );
    });

    it('coerceOutputValue', () => {
      function coerceOutputValue(value: unknown) {
        return GraphQLBoolean.coerceOutputValue(value);
      }

      expect(coerceOutputValue(1)).to.equal(true);
      expect(coerceOutputValue(0)).to.equal(false);
      expect(coerceOutputValue(true)).to.equal(true);
      expect(coerceOutputValue(false)).to.equal(false);
      expect(
        coerceOutputValue({
          value: true,
          valueOf() {
            return (this as { value: boolean }).value;
          },
        }),
      ).to.equal(true);

      expect(() => coerceOutputValue(NaN)).to.throw(
        'Boolean cannot represent a non boolean value: NaN',
      );
      expect(() => coerceOutputValue('')).to.throw(
        'Boolean cannot represent a non boolean value: ""',
      );
      expect(() => coerceOutputValue('true')).to.throw(
        'Boolean cannot represent a non boolean value: "true"',
      );
      expect(() => coerceOutputValue([false])).to.throw(
        'Boolean cannot represent a non boolean value: [false]',
      );
      expect(() => coerceOutputValue({})).to.throw(
        'Boolean cannot represent a non boolean value: {}',
      );
    });
  });

  describe('GraphQLID', () => {
    it('coerceInputValue', () => {
      function coerceInputValue(value: unknown) {
        return GraphQLID.coerceInputValue(value);
      }

      expect(coerceInputValue('')).to.equal('');
      expect(coerceInputValue('1')).to.equal('1');
      expect(coerceInputValue('foo')).to.equal('foo');
      expect(coerceInputValue(1)).to.equal('1');
      expect(coerceInputValue(0)).to.equal('0');
      expect(coerceInputValue(-1)).to.equal('-1');

      // Maximum and minimum safe numbers in JS
      expect(coerceInputValue(9007199254740991)).to.equal('9007199254740991');
      expect(coerceInputValue(-9007199254740991)).to.equal('-9007199254740991');

      expect(() => coerceInputValue(undefined)).to.throw(
        'ID cannot represent value: undefined',
      );
      expect(() => coerceInputValue(null)).to.throw(
        'ID cannot represent value: null',
      );
      expect(() => coerceInputValue(0.1)).to.throw(
        'ID cannot represent value: 0.1',
      );
      expect(() => coerceInputValue(NaN)).to.throw(
        'ID cannot represent value: NaN',
      );
      expect(() => coerceInputValue(Infinity)).to.throw(
        'ID cannot represent value: Inf',
      );
      expect(() => coerceInputValue(false)).to.throw(
        'ID cannot represent value: false',
      );
      expect(() => GraphQLID.coerceInputValue(['1'])).to.throw(
        'ID cannot represent value: ["1"]',
      );
      expect(() => GraphQLID.coerceInputValue({ value: '1' })).to.throw(
        'ID cannot represent value: { value: "1" }',
      );
    });

    it('coerceInputLiteral', () => {
      function coerceInputLiteral(str: string) {
        /* @ts-expect-error to be removed in v18 when all custom scalars will have default method */
        return GraphQLID.coerceInputLiteral(parseConstValue(str));
      }

      expect(coerceInputLiteral('""')).to.equal('');
      expect(coerceInputLiteral('"1"')).to.equal('1');
      expect(coerceInputLiteral('"foo"')).to.equal('foo');
      expect(coerceInputLiteral('"""foo"""')).to.equal('foo');
      expect(coerceInputLiteral('1')).to.equal('1');
      expect(coerceInputLiteral('0')).to.equal('0');
      expect(coerceInputLiteral('-1')).to.equal('-1');

      // Support arbitrary long numbers even if they can't be represented in JS
      expect(coerceInputLiteral('90071992547409910')).to.equal(
        '90071992547409910',
      );
      expect(coerceInputLiteral('-90071992547409910')).to.equal(
        '-90071992547409910',
      );

      expect(() => coerceInputLiteral('null')).to.throw(
        'ID cannot represent a non-string and non-integer value: null',
      );
      expect(() => coerceInputLiteral('0.1')).to.throw(
        'ID cannot represent a non-string and non-integer value: 0.1',
      );
      expect(() => coerceInputLiteral('false')).to.throw(
        'ID cannot represent a non-string and non-integer value: false',
      );
      expect(() => coerceInputLiteral('["1"]')).to.throw(
        'ID cannot represent a non-string and non-integer value: ["1"]',
      );
      expect(() => coerceInputLiteral('{ value: "1" }')).to.throw(
        'ID cannot represent a non-string and non-integer value: { value: "1" }',
      );
      expect(() => coerceInputLiteral('ENUM_VALUE')).to.throw(
        'ID cannot represent a non-string and non-integer value: ENUM_VALUE',
      );
    });

    it('coerceOutputValue', () => {
      function coerceOutputValue(value: unknown) {
        return GraphQLID.coerceOutputValue(value);
      }

      expect(coerceOutputValue('string')).to.equal('string');
      expect(coerceOutputValue('false')).to.equal('false');
      expect(coerceOutputValue('')).to.equal('');
      expect(coerceOutputValue(123)).to.equal('123');
      expect(coerceOutputValue(0)).to.equal('0');
      expect(coerceOutputValue(-1)).to.equal('-1');

      const valueOf = () => 'valueOf ID';
      const toJSON = () => 'toJSON ID';

      const valueOfAndToJSONValue = { valueOf, toJSON };
      expect(coerceOutputValue(valueOfAndToJSONValue)).to.equal('valueOf ID');

      const onlyToJSONValue = { toJSON };
      expect(coerceOutputValue(onlyToJSONValue)).to.equal('toJSON ID');

      const badObjValue = {
        _id: false,
        valueOf() {
          return this._id;
        },
      };
      expect(() => coerceOutputValue(badObjValue)).to.throw(
        'ID cannot represent value: { _id: false, valueOf: [function valueOf] }',
      );

      expect(() => coerceOutputValue(true)).to.throw(
        'ID cannot represent value: true',
      );

      expect(() => coerceOutputValue(3.14)).to.throw(
        'ID cannot represent value: 3.14',
      );

      expect(() => coerceOutputValue({})).to.throw(
        'ID cannot represent value: {}',
      );

      expect(() => coerceOutputValue(['abc'])).to.throw(
        'ID cannot represent value: ["abc"]',
      );
    });
  });
});
