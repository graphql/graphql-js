// @flow strict

import { describe, it } from 'mocha';
import { expect } from 'chai';

import {
  GraphQLID,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
} from '../scalars';
import { parseValue as parseValueToAST } from '../../language/parser';

describe('Type System: Specified scalar types', () => {
  describe('GraphQLInt', () => {
    it('parseValue', () => {
      function parseValue(value) {
        return GraphQLInt.parseValue(value);
      }

      expect(parseValue(1)).to.equal(1);
      expect(parseValue(0)).to.equal(0);
      expect(parseValue(-1)).to.equal(-1);

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

    it('parseLiteral', () => {
      function parseLiteral(str) {
        return GraphQLInt.parseLiteral(parseValueToAST(str));
      }

      expect(parseLiteral('1')).to.equal(1);
      expect(parseLiteral('0')).to.equal(0);
      expect(parseLiteral('-1')).to.equal(-1);

      expect(parseLiteral('9876504321')).to.equal(undefined);
      expect(parseLiteral('-9876504321')).to.equal(undefined);

      expect(parseLiteral('1.0')).to.equal(undefined);
      expect(parseLiteral('null')).to.equal(undefined);
      expect(parseLiteral('""')).to.equal(undefined);
      expect(parseLiteral('"123"')).to.equal(undefined);
      expect(parseLiteral('false')).to.equal(undefined);
      expect(parseLiteral('[1]')).to.equal(undefined);
      expect(parseLiteral('{ value: 1 }')).to.equal(undefined);
      expect(parseLiteral('ENUM_VALUE')).to.equal(undefined);
      expect(parseLiteral('$var')).to.equal(undefined);
    });
  });

  describe('GraphQLFloat', () => {
    it('parseValue', () => {
      function parseValue(value) {
        return GraphQLFloat.parseValue(value);
      }

      expect(parseValue(1)).to.equal(1);
      expect(parseValue(0)).to.equal(0);
      expect(parseValue(-1)).to.equal(-1);
      expect(parseValue(0.1)).to.equal(0.1);
      expect(parseValue(Math.PI)).to.equal(Math.PI);

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

    it('parseLiteral', () => {
      function parseLiteral(str) {
        return GraphQLFloat.parseLiteral(parseValueToAST(str));
      }

      expect(parseLiteral('1')).to.equal(1);
      expect(parseLiteral('0')).to.equal(0);
      expect(parseLiteral('-1')).to.equal(-1);
      expect(parseLiteral('0.1')).to.equal(0.1);
      expect(parseLiteral(Math.PI.toString())).to.equal(Math.PI);

      expect(parseLiteral('null')).to.equal(undefined);
      expect(parseLiteral('""')).to.equal(undefined);
      expect(parseLiteral('"123"')).to.equal(undefined);
      expect(parseLiteral('"123.5"')).to.equal(undefined);
      expect(parseLiteral('false')).to.equal(undefined);
      expect(parseLiteral('[0.1]')).to.equal(undefined);
      expect(parseLiteral('{ value: 0.1 }')).to.equal(undefined);
      expect(parseLiteral('ENUM_VALUE')).to.equal(undefined);
      expect(parseLiteral('$var')).to.equal(undefined);
    });
  });

  describe('GraphQLString', () => {
    it('parseValue', () => {
      function parseValue(value) {
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

    it('parseLiteral', () => {
      function parseLiteral(str) {
        return GraphQLString.parseLiteral(parseValueToAST(str));
      }

      expect(parseLiteral('"foo"')).to.equal('foo');
      expect(parseLiteral('"""bar"""')).to.equal('bar');

      expect(parseLiteral('null')).to.equal(undefined);
      expect(parseLiteral('1')).to.equal(undefined);
      expect(parseLiteral('0.1')).to.equal(undefined);
      expect(parseLiteral('false')).to.equal(undefined);
      expect(parseLiteral('["foo"]')).to.equal(undefined);
      expect(parseLiteral('{ value: "foo" }')).to.equal(undefined);
      expect(parseLiteral('ENUM_VALUE')).to.equal(undefined);
      expect(parseLiteral('$var')).to.equal(undefined);
    });
  });

  describe('GraphQLBoolean', () => {
    it('parseValue', () => {
      function parseValue(value) {
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

    it('parseLiteral', () => {
      function parseLiteral(str) {
        return GraphQLBoolean.parseLiteral(parseValueToAST(str));
      }

      expect(parseLiteral('true')).to.equal(true);
      expect(parseLiteral('false')).to.equal(false);

      expect(parseLiteral('null')).to.equal(undefined);
      expect(parseLiteral('0')).to.equal(undefined);
      expect(parseLiteral('1')).to.equal(undefined);
      expect(parseLiteral('0.1')).to.equal(undefined);
      expect(parseLiteral('""')).to.equal(undefined);
      expect(parseLiteral('"false"')).to.equal(undefined);
      expect(parseLiteral('[false]')).to.equal(undefined);
      expect(parseLiteral('{ value: false }')).to.equal(undefined);
      expect(parseLiteral('ENUM_VALUE')).to.equal(undefined);
      expect(parseLiteral('$var')).to.equal(undefined);
    });
  });

  describe('GraphQLID', () => {
    it('parseValue', () => {
      function parseValue(value) {
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

    it('parseLiteral', () => {
      function parseLiteral(str) {
        return GraphQLID.parseLiteral(parseValueToAST(str));
      }

      expect(parseLiteral('""')).to.equal('');
      expect(parseLiteral('"1"')).to.equal('1');
      expect(parseLiteral('"foo"')).to.equal('foo');
      expect(parseLiteral('"""foo"""')).to.equal('foo');
      expect(parseLiteral('1')).to.equal('1');
      expect(parseLiteral('0')).to.equal('0');
      expect(parseLiteral('-1')).to.equal('-1');

      // Support arbituary long numbers even if they can't be represented in JS
      expect(parseLiteral('90071992547409910')).to.equal('90071992547409910');
      expect(parseLiteral('-90071992547409910')).to.equal('-90071992547409910');

      expect(parseLiteral('null')).to.equal(undefined);
      expect(parseLiteral('0.1')).to.equal(undefined);
      expect(parseLiteral('false')).to.equal(undefined);
      expect(parseLiteral('["1"]')).to.equal(undefined);
      expect(parseLiteral('{ value: "1" }')).to.equal(undefined);
      expect(parseLiteral('ENUM_VALUE')).to.equal(undefined);
      expect(parseLiteral('$var')).to.equal(undefined);
    });
  });
});
