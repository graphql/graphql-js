/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/* eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../execute';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
  GraphQLScalarType
} from '../../type';

const TestComplexScalar = new GraphQLScalarType({
  name: 'ComplexScalar',
  serialize(value) {
    if (value === 'DeserializedValue') {
      return 'SerializedValue';
    }
    return null;
  },
  parseValue(value) {
    if (value === 'SerializedValue') {
      return 'DeserializedValue';
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.value === 'SerializedValue') {
      return 'DeserializedValue';
    }
    return null;
  },
});

const TestInputObject = new GraphQLInputObjectType({
  name: 'TestInputObject',
  fields: {
    a: { type: GraphQLString },
    b: { type: new GraphQLList(GraphQLString) },
    c: { type: new GraphQLNonNull(GraphQLString) },
    d: { type: TestComplexScalar },
  }
});

const TestNestedInputObject = new GraphQLInputObjectType({
  name: 'TestNestedInputObject',
  fields: {
    na: { type: new GraphQLNonNull(TestInputObject) },
    nb: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const TestType = new GraphQLObjectType({
  name: 'TestType',
  fields: {
    fieldWithObjectInput: {
      type: GraphQLString,
      args: { input: { type: TestInputObject } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    fieldWithNullableStringInput: {
      type: GraphQLString,
      args: { input: { type: GraphQLString } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    fieldWithNonNullableStringInput: {
      type: GraphQLString,
      args: { input: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    fieldWithDefaultArgumentValue: {
      type: GraphQLString,
      args: { input: { type: GraphQLString, defaultValue: 'Hello World' } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    fieldWithNestedInputObject: {
      type: GraphQLString,
      args: {
        input: {
          type: TestNestedInputObject, defaultValue: 'Hello World'
        }
      },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    list: {
      type: GraphQLString,
      args: { input: { type: new GraphQLList(GraphQLString) } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    nnList: {
      type: GraphQLString,
      args: { input: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    listNN: {
      type: GraphQLString,
      args: { input: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
    nnListNN: {
      type: GraphQLString,
      args: { input: { type:
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))
      } },
      resolve: (_, { input }) => input && JSON.stringify(input)
    },
  }
});

const schema = new GraphQLSchema({ query: TestType });

describe('Execute: Handles inputs', () => {

  describe('Handles objects and nullability', () => {

    describe('using inline structs', () => {

      it('executes with complex input', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {a: "foo", b: ["bar"], c: "baz"})
        }
        `;
        const ast = parse(doc);

        return expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('properly parses single value to list', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {a: "foo", b: "bar", c: "baz"})
        }
        `;
        const ast = parse(doc);

        return expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('does not use incorrect value', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: ["foo", "bar", "baz"])
        }
        `;
        const ast = parse(doc);

        const result = await execute(schema, ast);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: null
          }
        });
      });

      it('properly runs parseLiteral on complex scalar types', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {a: "foo", d: "SerializedValue"})
        }
        `;
        const ast = parse(doc);

        return expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","d":"DeserializedValue"}',
          }
        });
      });

    });

    describe('using variables', () => {

      const doc = `
        query q($input: TestInputObject) {
          fieldWithObjectInput(input: $input)
        }
      `;
      const ast = parse(doc);

      it('executes with complex input', async () => {
        const params = { input: { a: 'foo', b: [ 'bar' ], c: 'baz' } };
        const result = await execute(schema, ast, null, null, params);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('uses default value when not provided', async () => {
        const withDefaultsAST = parse(`
          query q($input: TestInputObject = {a: "foo", b: ["bar"], c: "baz"}) {
            fieldWithObjectInput(input: $input)
          }
        `);

        const result = await execute(schema, withDefaultsAST);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('properly parses single value to list', async () => {
        const params = { input: { a: 'foo', b: 'bar', c: 'baz' } };
        const result = await execute(schema, ast, null, null, params);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('executes with complex scalar input', async () => {
        const params = { input: { c: 'foo', d: 'SerializedValue' } };
        const result = await execute(schema, ast, null, null, params);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"c":"foo","d":"DeserializedValue"}'
          }
        });
      });

      it('errors on null for nested non-null', async () => {
        const params = { input: { a: 'foo', b: 'bar', c: null } };

        let caughtError;
        try {
          execute(schema, ast, null, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable "$input" got invalid value ' +
            '{"a":"foo","b":"bar","c":null}.' +
            '\nIn field "c": Expected "String!", found null.'
        });
      });

      it('errors on incorrect type', async () => {
        const params = { input: 'foo bar' };

        let caughtError;
        try {
          execute(schema, ast, null, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable "$input" got invalid value "foo bar".' +
            '\nExpected "TestInputObject", found not an object.'
        });
      });

      it('errors on omission of nested non-null', async () => {
        const params = { input: { a: 'foo', b: 'bar' } };

        let caughtError;
        try {
          execute(schema, ast, null, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable "$input" got invalid value {"a":"foo","b":"bar"}.' +
            '\nIn field "c": Expected "String!", found null.'
        });
      });

      it('errors on deep nested errors and with many errors', async () => {
        const nestedDoc = `
          query q($input: TestNestedInputObject) {
            fieldWithNestedObjectInput(input: $input)
          }
        `;
        const nestedAst = parse(nestedDoc);
        const params = { input: { na: { a: 'foo' } } };

        let caughtError;
        try {
          execute(schema, nestedAst, null, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 19 } ],
          message:
            'Variable "$input" got invalid value {"na":{"a":"foo"}}.' +
            '\nIn field "na": In field "c": Expected "String!", found null.' +
            '\nIn field "nb": Expected "String!", found null.'
        });

      });

      it('errors on addition of unknown input field', async () => {
        const params = {
          input: { a: 'foo', b: 'bar', c: 'baz', extra: 'dog' }
        };

        let caughtError;
        try {
          execute(schema, ast, null, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable "$input" got invalid value ' +
             '{"a":"foo","b":"bar","c":"baz","extra":"dog"}.' +
             '\nIn field \"extra\": Unknown field.'
        });
      });

    });
  });

  describe('Handles nullable scalars', () => {
    it('allows nullable inputs to be omitted', async () => {
      const doc = `
      {
        fieldWithNullableStringInput
      }
      `;
      const ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be omitted in a variable', async () => {
      const doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be omitted in an unlisted variable', async () => {
      const doc = `
      query SetsNullable {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be set to null in a variable', async () => {
      const doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { value: null })
      ).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be set to a value in a variable', async () => {
      const doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { value: 'a' })
      ).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"a"'
        }
      });
    });

    it('allows nullable inputs to be set to a value directly', async () => {
      const doc = `
      {
        fieldWithNullableStringInput(input: "a")
      }
      `;
      const ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"a"'
        }
      });
    });
  });

  describe('Handles non-nullable scalars', () => {
    it('does not allow non-nullable inputs to be omitted in a variable', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;

      let caughtError;
      try {
        execute(schema, parse(doc));
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 31 } ],
        message:
          'Variable "$value" of required type "String!" was not provided.'
      });
    });

    it('does not allow non-nullable inputs to be set to null in a variable', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const ast = parse(doc);

      let caughtError;
      try {
        execute(schema, ast, null, null, { value: null });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 31 } ],
        message:
          'Variable "$value" of required type "String!" was not provided.'
      });
    });

    it('allows non-nullable inputs to be set to a value in a variable', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { value: 'a' })
      ).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"a"'
        }
      });
    });

    it('allows non-nullable inputs to be set to a value directly', async () => {
      const doc = `
      {
        fieldWithNonNullableStringInput(input: "a")
      }
      `;
      const ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"a"'
        }
      });
    });

    it('passes along null for non-nullable inputs if explcitly set in the query', async () => {
      const doc = `
      {
        fieldWithNonNullableStringInput
      }
      `;
      const ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: null
        }
      });
    });
  });

  describe('Handles lists and nullability', () => {
    it('allows lists to be null', async () => {
      const doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: null })
      ).to.deep.equal({
        data: {
          list: null
        }
      });
    });

    it('allows lists to contain values', async () => {
      const doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: [ 'A' ] })
      ).to.deep.equal({
        data: {
          list: '["A"]'
        }
      });
    });

    it('allows lists to contain null', async () => {
      const doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: [ 'A', null, 'B' ] })
      ).to.deep.equal({
        data: {
          list: '["A",null,"B"]'
        }
      });
    });

    it('does not allow non-null lists to be null', async () => {
      const doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const ast = parse(doc);

      let caughtError;
      try {
        execute(schema, ast, null, null, { input: null });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable "$input" of required type "[String]!" was not provided.'
      });
    });

    it('allows non-null lists to contain values', async () => {
      const doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: [ 'A' ] })
      ).to.deep.equal({
        data: {
          nnList: '["A"]'
        }
      });
    });

    it('allows non-null lists to contain null', async () => {
      const doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: [ 'A', null, 'B' ] })
      ).to.deep.equal({
        data: {
          nnList: '["A",null,"B"]'
        }
      });
    });

    it('allows lists of non-nulls to be null', async () => {
      const doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: null })
      ).to.deep.equal({
        data: {
          listNN: null
        }
      });
    });

    it('allows lists of non-nulls to contain values', async () => {
      const doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: [ 'A' ] })
      ).to.deep.equal({
        data: {
          listNN: '["A"]'
        }
      });
    });

    it('does not allow lists of non-nulls to contain null', async () => {
      const doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: [ 'A', null, 'B' ] };

      let caughtError;
      try {
        execute(schema, ast, null, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable "$input" got invalid value ["A",null,"B"].' +
          '\nIn element #1: Expected "String!", found null.'
      });
    });

    it('does not allow non-null lists of non-nulls to be null', async () => {
      const doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const ast = parse(doc);

      let caughtError;
      try {
        execute(schema, ast, null, null, { input: null });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable "$input" of required type "[String!]!" was not provided.'
      });
    });

    it('allows non-null lists of non-nulls to contain values', async () => {
      const doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const ast = parse(doc);

      return expect(
        await execute(schema, ast, null, null, { input: [ 'A' ] })
      ).to.deep.equal({
        data: {
          nnListNN: '["A"]'
        }
      });
    });

    it('does not allow non-null lists of non-nulls to contain null', async () => {
      const doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: [ 'A', null, 'B' ] };

      let caughtError;
      try {
        execute(schema, ast, null, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable "$input" got invalid value ["A",null,"B"].' +
          '\nIn element #1: Expected "String!", found null.'
      });
    });

    it('does not allow invalid types to be used as values', async () => {
      const doc = `
        query q($input: TestType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: { list: [ 'A', 'B' ] } };

      let caughtError;
      try {
        execute(schema, ast, null, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable "$input" expected value of type "TestType!" which cannot ' +
          'be used as an input type.'
      });
    });

    it('does not allow unknown types to be used as values', async () => {
      const doc = `
        query q($input: UnknownType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: 'whoknows' };

      let caughtError;
      try {
        execute(schema, ast, null, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable "$input" expected value of type "UnknownType!" which ' +
          'cannot be used as an input type.'
      });
    });

  });

  describe('Execute: Uses argument default values', () => {

    it('when no argument provided', async () => {
      const ast = parse(`{
        fieldWithDefaultArgumentValue
      }`);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: '"Hello World"'
        }
      });
    });

    it('when nullable variable provided', async () => {
      const ast = parse(`query optionalVariable($optional: String) {
        fieldWithDefaultArgumentValue(input: $optional)
      }`);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: '"Hello World"'
        }
      });
    });

    it('when argument provided cannot be parsed', async () => {
      const ast = parse(`{
        fieldWithDefaultArgumentValue(input: WRONG_TYPE)
      }`);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: '"Hello World"'
        }
      });
    });

  });

});
