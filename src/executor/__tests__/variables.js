/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../executor';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
} from '../../type';


var TestInputObject = new GraphQLInputObjectType({
  name: 'TestInputObject',
  fields: {
    a: { type: GraphQLString },
    b: { type: new GraphQLList(GraphQLString) },
    c: { type: new GraphQLNonNull(GraphQLString) }
  }
});

var TestType = new GraphQLObjectType({
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

var schema = new GraphQLSchema({ query: TestType });

describe('Execute: Handles inputs', () => {

  describe('Handles objects and nullability', () => {

    describe('using inline structs', () => {

      it('executes with complex input', async () => {
        var doc = `
        {
          fieldWithObjectInput(input: {a: "foo", b: ["bar"], c: "baz"})
        }
        `;
        var ast = parse(doc);

        return expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('properly coerces single value to array', async () => {
        var doc = `
        {
          fieldWithObjectInput(input: {a: "foo", b: "bar", c: "baz"})
        }
        `;
        var ast = parse(doc);

        return expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('does not use incorrect value', async () => {
        var doc = `
        {
          fieldWithObjectInput(input: ["foo", "bar", "baz"])
        }
        `;
        var ast = parse(doc);

        var result = await execute(schema, ast);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: null
          }
        });
      });
    });

    describe('using variables', () => {

      var doc = `
        query q($input: TestInputObject) {
          fieldWithObjectInput(input: $input)
        }
      `;
      var ast = parse(doc);

      it('executes with complex input', async () => {
        var params = {input: {a: 'foo', b: ['bar'], c: 'baz'}};
        var result = await execute(schema, ast, null, params);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('uses default value when not provided', async () => {
        var withDefaultsAST = parse(`
          query q($input: TestInputObject = {a: "foo", b: ["bar"], c: "baz"}) {
            fieldWithObjectInput(input: $input)
          }
        `);

        var result = await execute(schema, withDefaultsAST);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('properly coerces single value to array', async () => {
        var params = {input: {a: 'foo', b: 'bar', c: 'baz'}};
        var result = await execute(schema, ast, null, params);

        return expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}'
          }
        });
      });

      it('errors on null for nested non-null', async () => {
        var params = {input: {a: 'foo', b: 'bar', c: null}};

        var caughtError;
        try {
          execute(schema, ast, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable $input expected value of type TestInputObject but ' +
            'got: {"a":"foo","b":"bar","c":null}.'
        });
      });

      it('errors on incorrect type', async () => {
        var params = {input: 'foo bar'};

        var caughtError;
        try {
          execute(schema, ast, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable $input expected value of type TestInputObject but ' +
            'got: "foo bar".'
        });
      });

      it('errors on omission of nested non-null', async () => {
        var params = {input: {a: 'foo', b: 'bar'}};

        var caughtError;
        try {
          execute(schema, ast, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable $input expected value of type TestInputObject but ' +
            'got: {"a":"foo","b":"bar"}.'
        });
      });

      it('errors on addition of unknown input field', async () => {
        var params = {input: {a: 'foo', b: 'bar', c: 'baz', d: 'dog'}};

        var caughtError;
        try {
          execute(schema, ast, null, params);
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).to.containSubset({
          locations: [ { line: 2, column: 17 } ],
          message:
            'Variable $input expected value of type TestInputObject but ' +
            'got: {"a":"foo","b":"bar","c":"baz","d":"dog"}.'
        });
      });

    });
  });

  describe('Handles nullable scalars', () => {
    it('allows nullable inputs to be omitted', async () => {
      var doc = `
      {
        fieldWithNullableStringInput
      }
      `;
      var ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be omitted in a variable', async () => {
      var doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      var ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be omitted in an unlisted variable', async () => {
      var doc = `
      query SetsNullable {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      var ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be set to null in a variable', async () => {
      var doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {value: null})
      ).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null
        }
      });
    });

    it('allows nullable inputs to be set to a value in a variable', async () => {
      var doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {value: 'a'})
      ).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"a"'
        }
      });
    });

    it('allows nullable inputs to be set to a value directly', async () => {
      var doc = `
      {
        fieldWithNullableStringInput(input: "a")
      }
      `;
      var ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"a"'
        }
      });
    });
  });

  describe('Handles non-nullable scalars', () => {
    it('does not allow non-nullable inputs to be omitted in a variable', async () => {
      var doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;

      var caughtError;
      try {
        execute(schema, parse(doc));
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 31 } ],
        message:
          'Variable $value expected value of type String! but got: undefined.'
      });
    });

    it('does not allow non-nullable inputs to be set to null in a variable', async () => {
      var doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      var ast = parse(doc);

      var caughtError;
      try {
        execute(schema, ast, null, {value: null});
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 31 } ],
        message:
          'Variable $value expected value of type String! but got: null.'
      });
    });

    it('allows non-nullable inputs to be set to a value in a variable', async () => {
      var doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {value: 'a'})
      ).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"a"'
        }
      });
    });

    it('allows non-nullable inputs to be set to a value directly', async () => {
      var doc = `
      {
        fieldWithNonNullableStringInput(input: "a")
      }
      `;
      var ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"a"'
        }
      });
    });

    it('passes along null for non-nullable inputs if explcitly set in the query', async () => {
      var doc = `
      {
        fieldWithNonNullableStringInput
      }
      `;
      var ast = parse(doc);

      return expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: null
        }
      });
    });
  });

  describe('Handles lists and nullability', () => {
    it('allows lists to be null', async () => {
      var doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: null})
      ).to.deep.equal({
        data: {
          list: null
        }
      });
    });

    it('allows lists to contain values', async () => {
      var doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: ['A']})
      ).to.deep.equal({
        data: {
          list: '["A"]'
        }
      });
    });

    it('allows lists to contain null', async () => {
      var doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: ['A', null, 'B']})
      ).to.deep.equal({
        data: {
          list: '["A",null,"B"]'
        }
      });
    });

    it('does not allow non-null lists to be null', async () => {
      var doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      var ast = parse(doc);

      var caughtError;
      try {
        execute(schema, ast, null, {input: null});
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable $input expected value of type [String]! but got: null.'
      });
    });

    it('allows non-null lists to contain values', async () => {
      var doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: ['A']})
      ).to.deep.equal({
        data: {
          nnList: '["A"]'
        }
      });
    });

    it('allows non-null lists to contain null', async () => {
      var doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: ['A', null, 'B']})
      ).to.deep.equal({
        data: {
          nnList: '["A",null,"B"]'
        }
      });
    });

    it('allows lists of non-nulls to be null', async () => {
      var doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: null})
      ).to.deep.equal({
        data: {
          listNN: null
        }
      });
    });

    it('allows lists of non-nulls to contain values', async () => {
      var doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: ['A']})
      ).to.deep.equal({
        data: {
          listNN: '["A"]'
        }
      });
    });

    it('does not allow lists of non-nulls to contain null', async () => {
      var doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      var ast = parse(doc);
      var vars = {input: ['A', null, 'B']};

      var caughtError;
      try {
        execute(schema, ast, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable $input expected value of type [String!] but got: ' +
          '["A",null,"B"].'
      });
    });

    it('does not allow non-null lists of non-nulls to be null', async () => {
      var doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      var ast = parse(doc);

      var caughtError;
      try {
        execute(schema, ast, null, {input: null});
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
          message:
            'Variable $input expected value of type [String!]! but got: null.'
      });
    });

    it('allows non-null lists of non-nulls to contain values', async () => {
      var doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      var ast = parse(doc);

      return expect(
        await execute(schema, ast, null, {input: ['A']})
      ).to.deep.equal({
        data: {
          nnListNN: '["A"]'
        }
      });
    });

    it('does not allow non-null lists of non-nulls to contain null', async () => {
      var doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      var ast = parse(doc);
      var vars = { input: ['A', null, 'B'] };

      var caughtError;
      try {
        execute(schema, ast, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable $input expected value of type [String!]! but got: ' +
          '["A",null,"B"].'
      });
    });

    it('does not allow invalid types to be used as values', async () => {
      var doc = `
        query q($input: TestType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      var ast = parse(doc);
      var vars = { input: { list: ['A', 'B'] } };

      var caughtError;
      try {
        execute(schema, ast, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable $input expected value of type TestType! which cannot ' +
          'be used as an input type.'
      });
    });

    it('does not allow unknown types to be used as values', async () => {
      var doc = `
        query q($input: UnknownType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      var ast = parse(doc);
      var vars = { input: 'whoknows' };

      var caughtError;
      try {
        execute(schema, ast, null, vars);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.containSubset({
        locations: [ { line: 2, column: 17 } ],
        message:
          'Variable $input expected value of type UnknownType! which cannot ' +
          'be used as an input type.'
      });
    });

  });
});
