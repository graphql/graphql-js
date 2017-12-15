/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
  GraphQLScalarType,
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
    b: { type: GraphQLList(GraphQLString) },
    c: { type: GraphQLNonNull(GraphQLString) },
    d: { type: TestComplexScalar },
  },
});

const TestNestedInputObject = new GraphQLInputObjectType({
  name: 'TestNestedInputObject',
  fields: {
    na: { type: GraphQLNonNull(TestInputObject) },
    nb: { type: GraphQLNonNull(GraphQLString) },
  },
});

const TestType = new GraphQLObjectType({
  name: 'TestType',
  fields: {
    fieldWithObjectInput: {
      type: GraphQLString,
      args: { input: { type: TestInputObject } },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    fieldWithNullableStringInput: {
      type: GraphQLString,
      args: { input: { type: GraphQLString } },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    fieldWithNonNullableStringInput: {
      type: GraphQLString,
      args: { input: { type: GraphQLNonNull(GraphQLString) } },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    fieldWithDefaultArgumentValue: {
      type: GraphQLString,
      args: { input: { type: GraphQLString, defaultValue: 'Hello World' } },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    fieldWithNestedInputObject: {
      type: GraphQLString,
      args: {
        input: {
          type: TestNestedInputObject,
          defaultValue: 'Hello World',
        },
      },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    list: {
      type: GraphQLString,
      args: { input: { type: GraphQLList(GraphQLString) } },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    nnList: {
      type: GraphQLString,
      args: {
        input: { type: GraphQLNonNull(GraphQLList(GraphQLString)) },
      },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    listNN: {
      type: GraphQLString,
      args: {
        input: { type: GraphQLList(GraphQLNonNull(GraphQLString)) },
      },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
    nnListNN: {
      type: GraphQLString,
      args: {
        input: {
          type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
        },
      },
      resolve: (_, { input }) => input && JSON.stringify(input),
    },
  },
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

        expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}',
          },
        });
      });

      it('properly parses single value to list', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {a: "foo", b: "bar", c: "baz"})
        }
        `;
        const ast = parse(doc);

        expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}',
          },
        });
      });

      it('properly parses null value to null', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {a: null, b: null, c: "C", d: null})
        }
        `;
        const ast = parse(doc);

        expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":null,"b":null,"c":"C","d":null}',
          },
        });
      });

      it('properly parses null value in list', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {b: ["A",null,"C"], c: "C"})
        }
        `;
        const ast = parse(doc);

        expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"b":["A",null,"C"],"c":"C"}',
          },
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

        expect(result).to.containSubset({
          data: {
            fieldWithObjectInput: null,
          },
          errors: [
            {
              message:
                'Argument "input" has invalid value ["foo", "bar", "baz"].',
              path: ['fieldWithObjectInput'],
              locations: [{ line: 3, column: 39 }],
            },
          ],
        });
      });

      it('properly runs parseLiteral on complex scalar types', async () => {
        const doc = `
        {
          fieldWithObjectInput(input: {c: "foo", d: "SerializedValue"})
        }
        `;
        const ast = parse(doc);

        expect(await execute(schema, ast)).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"c":"foo","d":"DeserializedValue"}',
          },
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
        const params = { input: { a: 'foo', b: ['bar'], c: 'baz' } };
        const result = await execute(schema, ast, null, null, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}',
          },
        });
      });

      it('uses default value when not provided', async () => {
        const withDefaultsAST = parse(`
          query q($input: TestInputObject = {a: "foo", b: ["bar"], c: "baz"}) {
            fieldWithObjectInput(input: $input)
          }
        `);

        const result = await execute(schema, withDefaultsAST);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}',
          },
        });
      });

      it('properly parses single value to list', async () => {
        const params = { input: { a: 'foo', b: 'bar', c: 'baz' } };
        const result = await execute(schema, ast, null, null, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"a":"foo","b":["bar"],"c":"baz"}',
          },
        });
      });

      it('executes with complex scalar input', async () => {
        const params = { input: { c: 'foo', d: 'SerializedValue' } };
        const result = await execute(schema, ast, null, null, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{"c":"foo","d":"DeserializedValue"}',
          },
        });
      });

      it('errors on null for nested non-null', async () => {
        const params = { input: { a: 'foo', b: 'bar', c: null } };

        const result = await execute(schema, ast, null, null, params);
        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value ' +
                '{"a":"foo","b":"bar","c":null}; ' +
                'Expected non-nullable type String! at value.c.',
              locations: [{ line: 2, column: 17 }],
              path: undefined,
            },
          ],
        });
      });

      it('errors on incorrect type', async () => {
        const params = { input: 'foo bar' };

        const result = await execute(schema, ast, null, null, params);
        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value "foo bar"; ' +
                'Expected object type TestInputObject.',
              locations: [{ line: 2, column: 17 }],
              path: undefined,
            },
          ],
        });
      });

      it('errors on omission of nested non-null', async () => {
        const params = { input: { a: 'foo', b: 'bar' } };

        const result = await execute(schema, ast, null, null, params);
        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value {"a":"foo","b":"bar"}; ' +
                'Field value.c of required type String! was not provided.',
              locations: [{ line: 2, column: 17 }],
              path: undefined,
            },
          ],
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

        const result = await execute(schema, nestedAst, null, null, params);
        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value {"na":{"a":"foo"}}; ' +
                'Field value.na.c of required type String! was not provided.',
              locations: [{ line: 2, column: 19 }],
              path: undefined,
            },
            {
              message:
                'Variable "$input" got invalid value {"na":{"a":"foo"}}; ' +
                'Field value.nb of required type String! was not provided.',
              locations: [{ line: 2, column: 19 }],
              path: undefined,
            },
          ],
        });
      });

      it('errors on addition of unknown input field', async () => {
        const params = {
          input: { a: 'foo', b: 'bar', c: 'baz', extra: 'dog' },
        };

        const result = await execute(schema, ast, null, null, params);
        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value ' +
                '{"a":"foo","b":"bar","c":"baz","extra":"dog"}; ' +
                'Field "extra" is not defined by type TestInputObject.',
              locations: [{ line: 2, column: 17 }],
              path: undefined,
            },
          ],
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

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be omitted in a variable', async () => {
      const doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be omitted in an unlisted variable', async () => {
      const doc = `
      query SetsNullable {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be set to null in a variable', async () => {
      const doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { value: null }),
      ).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be set to a value in a variable', async () => {
      const doc = `
      query SetsNullable($value: String) {
        fieldWithNullableStringInput(input: $value)
      }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { value: 'a' }),
      ).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"a"',
        },
      });
    });

    it('allows nullable inputs to be set to a value directly', async () => {
      const doc = `
      {
        fieldWithNullableStringInput(input: "a")
      }
      `;
      const ast = parse(doc);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"a"',
        },
      });
    });
  });

  describe('Handles non-nullable scalars', async () => {
    it('allows non-nullable inputs to be omitted given a default', async () => {
      const doc = `
        query SetsNonNullable($value: String = "default") {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;

      expect(await execute(schema, parse(doc))).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"default"',
        },
      });
    });

    it('does not allow non-nullable inputs to be omitted in a variable', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;

      const result = await execute(schema, parse(doc));
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$value" of required type "String!" was not provided.',
            locations: [{ line: 2, column: 31 }],
            path: undefined,
          },
        ],
      });
    });

    it('does not allow non-nullable inputs to be set to null in a variable', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const ast = parse(doc);

      const result = await execute(schema, ast, null, null, { value: null });
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$value" got invalid value null; ' +
              'Expected non-nullable type String!.',
            locations: [{ line: 2, column: 31 }],
            path: undefined,
          },
        ],
      });
    });

    it('allows non-nullable inputs to be set to a value in a variable', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { value: 'a' }),
      ).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"a"',
        },
      });
    });

    it('allows non-nullable inputs to be set to a value directly', async () => {
      const doc = `
      {
        fieldWithNonNullableStringInput(input: "a")
      }
      `;
      const ast = parse(doc);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"a"',
        },
      });
    });

    it('reports error for missing non-nullable inputs', async () => {
      const doc = `
      {
        fieldWithNonNullableStringInput
      }
      `;
      const ast = parse(doc);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: null,
        },
        errors: [
          {
            message:
              'Argument "input" of required type "String!" was not provided.',
            locations: [{ line: 3, column: 9 }],
            path: ['fieldWithNonNullableStringInput'],
          },
        ],
      });
    });

    it('reports error for array passed into string input', async () => {
      const doc = `
        query SetsNonNullable($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const ast = parse(doc);
      const variables = { value: [1, 2, 3] };

      const result = await execute(schema, ast, null, null, variables);

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$value" got invalid value [1,2,3]; Expected type ' +
              'String; String cannot represent an array value: [1,2,3]',
            locations: [{ line: 2, column: 31 }],
            path: undefined,
          },
        ],
      });

      expect(result.errors[0].originalError).not.to.equal(undefined);
    });

    it('serializing an array via GraphQLString throws TypeError', async () => {
      let caughtError;
      try {
        GraphQLString.serialize([1, 2, 3]);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError instanceof TypeError).to.equal(true);
      expect(caughtError && caughtError.message).to.equal(
        'String cannot represent an array value: [1,2,3]',
      );
    });

    it('reports error for non-provided variables for non-nullable inputs', async () => {
      // Note: this test would typically fail validation before encountering
      // this execution error, however for queries which previously validated
      // and are being run against a new schema which have introduced a breaking
      // change to make a formerly non-required argument required, this asserts
      // failure before allowing the underlying code to receive a non-null value.
      const doc = `
      {
        fieldWithNonNullableStringInput(input: $foo)
      }
      `;
      const ast = parse(doc);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: null,
        },
        errors: [
          {
            message:
              'Argument "input" of required type "String!" was provided the ' +
              'variable "$foo" which was not provided a runtime value.',
            locations: [{ line: 3, column: 48 }],
            path: ['fieldWithNonNullableStringInput'],
          },
        ],
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

      expect(
        await execute(schema, ast, null, null, { input: null }),
      ).to.deep.equal({
        data: {
          list: null,
        },
      });
    });

    it('allows lists to contain values', async () => {
      const doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: ['A'] }),
      ).to.deep.equal({
        data: {
          list: '["A"]',
        },
      });
    });

    it('allows lists to contain null', async () => {
      const doc = `
        query q($input: [String]) {
          list(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: ['A', null, 'B'] }),
      ).to.deep.equal({
        data: {
          list: '["A",null,"B"]',
        },
      });
    });

    it('does not allow non-null lists to be null', async () => {
      const doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const ast = parse(doc);

      const result = await execute(schema, ast, null, null, { input: null });
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" got invalid value null; ' +
              'Expected non-nullable type [String]!.',
            locations: [{ line: 2, column: 17 }],
            path: undefined,
          },
        ],
      });
    });

    it('allows non-null lists to contain values', async () => {
      const doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: ['A'] }),
      ).to.deep.equal({
        data: {
          nnList: '["A"]',
        },
      });
    });

    it('allows non-null lists to contain null', async () => {
      const doc = `
        query q($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: ['A', null, 'B'] }),
      ).to.deep.equal({
        data: {
          nnList: '["A",null,"B"]',
        },
      });
    });

    it('allows lists of non-nulls to be null', async () => {
      const doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: null }),
      ).to.deep.equal({
        data: {
          listNN: null,
        },
      });
    });

    it('allows lists of non-nulls to contain values', async () => {
      const doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: ['A'] }),
      ).to.deep.equal({
        data: {
          listNN: '["A"]',
        },
      });
    });

    it('does not allow lists of non-nulls to contain null', async () => {
      const doc = `
        query q($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: ['A', null, 'B'] };

      const result = await execute(schema, ast, null, null, vars);
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" got invalid value ["A",null,"B"]; ' +
              'Expected non-nullable type String! at value[1].',
            locations: [{ line: 2, column: 17 }],
            path: undefined,
          },
        ],
      });
    });

    it('does not allow non-null lists of non-nulls to be null', async () => {
      const doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const ast = parse(doc);

      const result = await execute(schema, ast, null, null, { input: null });
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" got invalid value null; ' +
              'Expected non-nullable type [String!]!.',
            locations: [{ line: 2, column: 17 }],
            path: undefined,
          },
        ],
      });
    });

    it('allows non-null lists of non-nulls to contain values', async () => {
      const doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const ast = parse(doc);

      expect(
        await execute(schema, ast, null, null, { input: ['A'] }),
      ).to.deep.equal({
        data: {
          nnListNN: '["A"]',
        },
      });
    });

    it('does not allow non-null lists of non-nulls to contain null', async () => {
      const doc = `
        query q($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: ['A', null, 'B'] };

      const result = await execute(schema, ast, null, null, vars);
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" got invalid value ["A",null,"B"]; ' +
              'Expected non-nullable type String! at value[1].',
            locations: [{ line: 2, column: 17 }],
            path: undefined,
          },
        ],
      });
    });

    it('does not allow invalid types to be used as values', async () => {
      const doc = `
        query q($input: TestType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      const ast = parse(doc);
      const vars = { input: { list: ['A', 'B'] } };

      const result = await execute(schema, ast, null, null, vars);
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" expected value of type "TestType!" which ' +
              'cannot be used as an input type.',
            locations: [{ line: 2, column: 25 }],
            path: undefined,
          },
        ],
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

      const result = await execute(schema, ast, null, null, vars);
      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" expected value of type "UnknownType!" which ' +
              'cannot be used as an input type.',
            locations: [{ line: 2, column: 25 }],
            path: undefined,
          },
        ],
      });
    });
  });

  describe('Execute: Uses argument default values', () => {
    it('when no argument provided', async () => {
      const ast = parse(`{
        fieldWithDefaultArgumentValue
      }`);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: '"Hello World"',
        },
      });
    });

    it('when omitted variable provided', async () => {
      const ast = parse(`query optionalVariable($optional: String) {
        fieldWithDefaultArgumentValue(input: $optional)
      }`);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: '"Hello World"',
        },
      });
    });

    it('not when argument cannot be coerced', async () => {
      const ast = parse(`{
        fieldWithDefaultArgumentValue(input: WRONG_TYPE)
      }`);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: null,
        },
        errors: [
          {
            message: 'Argument "input" has invalid value WRONG_TYPE.',
            locations: [{ line: 2, column: 46 }],
            path: ['fieldWithDefaultArgumentValue'],
          },
        ],
      });
    });
  });
});
