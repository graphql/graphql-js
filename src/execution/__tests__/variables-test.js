/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from 'util';
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

function fieldWithInputArg(inputArg) {
  return {
    type: GraphQLString,
    args: { input: inputArg },
    resolve(_, args) {
      if (args.hasOwnProperty('input')) {
        return inspect(args.input, { depth: null });
      }
    },
  };
}

const TestType = new GraphQLObjectType({
  name: 'TestType',
  fields: {
    fieldWithObjectInput: fieldWithInputArg({ type: TestInputObject }),
    fieldWithNullableStringInput: fieldWithInputArg({ type: GraphQLString }),
    fieldWithNonNullableStringInput: fieldWithInputArg({
      type: GraphQLNonNull(GraphQLString),
    }),
    fieldWithDefaultArgumentValue: fieldWithInputArg({
      type: GraphQLString,
      defaultValue: 'Hello World',
    }),
    fieldWithNonNullableStringInputAndDefaultArgumentValue: fieldWithInputArg({
      type: GraphQLNonNull(GraphQLString),
      defaultValue: 'Unreachable',
    }),
    fieldWithNestedInputObject: fieldWithInputArg({
      type: TestNestedInputObject,
      defaultValue: 'Hello World',
    }),
    list: fieldWithInputArg({ type: GraphQLList(GraphQLString) }),
    nnList: fieldWithInputArg({
      type: GraphQLNonNull(GraphQLList(GraphQLString)),
    }),
    listNN: fieldWithInputArg({
      type: GraphQLList(GraphQLNonNull(GraphQLString)),
    }),
    nnListNN: fieldWithInputArg({
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
    }),
  },
});

const schema = new GraphQLSchema({ query: TestType });

function executeQuery(query, variableValues) {
  const document = parse(query);
  return execute({ schema, document, variableValues });
}

