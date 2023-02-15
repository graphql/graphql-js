import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { inspect } from '../../jsutils/inspect';
import { invariant } from '../../jsutils/invariant';

import { GraphQLError } from '../../error/GraphQLError';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';

import type {
  GraphQLArgumentConfig,
  GraphQLFieldConfig,
} from '../../type/definition';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { executeSync } from '../execute';
import { getVariableValues } from '../values';

const TestFaultyScalarGraphQLError = new GraphQLError(
  'FaultyScalarErrorMessage',
  {
    extensions: {
      code: 'FaultyScalarErrorMessageExtensionCode',
    },
  },
);

const TestFaultyScalar = new GraphQLScalarType({
  name: 'FaultyScalar',
  parseValue() {
    throw TestFaultyScalarGraphQLError;
  },
  parseLiteral() {
    throw TestFaultyScalarGraphQLError;
  },
});

const TestComplexScalar = new GraphQLScalarType({
  name: 'ComplexScalar',
  parseValue(value) {
    expect(value).to.equal('SerializedValue');
    return 'DeserializedValue';
  },
  parseLiteral(ast) {
    expect(ast).to.include({ kind: 'StringValue', value: 'SerializedValue' });
    return 'DeserializedValue';
  },
});

const TestInputObject = new GraphQLInputObjectType({
  name: 'TestInputObject',
  fields: {
    a: { type: GraphQLString },
    b: { type: new GraphQLList(GraphQLString) },
    c: { type: new GraphQLNonNull(GraphQLString) },
    d: { type: TestComplexScalar },
    e: { type: TestFaultyScalar },
  },
});

const TestNestedInputObject = new GraphQLInputObjectType({
  name: 'TestNestedInputObject',
  fields: {
    na: { type: new GraphQLNonNull(TestInputObject) },
    nb: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const TestEnum = new GraphQLEnumType({
  name: 'TestEnum',
  values: {
    NULL: { value: null },
    UNDEFINED: { value: undefined },
    NAN: { value: NaN },
    FALSE: { value: false },
    CUSTOM: { value: 'custom value' },
    DEFAULT_VALUE: {},
  },
});

function fieldWithInputArg(
  inputArg: GraphQLArgumentConfig,
): GraphQLFieldConfig<any, any> {
  return {
    type: GraphQLString,
    args: { input: inputArg },
    resolve(_, args) {
      if ('input' in args) {
        return inspect(args.input);
      }
    },
  };
}

const TestType = new GraphQLObjectType({
  name: 'TestType',
  fields: {
    fieldWithEnumInput: fieldWithInputArg({ type: TestEnum }),
    fieldWithNonNullableEnumInput: fieldWithInputArg({
      type: new GraphQLNonNull(TestEnum),
    }),
    fieldWithObjectInput: fieldWithInputArg({ type: TestInputObject }),
    fieldWithNullableStringInput: fieldWithInputArg({ type: GraphQLString }),
    fieldWithNonNullableStringInput: fieldWithInputArg({
      type: new GraphQLNonNull(GraphQLString),
    }),
    fieldWithDefaultArgumentValue: fieldWithInputArg({
      type: GraphQLString,
      defaultValue: 'Hello World',
    }),
    fieldWithNonNullableStringInputAndDefaultArgumentValue: fieldWithInputArg({
      type: new GraphQLNonNull(GraphQLString),
      defaultValue: 'Hello World',
    }),
    fieldWithNestedInputObject: fieldWithInputArg({
      type: TestNestedInputObject,
      defaultValue: 'Hello World',
    }),
    list: fieldWithInputArg({ type: new GraphQLList(GraphQLString) }),
    nnList: fieldWithInputArg({
      type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
    }),
    listNN: fieldWithInputArg({
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    }),
    nnListNN: fieldWithInputArg({
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString)),
      ),
    }),
  },
});

const schema = new GraphQLSchema({ query: TestType });

