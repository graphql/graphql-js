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
    it('parseValue', () => {
      function parseValue(value: unknown) {
        return GraphQLInt.parseValue(value);
      }

      expect(parseValue(1)).to.equal(1);
      expect(parseValue(0)).to.equal(0);
      expect(parseValue(-1)).to.equal(-1);
      expect(parseValue(1n)).to.equal(1);

      expect(() => parseValue(9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: 9876504321',
      );
      expect(() => parseValue(-9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: -9876504321',
      );
      expect(() => parseValue(0.1)).to.throw(
        'Int cannot represent non-integer value: 0.1',
      );
      expect(() => parseValue(NaN)).to.throw(
        'Int cannot represent non-integer value: NaN',
      );
      expect(() => parseValue(Infinity)).to.throw(
        'Int cannot represent non-integer value: Infinity',
      );

      expect(() => parseValue(undefined)).to.throw(
        'Int cannot represent non-integer value: undefined',
      );
      expect(() => parseValue(null)).to.throw(
        'Int cannot represent non-integer value: null',
      );
      expect(() => parseValue('')).to.throw(
        'Int cannot represent non-integer value: ""',
      );
      expect(() => parseValue('123')).to.throw(
        'Int cannot represent non-integer value: "123"',
      );
      expect(() => parseValue(false)).to.throw(
        'Int cannot represent non-integer value: false',
      );
      expect(() => parseValue(true)).to.throw(
        'Int cannot represent non-integer value: true',
      );
      expect(() => parseValue([1])).to.throw(
        'Int cannot represent non-integer value: [1]',
      );
      expect(() => parseValue({ value: 1 })).to.throw(
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

    it('serialize', () => {
      function serialize(value: unknown) {
        return GraphQLInt.serialize(value);
      }

      expect(serialize(1)).to.equal(1);
      expect(serialize('123')).to.equal(123);
      expect(serialize(0)).to.equal(0);
      expect(serialize(-1)).to.equal(-1);
      expect(serialize(1e5)).to.equal(100000);
      expect(serialize(false)).to.equal(0);
      expect(serialize(true)).to.equal(1);
      expect(serialize(1n)).to.equal(1);

      const customValueOfObj = {
        value: 5,
        valueOf() {
          return this.value;
        },
      };
      expect(serialize(customValueOfObj)).to.equal(5);

      // The GraphQL specification does not allow serializing non-integer values
      // as Int to avoid accidental data loss.
      expect(() => serialize(0.1)).to.throw(
        'Int cannot represent non-integer value: 0.1',
      );
      expect(() => serialize(1.1)).to.throw(
        'Int cannot represent non-integer value: 1.1',
      );
      expect(() => serialize(-1.1)).to.throw(
        'Int cannot represent non-integer value: -1.1',
      );
      expect(() => serialize('-1.1')).to.throw(
        'Int cannot represent non-integer value: "-1.1"',
      );

      // Maybe a safe JavaScript int, but bigger than 2^32, so not
      // representable as a GraphQL Int
      expect(() => serialize(9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: 9876504321',
      );
      expect(() => serialize(-9876504321)).to.throw(
        'Int cannot represent non 32-bit signed integer value: -9876504321',
      );

      // Too big to represent as an Int in JavaScript or GraphQL
      expect(() => serialize(1e100)).to.throw(
        'Int cannot represent non 32-bit signed integer value: 1e+100',
      );
      expect(() => serialize(-1e100)).to.throw(
        'Int cannot represent non 32-bit signed integer value: -1e+100',
      );
      expect(() => serialize('one')).to.throw(
        'Int cannot represent non-integer value: "one"',
      );

      // Doesn't represent number
      expect(() => serialize('')).to.throw(
        'Int cannot represent non-integer value: ""',
      );
      expect(() => serialize(NaN)).to.throw(
        'Int cannot represent non-integer value: NaN',
      );
      expect(() => serialize(Infinity)).to.throw(
        'Int cannot represent non-integer value: Infinity',
      );
      expect(() => serialize([5])).to.throw(
        'Int cannot represent non-integer value: [5]',
      );
    });
  });

  describe('GraphQLFloat', () => {
    it('parseValue', () => {
      function parseValue(value: unknown) {
        return GraphQLFloat.parseValue(value);
      }

      expect(parseValue(1)).to.equal(1);
      expect(parseValue(0)).to.equal(0);
      expect(parseValue(-1)).to.equal(-1);
      expect(parseValue(0.1)).to.equal(0.1);
      expect(parseValue(Math.PI)).to.equal(Math.PI);
      expect(parseValue(1n)).to.equal(1);

      expect(() => parseValue(NaN)).to.throw(
        'Float cannot represent non numeric value: NaN',
      );
      expect(() => parseValue(Infinity)).to.throw(
        'Float cannot represent non numeric value: Infinity',
      );

      expect(() => parseValue(undefined)).to.throw(
        'Float cannot represent non numeric value: undefined',
      );
      expect(() => parseValue(null)).to.throw(
        'Float cannot represent non numeric value: null',
      );
      expect(() => parseValue('')).to.throw(
        'Float cannot represent non numeric value: ""',
      );
      expect(() => parseValue('123')).to.throw(
        'Float cannot represent non numeric value: "123"',
      );
      expect(() => parseValue('123.5')).to.throw(
        'Float cannot represent non numeric value: "123.5"',
      );
      expect(() => parseValue(false)).to.throw(
        'Float cannot represent non numeric value: false',
      );
      expect(() => parseValue(true)).to.throw(
        'Float cannot represent non numeric value: true',
      );
      expect(() => parseValue([0.1])).to.throw(
        'Float cannot represent non numeric value: [0.1]',
      );
      expect(() => parseValue({ value: 0.1 })).to.throw(
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

    it('serialize', () => {
      function serialize(value: unknown) {
        return GraphQLFloat.serialize(value);
      }

      expect(serialize(1)).to.equal(1.0);
      expect(serialize(0)).to.equal(0.0);
      expect(serialize('123.5')).to.equal(123.5);
      expect(serialize(-1)).to.equal(-1.0);
      expect(serialize(0.1)).to.equal(0.1);
      expect(serialize(1.1)).to.equal(1.1);
      expect(serialize(-1.1)).to.equal(-1.1);
      expect(serialize('-1.1')).to.equal(-1.1);
      expect(serialize(false)).to.equal(0.0);
      expect(serialize(true)).to.equal(1.0);
      expect(serialize(1n)).to.equal(1n);

      const customValueOfObj = {
        value: 5.5,
        valueOf() {
          return this.value;
        },
      };
      expect(serialize(customValueOfObj)).to.equal(5.5);

      expect(() => serialize(NaN)).to.throw(
        'Float cannot represent non numeric value: NaN',
      );
      expect(() => serialize(Infinity)).to.throw(
        'Float cannot represent non numeric value: Infinity',
      );
      expect(() => serialize('one')).to.throw(
        'Float cannot represent non numeric value: "one"',
      );
      expect(() => serialize('')).to.throw(
        'Float cannot represent non numeric value: ""',
      );
      expect(() => serialize([5])).to.throw(
        'Float cannot represent non numeric value: [5]',
      );
    });
  });

  describe('GraphQLString', () => {
    it('parseValue', () => {
      function parseValue(value: unknown) {
        return GraphQLString.parseValue(value);
      }

      expect(parseValue('foo')).to.equal('foo');

      expect(() => parseValue(undefined)).to.throw(
        'String cannot represent a non string value: undefined',
      );
      expect(() => parseValue(null)).to.throw(
        'String cannot represent a non string value: null',
      );
      expect(() => parseValue(1)).to.throw(
        'String cannot represent a non string value: 1',
      );
      expect(() => parseValue(NaN)).to.throw(
        'String cannot represent a non string value: NaN',
      );
      expect(() => parseValue(false)).to.throw(
        'String cannot represent a non string value: false',
      );
      expect(() => parseValue(['foo'])).to.throw(
        'String cannot represent a non string value: ["foo"]',
      );
      expect(() => parseValue({ value: 'foo' })).to.throw(
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

    it('serialize', () => {
      function serialize(value: unknown) {
        return GraphQLString.serialize(value);
      }

      expect(serialize('string')).to.equal('string');
      expect(serialize(1)).to.equal('1');
      expect(serialize(-1.1)).to.equal('-1.1');
      expect(serialize(true)).to.equal('true');
      expect(serialize(false)).to.equal('false');
      expect(serialize(9007199254740993n)).to.equal('9007199254740993');

      const valueOf = () => 'valueOf string';
      const toJSON = () => 'toJSON string';

      const valueOfAndToJSONValue = { valueOf, toJSON };
      expect(serialize(valueOfAndToJSONValue)).to.equal('valueOf string');

      const onlyToJSONValue = { toJSON };
      expect(serialize(onlyToJSONValue)).to.equal('toJSON string');

      expect(() => serialize(NaN)).to.throw(
        'String cannot represent value: NaN',
      );

      expect(() => serialize([1])).to.throw(
        'String cannot represent value: [1]',
      );

      const badObjValue = {};
      expect(() => serialize(badObjValue)).to.throw(
        'String cannot represent value: {}',
      );

      const badValueOfObjValue = { valueOf: 'valueOf string' };
      expect(() => serialize(badValueOfObjValue)).to.throw(
        'String cannot represent value: { valueOf: "valueOf string" }',
      );
    });
  });

  describe('GraphQLBoolean', () => {
    it('parseValue', () => {
      function parseValue(value: unknown) {
        return GraphQLBoolean.parseValue(value);
      }

      expect(parseValue(true)).to.equal(true);
      expect(parseValue(false)).to.equal(false);

      expect(() => parseValue(undefined)).to.throw(
        'Boolean cannot represent a non boolean value: undefined',
      );
      expect(() => parseValue(null)).to.throw(
        'Boolean cannot represent a non boolean value: null',
      );
      expect(() => parseValue(0)).to.throw(
        'Boolean cannot represent a non boolean value: 0',
      );
      expect(() => parseValue(1)).to.throw(
        'Boolean cannot represent a non boolean value: 1',
      );
      expect(() => parseValue(NaN)).to.throw(
        'Boolean cannot represent a non boolean value: NaN',
      );
      expect(() => parseValue('')).to.throw(
        'Boolean cannot represent a non boolean value: ""',
      );
      expect(() => parseValue('false')).to.throw(
        'Boolean cannot represent a non boolean value: "false"',
      );
      expect(() => parseValue([false])).to.throw(
        'Boolean cannot represent a non boolean value: [false]',
      );
      expect(() => parseValue({ value: false })).to.throw(
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

    it('serialize', () => {
      function serialize(value: unknown) {
        return GraphQLBoolean.serialize(value);
      }

      expect(serialize(1)).to.equal(true);
      expect(serialize(0)).to.equal(false);
      expect(serialize(1n)).to.equal(true);
      expect(serialize(0n)).to.equal(false);
      expect(serialize(true)).to.equal(true);
      expect(serialize(false)).to.equal(false);
      expect(
        serialize({
          value: true,
          valueOf() {
            return (this as { value: boolean }).value;
          },
        }),
      ).to.equal(true);

      expect(() => serialize(NaN)).to.throw(
        'Boolean cannot represent a non boolean value: NaN',
      );
      expect(() => serialize('')).to.throw(
        'Boolean cannot represent a non boolean value: ""',
      );
      expect(() => serialize('true')).to.throw(
        'Boolean cannot represent a non boolean value: "true"',
      );
      expect(() => serialize([false])).to.throw(
        'Boolean cannot represent a non boolean value: [false]',
      );
      expect(() => serialize({})).to.throw(
        'Boolean cannot represent a non boolean value: {}',
      );
    });
  });

  describe('GraphQLID', () => {
    it('parseValue', () => {
      function parseValue(value: unknown) {
        return GraphQLID.parseValue(value);
      }

      expect(parseValue('')).to.equal('');
      expect(parseValue('1')).to.equal('1');
      expect(parseValue('foo')).to.equal('foo');
      expect(parseValue(1)).to.equal('1');
      expect(parseValue(0)).to.equal('0');
      expect(parseValue(-1)).to.equal('-1');

      // Maximum and minimum safe numbers in JS
      expect(parseValue(9007199254740991)).to.equal('9007199254740991');
      expect(parseValue(-9007199254740991)).to.equal('-9007199254740991');

      // Can handle bigint in JS
      expect(parseValue(9007199254740993n)).to.equal('9007199254740993');

      expect(() => parseValue(undefined)).to.throw(
        'ID cannot represent value: undefined',
      );
      expect(() => parseValue(null)).to.throw(
        'ID cannot represent value: null',
      );
      expect(() => parseValue(0.1)).to.throw('ID cannot represent value: 0.1');
      expect(() => parseValue(NaN)).to.throw('ID cannot represent value: NaN');
      expect(() => parseValue(Infinity)).to.throw(
        'ID cannot represent value: Inf',
      );
      expect(() => parseValue(false)).to.throw(
        'ID cannot represent value: false',
      );
      expect(() => GraphQLID.parseValue(['1'])).to.throw(
        'ID cannot represent value: ["1"]',
      );
      expect(() => GraphQLID.parseValue({ value: '1' })).to.throw(
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

    it('serialize', () => {
      function serialize(value: unknown) {
        return GraphQLID.serialize(value);
      }

      expect(serialize('string')).to.equal('string');
      expect(serialize('false')).to.equal('false');
      expect(serialize('')).to.equal('');
      expect(serialize(123)).to.equal('123');
      expect(serialize(0)).to.equal('0');
      expect(serialize(-1)).to.equal('-1');
      expect(serialize(9007199254740993n)).to.equal('9007199254740993');

      const valueOf = () => 'valueOf ID';
      const toJSON = () => 'toJSON ID';

      const valueOfAndToJSONValue = { valueOf, toJSON };
      expect(serialize(valueOfAndToJSONValue)).to.equal('valueOf ID');

      const onlyToJSONValue = { toJSON };
      expect(serialize(onlyToJSONValue)).to.equal('toJSON ID');

      const badObjValue = {
        _id: false,
        valueOf() {
          return this._id;
        },
      };
      expect(() => serialize(badObjValue)).to.throw(
        'ID cannot represent value: { _id: false, valueOf: [function valueOf] }',
      );

      expect(() => serialize(true)).to.throw('ID cannot represent value: true');

      expect(() => serialize(3.14)).to.throw('ID cannot represent value: 3.14');

      expect(() => serialize({})).to.throw('ID cannot represent value: {}');

      expect(() => serialize(['abc'])).to.throw(
        'ID cannot represent value: ["abc"]',
      );
    });
  });
});