describe('Execute: Handles inputs', () => {
  describe('Handles objects and nullability', () => {
    describe('using inline structs', () => {
      it('executes with complex input', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: {a: "foo", b: ["bar"], c: "baz"})
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ a: 'foo', b: [ 'bar' ], c: 'baz' }",
          },
        });
      });

      it('properly parses single value to list', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: {a: "foo", b: "bar", c: "baz"})
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ a: 'foo', b: [ 'bar' ], c: 'baz' }",
          },
        });
      });

      it('properly parses null value to null', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: {a: null, b: null, c: "C", d: null})
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ a: null, b: null, c: 'C', d: null }",
          },
        });
      });

      it('properly parses null value in list', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: {b: ["A",null,"C"], c: "C"})
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ b: [ 'A', null, 'C' ], c: 'C' }",
          },
        });
      });

      it('does not use incorrect value', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: ["foo", "bar", "baz"])
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: null,
          },
          errors: [
            {
              message:
                'Argument "input" has invalid value ["foo", "bar", "baz"].',
              path: ['fieldWithObjectInput'],
              locations: [{ line: 3, column: 41 }],
            },
          ],
        });
      });

      it('properly runs parseLiteral on complex scalar types', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: {c: "foo", d: "SerializedValue"})
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ c: 'foo', d: 'DeserializedValue' }",
          },
        });
      });
    });

    describe('using variables', () => {
      const doc = `
        query ($input: TestInputObject) {
          fieldWithObjectInput(input: $input)
        }
      `;

      it('executes with complex input', () => {
        const params = { input: { a: 'foo', b: ['bar'], c: 'baz' } };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ a: 'foo', b: [ 'bar' ], c: 'baz' }",
          },
        });
      });

      it('uses default value when not provided', () => {
        const result = executeQuery(`
          query ($input: TestInputObject = {a: "foo", b: ["bar"], c: "baz"}) {
            fieldWithObjectInput(input: $input)
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ a: 'foo', b: [ 'bar' ], c: 'baz' }",
          },
        });
      });

      it('does not use default value when provided', () => {
        const result = executeQuery(
          `query q($input: String = "Default value") {
            fieldWithNullableStringInput(input: $input)
          }`,
          { input: 'Variable value' },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: "'Variable value'",
          },
        });
      });

      it('uses default value when explicit null value provided', () => {
        const result = executeQuery(
          `
          query q($input: String = "Default value") {
            fieldWithNullableStringInput(input: $input)
          }`,
          { input: null },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: "'Default value'",
          },
        });
      });

      it('uses null default value when not provided', () => {
        const result = executeQuery(
          `
          query q($input: String = null) {
            fieldWithNullableStringInput(input: $input)
          }`,
          {
            // Intentionally missing variable values.
          },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: 'null',
          },
        });
      });

      it('properly parses single value to list', () => {
        const params = { input: { a: 'foo', b: 'bar', c: 'baz' } };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ a: 'foo', b: [ 'bar' ], c: 'baz' }",
          },
        });
      });

      it('executes with complex scalar input', () => {
        const params = { input: { c: 'foo', d: 'SerializedValue' } };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: "{ c: 'foo', d: 'DeserializedValue' }",
          },
        });
      });

      it('errors on null for nested non-null', () => {
        const params = { input: { a: 'foo', b: 'bar', c: null } };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value ' +
                '{"a":"foo","b":"bar","c":null}; ' +
                'Expected non-nullable type String! not to be null at value.c.',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });

      it('errors on incorrect type', () => {
        const result = executeQuery(doc, { input: 'foo bar' });

        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value "foo bar"; ' +
                'Expected type TestInputObject to be an object.',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });

      it('errors on omission of nested non-null', () => {
        const result = executeQuery(doc, { input: { a: 'foo', b: 'bar' } });

        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value {"a":"foo","b":"bar"}; ' +
                'Field value.c of required type String! was not provided.',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });

      it('errors on deep nested errors and with many errors', () => {
        const nestedDoc = `
          query ($input: TestNestedInputObject) {
            fieldWithNestedObjectInput(input: $input)
          }
        `;
        const result = executeQuery(nestedDoc, { input: { na: { a: 'foo' } } });

        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value {"na":{"a":"foo"}}; ' +
                'Field value.na.c of required type String! was not provided.',
              locations: [{ line: 2, column: 18 }],
            },
            {
              message:
                'Variable "$input" got invalid value {"na":{"a":"foo"}}; ' +
                'Field value.nb of required type String! was not provided.',
              locations: [{ line: 2, column: 18 }],
            },
          ],
        });
      });

      it('errors on addition of unknown input field', () => {
        const params = {
          input: { a: 'foo', b: 'bar', c: 'baz', extra: 'dog' },
        };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          errors: [
            {
              message:
                'Variable "$input" got invalid value ' +
                '{"a":"foo","b":"bar","c":"baz","extra":"dog"}; ' +
                'Field "extra" is not defined by type TestInputObject.',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });
    });
  });

  describe('Handles nullable scalars', () => {
    it('allows nullable inputs to be omitted', () => {
      const result = executeQuery(`
        {
          fieldWithNullableStringInput
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be omitted in a variable', () => {
      const result = executeQuery(`
        query ($value: String) {
          fieldWithNullableStringInput(input: $value)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be omitted in an unlisted variable', () => {
      const result = executeQuery(`
        query {
          fieldWithNullableStringInput(input: $value)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('allows nullable inputs to be set to null in a variable', () => {
      const doc = `
        query ($value: String) {
          fieldWithNullableStringInput(input: $value)
        }
      `;
      const result = executeQuery(doc, { value: null });

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: 'null',
        },
      });
    });

    it('allows nullable inputs to be set to a value in a variable', () => {
      const doc = `
        query ($value: String) {
          fieldWithNullableStringInput(input: $value)
        }
      `;
      const result = executeQuery(doc, { value: 'a' });

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: "'a'",
        },
      });
    });

    it('allows nullable inputs to be set to a value directly', () => {
      const result = executeQuery(`
        {
          fieldWithNullableStringInput(input: "a")
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: "'a'",
        },
      });
    });
  });

  describe('Handles non-nullable scalars', () => {
    it('allows non-nullable inputs to be omitted given a default', () => {
      const result = executeQuery(`
        query ($value: String = "default") {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: "'default'",
        },
      });
    });

    it('does not allow non-nullable inputs to be omitted in a variable', () => {
      const result = executeQuery(`
        query ($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$value" of required type "String!" was not provided.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('does not allow non-nullable inputs to be set to null in a variable', () => {
      const doc = `
        query ($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const result = executeQuery(doc, { value: null });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$value" of non-null type "String!" must not be null.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('allows non-nullable inputs to be set to a value in a variable', () => {
      const doc = `
        query ($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const result = executeQuery(doc, { value: 'a' });

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: "'a'",
        },
      });
    });

    it('allows non-nullable inputs to be set to a value directly', () => {
      const result = executeQuery(`
        {
          fieldWithNonNullableStringInput(input: "a")
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: "'a'",
        },
      });
    });

    it('reports error for missing non-nullable inputs', () => {
      const result = executeQuery('{ fieldWithNonNullableStringInput }');

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: null,
        },
        errors: [
          {
            message:
              'Argument "input" of required type "String!" was not provided.',
            locations: [{ line: 1, column: 3 }],
            path: ['fieldWithNonNullableStringInput'],
          },
        ],
      });
    });

    it('reports error for array passed into string input', () => {
      const doc = `
        query ($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `;
      const result = executeQuery(doc, { value: [1, 2, 3] });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$value" got invalid value [1,2,3]; Expected type ' +
              'String; String cannot represent an array value: [1,2,3]',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });

      expect(result.errors[0].originalError).not.to.equal(undefined);
    });

    it('serializing an array via GraphQLString throws TypeError', () => {
      expect(() => GraphQLString.serialize([1, 2, 3])).to.throw(
        TypeError,
        'String cannot represent an array value: [1,2,3]',
      );
    });

    it('reports error for non-provided variables for non-nullable inputs', () => {
      // Note: this test would typically fail validation before encountering
      // this execution error, however for queries which previously validated
      // and are being run against a new schema which have introduced a breaking
      // change to make a formerly non-required argument required, this asserts
      // failure before allowing the underlying code to receive a non-null value.
      const result = executeQuery(`
        {
          fieldWithNonNullableStringInput(input: $foo)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: null,
        },
        errors: [
          {
            message:
              'Argument "input" of required type "String!" was provided the ' +
              'variable "$foo" which was not provided a runtime value.',
            locations: [{ line: 3, column: 50 }],
            path: ['fieldWithNonNullableStringInput'],
          },
        ],
      });
    });
  });

  describe('Handles lists and nullability', () => {
    it('allows lists to be null', () => {
      const doc = `
        query ($input: [String]) {
          list(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: null });

      expect(result).to.deep.equal({ data: { list: 'null' } });
    });

    it('allows lists to contain values', () => {
      const doc = `
        query ($input: [String]) {
          list(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A'] });

      expect(result).to.deep.equal({ data: { list: "[ 'A' ]" } });
    });

    it('allows lists to contain null', () => {
      const doc = `
        query ($input: [String]) {
          list(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expect(result).to.deep.equal({ data: { list: "[ 'A', null, 'B' ]" } });
    });

    it('does not allow non-null lists to be null', () => {
      const doc = `
        query ($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: null });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" of non-null type "[String]!" must not be null.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('allows non-null lists to contain values', () => {
      const doc = `
        query ($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A'] });

      expect(result).to.deep.equal({ data: { nnList: "[ 'A' ]" } });
    });

    it('allows non-null lists to contain null', () => {
      const doc = `
        query ($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expect(result).to.deep.equal({ data: { nnList: "[ 'A', null, 'B' ]" } });
    });

    it('allows lists of non-nulls to be null', () => {
      const doc = `
        query ($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: null });

      expect(result).to.deep.equal({ data: { listNN: 'null' } });
    });

    it('allows lists of non-nulls to contain values', () => {
      const doc = `
        query ($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A'] });

      expect(result).to.deep.equal({ data: { listNN: "[ 'A' ]" } });
    });

    it('does not allow lists of non-nulls to contain null', () => {
      const doc = `
        query ($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" got invalid value ["A",null,"B"]; ' +
              'Expected non-nullable type String! not to be null at value[1].',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('does not allow non-null lists of non-nulls to be null', () => {
      const doc = `
        query ($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: null });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" of non-null type "[String!]!" must not be null.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('allows non-null lists of non-nulls to contain values', () => {
      const doc = `
        query ($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A'] });

      expect(result).to.deep.equal({ data: { nnListNN: "[ 'A' ]" } });
    });

    it('does not allow non-null lists of non-nulls to contain null', () => {
      const doc = `
        query ($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" got invalid value ["A",null,"B"]; ' +
              'Expected non-nullable type String! not to be null at value[1].',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('does not allow invalid types to be used as values', () => {
      const doc = `
        query ($input: TestType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: { list: ['A', 'B'] } });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" expected value of type "TestType!" which ' +
              'cannot be used as an input type.',
            locations: [{ line: 2, column: 24 }],
          },
        ],
      });
    });

    it('does not allow unknown types to be used as values', () => {
      const doc = `
        query ($input: UnknownType!) {
          fieldWithObjectInput(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: 'whoknows' });

      expect(result).to.deep.equal({
        errors: [
          {
            message:
              'Variable "$input" expected value of type "UnknownType!" which ' +
              'cannot be used as an input type.',
            locations: [{ line: 2, column: 24 }],
          },
        ],
      });
    });
  });

  describe('Execute: Uses argument default values', () => {
    it('when no argument provided', () => {
      const result = executeQuery('{ fieldWithDefaultArgumentValue }');

      expect(result).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: "'Hello World'",
        },
      });
    });

    it('when omitted variable provided', () => {
      const result = executeQuery(`
        query ($optional: String) {
          fieldWithDefaultArgumentValue(input: $optional)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: "'Hello World'",
        },
      });
    });

    it('not when argument cannot be coerced', () => {
      const result = executeQuery(`
        {
          fieldWithDefaultArgumentValue(input: WRONG_TYPE)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithDefaultArgumentValue: null,
        },
        errors: [
          {
            message: 'Argument "input" has invalid value WRONG_TYPE.',
            locations: [{ line: 3, column: 48 }],
            path: ['fieldWithDefaultArgumentValue'],
          },
        ],
      });
    });

    it('not when argument type is non-null', async () => {
      const ast = parse(`query optionalVariable($optional: String) {
        fieldWithNonNullableStringInputAndDefaultArgumentValue(input: $optional)
      }`);

      expect(await execute(schema, ast)).to.deep.equal({
        data: {
          fieldWithNonNullableStringInputAndDefaultArgumentValue: null,
        },
        errors: [
          {
            message:
              'Argument "input" of required type "String!" was provided the ' +
              'variable "$optional" which was not provided a runtime value.',
            locations: [{ line: 2, column: 71 }],
            path: ['fieldWithNonNullableStringInputAndDefaultArgumentValue'],
          },
        ],
      });
    });
  });
});