function executeQuery(
  query: string,
  variableValues?: { [variable: string]: unknown },
) {
  const document = parse(query);
  return executeSync({ schema, document, variableValues });
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
            fieldWithObjectInput: '{ a: "foo", b: ["bar"], c: "baz" }',
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
            fieldWithObjectInput: '{ a: "foo", b: ["bar"], c: "baz" }',
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
            fieldWithObjectInput: '{ a: null, b: null, c: "C", d: null }',
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
            fieldWithObjectInput: '{ b: ["A", null, "C"], c: "C" }',
          },
        });
      });

      it('does not use incorrect value', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: ["foo", "bar", "baz"])
          }
        `);

        expectJSON(result).toDeepEqual({
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
            fieldWithObjectInput: '{ c: "foo", d: "DeserializedValue" }',
          },
        });
      });
    });

    it('errors on faulty scalar type input', () => {
      const result = executeQuery(`
        {
          fieldWithObjectInput(input: {c: "foo", e: "bar"})
        }
      `);

      expectJSON(result).toDeepEqual({
        data: {
          fieldWithObjectInput: null,
        },
        errors: [
          {
            message: 'Argument "input" has invalid value {c: "foo", e: "bar"}.',
            path: ['fieldWithObjectInput'],
            locations: [{ line: 3, column: 39 }],
          },
        ],
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
            fieldWithObjectInput: '{ a: "foo", b: ["bar"], c: "baz" }',
          },
        });
      });

      it('uses undefined when variable not provided', () => {
        const result = executeQuery(
          `
          query q($input: String) {
            fieldWithNullableStringInput(input: $input)
          }`,
          {
            // Intentionally missing variable values.
          },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: null,
          },
        });
      });

      it('uses null when variable provided explicit null value', () => {
        const result = executeQuery(
          `
          query q($input: String) {
            fieldWithNullableStringInput(input: $input)
          }`,
          { input: null },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: 'null',
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
            fieldWithObjectInput: '{ a: "foo", b: ["bar"], c: "baz" }',
          },
        });
      });

      it('does not use default value when provided', () => {
        const result = executeQuery(
          `
            query q($input: String = "Default value") {
              fieldWithNullableStringInput(input: $input)
            }
          `,
          { input: 'Variable value' },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: '"Variable value"',
          },
        });
      });

      it('uses explicit null value instead of default value', () => {
        const result = executeQuery(
          `
          query q($input: String = "Default value") {
            fieldWithNullableStringInput(input: $input)
          }`,
          { input: null },
        );

        expect(result).to.deep.equal({
          data: {
            fieldWithNullableStringInput: 'null',
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
            fieldWithObjectInput: '{ a: "foo", b: ["bar"], c: "baz" }',
          },
        });
      });

      it('executes with complex scalar input', () => {
        const params = { input: { c: 'foo', d: 'SerializedValue' } };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{ c: "foo", d: "DeserializedValue" }',
          },
        });
      });

      it('errors on faulty scalar type input', () => {
        const params = { input: { c: 'foo', e: 'SerializedValue' } };
        const result = executeQuery(doc, params);

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" got invalid value "SerializedValue" at "input.e"; FaultyScalarErrorMessage',
              locations: [{ line: 2, column: 16 }],
              extensions: { code: 'FaultyScalarErrorMessageExtensionCode' },
            },
          ],
        });
      });

      it('errors on null for nested non-null', () => {
        const params = { input: { a: 'foo', b: 'bar', c: null } };
        const result = executeQuery(doc, params);

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" got invalid value null at "input.c"; Expected non-nullable type "String!" not to be null.',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });

      it('errors on incorrect type', () => {
        const result = executeQuery(doc, { input: 'foo bar' });

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" got invalid value "foo bar"; Expected type "TestInputObject" to be an object.',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });

      it('errors on omission of nested non-null', () => {
        const result = executeQuery(doc, { input: { a: 'foo', b: 'bar' } });

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" got invalid value { a: "foo", b: "bar" }; Field "c" of required type "String!" was not provided.',
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

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" got invalid value { a: "foo" } at "input.na"; Field "c" of required type "String!" was not provided.',
              locations: [{ line: 2, column: 18 }],
            },
            {
              message:
                'Variable "$input" got invalid value { na: { a: "foo" } }; Field "nb" of required type "String!" was not provided.',
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

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" got invalid value { a: "foo", b: "bar", c: "baz", extra: "dog" }; Field "extra" is not defined by type "TestInputObject".',
              locations: [{ line: 2, column: 16 }],
            },
          ],
        });
      });
    });
  });

  describe('Handles custom enum values', () => {
    it('allows custom enum values as inputs', () => {
      const result = executeQuery(`
        {
          null: fieldWithEnumInput(input: NULL)
          NaN: fieldWithEnumInput(input: NAN)
          false: fieldWithEnumInput(input: FALSE)
          customValue: fieldWithEnumInput(input: CUSTOM)
          defaultValue: fieldWithEnumInput(input: DEFAULT_VALUE)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          null: 'null',
          NaN: 'NaN',
          false: 'false',
          customValue: '"custom value"',
          defaultValue: '"DEFAULT_VALUE"',
        },
      });
    });

    it('allows non-nullable inputs to have null as enum custom value', () => {
      const result = executeQuery(`
        {
          fieldWithNonNullableEnumInput(input: NULL)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableEnumInput: 'null',
        },
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
          fieldWithNullableStringInput: '"a"',
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
          fieldWithNullableStringInput: '"a"',
        },
      });
    });
  });

  describe('Handles non-nullable scalars', () => {
    it('allows non-nullable variable to be omitted given a default', () => {
      const result = executeQuery(`
        query ($value: String! = "default") {
          fieldWithNullableStringInput(input: $value)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"default"',
        },
      });
    });

    it('allows non-nullable inputs to be omitted given a default', () => {
      const result = executeQuery(`
        query ($value: String = "default") {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"default"',
        },
      });
    });

    it('does not allow non-nullable inputs to be omitted in a variable', () => {
      const result = executeQuery(`
        query ($value: String!) {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);

      expectJSON(result).toDeepEqual({
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

      expectJSON(result).toDeepEqual({
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
          fieldWithNonNullableStringInput: '"a"',
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
          fieldWithNonNullableStringInput: '"a"',
        },
      });
    });

    it('reports error for missing non-nullable inputs', () => {
      const result = executeQuery('{ fieldWithNonNullableStringInput }');

      expectJSON(result).toDeepEqual({
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

      expectJSON(result).toDeepEqual({
        errors: [
          {
            message:
              'Variable "$value" got invalid value [1, 2, 3]; String cannot represent a non string value: [1, 2, 3]',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });

      expect(result).to.have.nested.property('errors[0].originalError');
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

      expectJSON(result).toDeepEqual({
        data: {
          fieldWithNonNullableStringInput: null,
        },
        errors: [
          {
            message:
              'Argument "input" of required type "String!" was provided the variable "$foo" which was not provided a runtime value.',
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

      expect(result).to.deep.equal({ data: { list: '["A"]' } });
    });

    it('allows lists to contain null', () => {
      const doc = `
        query ($input: [String]) {
          list(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expect(result).to.deep.equal({ data: { list: '["A", null, "B"]' } });
    });

    it('does not allow non-null lists to be null', () => {
      const doc = `
        query ($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: null });

      expectJSON(result).toDeepEqual({
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

      expect(result).to.deep.equal({ data: { nnList: '["A"]' } });
    });

    it('allows non-null lists to contain null', () => {
      const doc = `
        query ($input: [String]!) {
          nnList(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expect(result).to.deep.equal({ data: { nnList: '["A", null, "B"]' } });
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

      expect(result).to.deep.equal({ data: { listNN: '["A"]' } });
    });

    it('does not allow lists of non-nulls to contain null', () => {
      const doc = `
        query ($input: [String!]) {
          listNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            message:
              'Variable "$input" got invalid value null at "input[1]"; Expected non-nullable type "String!" not to be null.',
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

      expectJSON(result).toDeepEqual({
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

      expect(result).to.deep.equal({ data: { nnListNN: '["A"]' } });
    });

    it('does not allow non-null lists of non-nulls to contain null', () => {
      const doc = `
        query ($input: [String!]!) {
          nnListNN(input: $input)
        }
      `;
      const result = executeQuery(doc, { input: ['A', null, 'B'] });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            message:
              'Variable "$input" got invalid value null at "input[1]"; Expected non-nullable type "String!" not to be null.',
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

      expectJSON(result).toDeepEqual({
        errors: [
          {
            message:
              'Variable "$input" expected value of type "TestType!" which cannot be used as an input type.',
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
      const result = executeQuery(doc, { input: 'WhoKnows' });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            message:
              'Variable "$input" expected value of type "UnknownType!" which cannot be used as an input type.',
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
          fieldWithDefaultArgumentValue: '"Hello World"',
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
          fieldWithDefaultArgumentValue: '"Hello World"',
        },
      });
    });

    it('not when argument cannot be coerced', () => {
      const result = executeQuery(`
        {
          fieldWithDefaultArgumentValue(input: WRONG_TYPE)
        }
      `);

      expectJSON(result).toDeepEqual({
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

    it('when no runtime value is provided to a non-null argument', () => {
      const result = executeQuery(`
        query optionalVariable($optional: String) {
          fieldWithNonNullableStringInputAndDefaultArgumentValue(input: $optional)
        }
      `);

      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInputAndDefaultArgumentValue:
            '"Hello World"',
        },
      });
    });
  });

  describe('getVariableValues: limit maximum number of coercion errors', () => {
    const doc = parse(`
      query ($input: [String!]) {
        listNN(input: $input)
      }
    `);

    const operation = doc.definitions[0];
    invariant(operation.kind === Kind.OPERATION_DEFINITION);
    const { variableDefinitions } = operation;
    invariant(variableDefinitions != null);

    const inputValue = { input: [0, 1, 2] };

    function invalidValueError(value: number, index: number) {
      return {
        message: `Variable "$input" got invalid value ${value} at "input[${index}]"; String cannot represent a non string value: ${value}`,
        locations: [{ line: 2, column: 14 }],
      };
    }

    it('return all errors by default', () => {
      const result = getVariableValues(schema, variableDefinitions, inputValue);

      expectJSON(result).toDeepEqual({
        errors: [
          invalidValueError(0, 0),
          invalidValueError(1, 1),
          invalidValueError(2, 2),
        ],
      });
    });

    it('when maxErrors is equal to number of errors', () => {
      const result = getVariableValues(
        schema,
        variableDefinitions,
        inputValue,
        { maxErrors: 3 },
      );

      expectJSON(result).toDeepEqual({
        errors: [
          invalidValueError(0, 0),
          invalidValueError(1, 1),
          invalidValueError(2, 2),
        ],
      });
    });

    it('when maxErrors is less than number of errors', () => {
      const result = getVariableValues(
        schema,
        variableDefinitions,
        inputValue,
        { maxErrors: 2 },
      );

      expectJSON(result).toDeepEqual({
        errors: [
          invalidValueError(0, 0),
          invalidValueError(1, 1),
          {
            message:
              'Too many errors processing variables, error limit reached. Execution aborted.',
          },
        ],
      });
    });
  });
});
