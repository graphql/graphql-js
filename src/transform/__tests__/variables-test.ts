import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { inspect } from '../../jsutils/inspect.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import { DirectiveLocation } from '../../language/directiveLocation.js';
import { Kind } from '../../language/kinds.js';
import { parse } from '../../language/parser.js';

import type {
  GraphQLArgumentConfig,
  GraphQLFieldConfig,
} from '../../type/definition.js';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../type/definition.js';
import {
  GraphQLDirective,
  GraphQLIncludeDirective,
} from '../../type/directives.js';
import { GraphQLBoolean, GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { getVariableValues } from '../../execution/values.js';

import { execute, executeSync } from './execute.js';

const TestFaultyScalarGraphQLError = new GraphQLError(
  'FaultyScalarErrorMessage',
  {
    extensions: {
      code: 'FaultyScalarErrorExtensionCode',
    },
  },
);

const TestFaultyScalar = new GraphQLScalarType({
  name: 'FaultyScalar',
  coerceInputValue() {
    throw TestFaultyScalarGraphQLError;
  },
  coerceInputLiteral() {
    throw TestFaultyScalarGraphQLError;
  },
});

const TestComplexScalar = new GraphQLScalarType({
  name: 'ComplexScalar',
  coerceInputValue(value) {
    expect(value).to.equal('ExternalValue');
    return 'InternalValue';
  },
  coerceInputLiteral(ast) {
    expect(ast).to.include({ kind: 'StringValue', value: 'ExternalValue' });
    return 'InternalValue';
  },
});

const NestedType: GraphQLObjectType = new GraphQLObjectType({
  name: 'NestedType',
  fields: {
    echo: fieldWithInputArg({ type: GraphQLString }),
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

const TestOneOfInputObject = new GraphQLInputObjectType({
  name: 'TestOneOfInputObject',
  fields: {
    a: { type: GraphQLString },
    b: { type: GraphQLString },
  },
  isOneOf: true,
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
    fieldWithOneOfObjectInput: fieldWithInputArg({
      type: TestOneOfInputObject,
    }),
    fieldWithNullableStringInput: fieldWithInputArg({ type: GraphQLString }),
    fieldWithNonNullableStringInput: fieldWithInputArg({
      type: new GraphQLNonNull(GraphQLString),
    }),
    fieldWithDefaultArgumentValue: fieldWithInputArg({
      type: GraphQLString,
      default: { value: 'Hello World' },
    }),
    fieldWithNonNullableStringInputAndDefaultArgumentValue: fieldWithInputArg({
      type: new GraphQLNonNull(GraphQLString),
      default: { value: 'Hello World' },
    }),
    fieldWithNestedInputObject: fieldWithInputArg({
      type: TestNestedInputObject,
    }),
    list: fieldWithInputArg({ type: new GraphQLList(GraphQLString) }),
    nested: {
      type: NestedType,
      resolve: () => ({}),
    },
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

const schema = new GraphQLSchema({
  query: TestType,
  directives: [
    new GraphQLDirective({
      name: 'skip',
      description:
        'Directs the executor to skip this field or fragment when the `if` argument is true.',
      locations: [
        DirectiveLocation.FIELD,
        DirectiveLocation.FRAGMENT_SPREAD,
        DirectiveLocation.INLINE_FRAGMENT,
      ],
      args: {
        if: {
          type: new GraphQLNonNull(GraphQLBoolean),
          description: 'Skipped when true.',
          // default values will override operation variables in the setting of defined fragment variables that are not provided
          default: { value: true },
        },
      },
    }),
    GraphQLIncludeDirective,
  ],
});

function executeQuery(
  query: string,
  variableValues?: { [variable: string]: unknown },
) {
  const document = parse(query);
  return executeSync({ schema, document, variableValues });
}

function executeQueryWithFragmentArguments(
  query: string,
  variableValues?: { [variable: string]: unknown },
) {
  const document = parse(query, { experimentalFragmentArguments: true });
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
                'Argument "TestType.fieldWithObjectInput(input:)" has invalid value: Expected value of type "TestInputObject" to be an object, found: ["foo", "bar", "baz"].',
              path: ['fieldWithObjectInput'],
              locations: [{ line: 3, column: 41 }],
            },
          ],
        });
      });

      it('properly runs coerceInputLiteral on complex scalar types', () => {
        const result = executeQuery(`
          {
            fieldWithObjectInput(input: {c: "foo", d: "ExternalValue"})
          }
        `);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{ c: "foo", d: "InternalValue" }',
          },
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
              message:
                'Argument "TestType.fieldWithObjectInput(input:)" has invalid value at .e: FaultyScalarErrorMessage',
              path: ['fieldWithObjectInput'],
              locations: [{ line: 3, column: 13 }],
              extensions: { code: 'FaultyScalarErrorExtensionCode' },
            },
          ],
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
        const params = { input: { c: 'foo', d: 'ExternalValue' } };
        const result = executeQuery(doc, params);

        expect(result).to.deep.equal({
          data: {
            fieldWithObjectInput: '{ c: "foo", d: "InternalValue" }',
          },
        });
      });

      it('errors on faulty scalar type input', () => {
        const params = { input: { c: 'foo', e: 'ExternalValue' } };
        const result = executeQuery(doc, params);

        expectJSON(result).toDeepEqual({
          errors: [
            {
              message:
                'Variable "$input" has invalid value at .e: Argument "TestType.fieldWithObjectInput(input:)" has invalid value at .e: FaultyScalarErrorMessage',
              locations: [{ line: 2, column: 16 }],
              extensions: { code: 'FaultyScalarErrorExtensionCode' },
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
                'Variable "$input" has invalid value at .c: Expected value of non-null type "String!" not to be null.',
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
                'Variable "$input" has invalid value: Expected value of type "TestInputObject" to be an object, found: "foo bar".',
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
                'Variable "$input" has invalid value: Expected value of type "TestInputObject" to include required field "c", found: { a: "foo", b: "bar" }.',
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
                'Variable "$input" has invalid value at .na: Expected value of type "TestInputObject" to include required field "c", found: { a: "foo" }.',
              locations: [{ line: 2, column: 18 }],
            },
            {
              message:
                'Variable "$input" has invalid value: Expected value of type "TestNestedInputObject" to include required field "nb", found: { na: { a: "foo" } }.',
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
                'Variable "$input" has invalid value: Expected value of type "TestInputObject" not to include unknown field "extra", found: { a: "foo", b: "bar", c: "baz", extra: "dog" }.',
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
              'Variable "$value" has invalid value: Expected a value of non-null type "String!" to be provided.',
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
              'Variable "$value" has invalid value: Expected value of non-null type "String!" not to be null.',
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
              'Argument "TestType.fieldWithNonNullableStringInput(input:)" of required type "String!" was not provided.',
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
              'Variable "$value" has invalid value: String cannot represent a non string value: [1, 2, 3]',
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
              'Argument "TestType.fieldWithNonNullableStringInput(input:)" has invalid value: Expected variable "$foo" provided to type "String!" to provide a runtime value.',
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
              'Variable "$input" has invalid value: Expected value of non-null type "[String]!" not to be null.',
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
              'Variable "$input" has invalid value at [1]: Expected value of non-null type "String!" not to be null.',
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
              'Variable "$input" has invalid value: Expected value of non-null type "[String!]!" not to be null.',
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
              'Variable "$input" has invalid value at [1]: Expected value of non-null type "String!" not to be null.',
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
            message:
              'Argument "TestType.fieldWithDefaultArgumentValue(input:)" has invalid value: String cannot represent a non string value: WRONG_TYPE',
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
    assert(operation.kind === Kind.OPERATION_DEFINITION);
    const { variableDefinitions } = operation;
    assert(variableDefinitions != null);

    const inputValue = { input: [0, 1, 2] };

    function invalidValueError(value: number, index: number) {
      return {
        message: `Variable "$input" has invalid value at [${index}]: String cannot represent a non string value: ${value}`,
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

  describe('using fragment arguments', () => {
    it('when there are no fragment arguments', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a
        }
        fragment a on TestType {
          fieldWithNonNullableStringInput(input: "A")
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"A"',
        },
      });
    });

    it('when a value is required and provided', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: "A")
        }
        fragment a($value: String!) on TestType {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"A"',
        },
      });
    });

    it('when a value is required and not provided', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a
        }
        fragment a($value: String!) on TestType {
          fieldWithNullableStringInput(input: $value)
        }
      `);

      expect(result).to.have.property('errors');
      expect(result.errors).to.have.length(1);
      expect(result.errors?.at(0)?.message).to.match(
        /Argument "value" of required type "String!"/,
      );
    });

    it('when the definition has a default and is provided', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: "A")
        }
        fragment a($value: String! = "B") on TestType {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"A"',
        },
      });
    });

    it('when the definition has a default and is not provided', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a
        }
        fragment a($value: String! = "B") on TestType {
          fieldWithNonNullableStringInput(input: $value)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"B"',
        },
      });
    });

    it('when a definition has a default, is not provided, and spreads another fragment', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a
        }
        fragment a($a: String! = "B") on TestType {
          ...b(b: $a)
        }
        fragment b($b: String!) on TestType {
          fieldWithNonNullableStringInput(input: $b)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInput: '"B"',
        },
      });
    });

    it('when the definition has a non-nullable default and is provided null', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: null)
        }
        fragment a($value: String! = "B") on TestType {
          fieldWithNullableStringInput(input: $value)
        }
      `);

      expect(result).to.have.property('errors');
      expect(result.errors).to.have.length(1);
      expect(result.errors?.at(0)?.message).to.match(
        /Argument "value" has invalid value: Expected value of non-null type "String!" not to be null./,
      );
    });

    it('when the definition has no default and is not provided', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a
        }
        fragment a($value: String) on TestType {
          fieldWithNonNullableStringInputAndDefaultArgumentValue(input: $value)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInputAndDefaultArgumentValue:
            '"Hello World"',
        },
      });
    });

    it('when an argument is shadowed by an operation variable', () => {
      const result = executeQueryWithFragmentArguments(`
        query($x: String! = "A") {
          ...a(x: "B")
        }
        fragment a($x: String) on TestType {
          fieldWithNullableStringInput(input: $x)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"B"',
        },
      });
    });

    it('when a nullable argument without a field default is not provided and shadowed by an operation variable', () => {
      const result = executeQueryWithFragmentArguments(`
        query($x: String = "A") {
          ...a
        }
        fragment a($x: String) on TestType {
          fieldWithNullableStringInput(input: $x)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: null,
        },
      });
    });

    it('when a nullable argument with a field default is not provided and shadowed by an operation variable', () => {
      const result = executeQueryWithFragmentArguments(`
        query($x: String = "A") {
          ...a
        }
        fragment a($x: String) on TestType {
          fieldWithNonNullableStringInputAndDefaultArgumentValue(input: $x)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNonNullableStringInputAndDefaultArgumentValue:
            '"Hello World"',
        },
      });
    });

    it('when a fragment-variable is shadowed by an intermediate fragment-spread but defined in the operation-variables', () => {
      const result = executeQueryWithFragmentArguments(`
        query($x: String = "A") {
          ...a
        }
        fragment a($x: String) on TestType {
          ...b
        }

        fragment b on TestType {
          fieldWithNullableStringInput(input: $x)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldWithNullableStringInput: '"A"',
        },
      });
    });

    it('when a fragment is used with different args', () => {
      const result = executeQueryWithFragmentArguments(`
        query($x: String = "Hello") {
          a: nested {
            ...a(x: "a")
          }
          b: nested {
            ...a(x: "b", b: true)
          }
          hello: nested {
            ...a(x: $x)
          }
        }
        fragment a($x: String, $b: Boolean = false) on NestedType {
          a: echo(input: $x) @skip(if: $b)
          b: echo(input: $x) @include(if: $b)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          a: {
            a: '"a"',
          },
          b: {
            b: '"b"',
          },
          hello: {
            a: '"Hello"',
          },
        },
      });
    });

    it('when the argument variable is nested in a complex type', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: "C")
        }
        fragment a($value: String) on TestType {
          list(input: ["A", "B", $value, "D"])
        }
      `);
      expect(result).to.deep.equal({
        data: {
          list: '["A", "B", "C", "D"]',
        },
      });
    });

    it('when argument variables are used recursively', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(aValue: "C")
        }
        fragment a($aValue: String) on TestType {
          ...b(bValue: $aValue)
        }
        fragment b($bValue: String) on TestType {
          list(input: ["A", "B", $bValue, "D"])
        }
      `);
      expect(result).to.deep.equal({
        data: {
          list: '["A", "B", "C", "D"]',
        },
      });
    });

    it('when argument variables with the same name are used directly and recursively', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: "A")
        }
        fragment a($value: String!) on TestType {
          ...b(value: "B")
          fieldInFragmentA: fieldWithNonNullableStringInput(input: $value)
        }
        fragment b($value: String!) on TestType {
          fieldInFragmentB: fieldWithNonNullableStringInput(input: $value)
        }
      `);
      expect(result).to.deep.equal({
        data: {
          fieldInFragmentA: '"A"',
          fieldInFragmentB: '"B"',
        },
      });
    });

    it('when argument passed in as list', () => {
      const result = executeQueryWithFragmentArguments(`
        query Q($opValue: String = "op") {
          ...a(aValue: "A")
        }
        fragment a($aValue: String, $bValue: String) on TestType {
          ...b(aValue: [$aValue, "B"], bValue: [$bValue, $opValue])
        }
        fragment b($aValue: [String], $bValue: [String], $cValue: String) on TestType {
          aList: list(input: $aValue)
          bList: list(input: $bValue)
          cList: list(input: [$cValue])
        }
      `);
      expect(result).to.deep.equal({
        data: {
          aList: '["A", "B"]',
          bList: '[null, "op"]',
          cList: '[null]',
        },
      });
    });

    it('when argument passed to a directive', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: true)
        }
        fragment a($value: Boolean!) on TestType {
          fieldWithNonNullableStringInput @skip(if: $value)
        }
      `);
      expect(result).to.deep.equal({
        data: {},
      });
    });

    it('when argument passed to a directive on a nested field', () => {
      const result = executeQueryWithFragmentArguments(`
        query {
          ...a(value: true)
        }
        fragment a($value: Boolean!) on TestType {
          nested { echo(input: "echo") @skip(if: $value) }
        }
      `);
      expect(result).to.deep.equal({
        data: { nested: {} },
      });
    });

    it('when a nullable argument to a directive with a field default is not provided and shadowed by an operation variable', () => {
      // this test uses the @defer directive and incremental delivery because the `if` argument for skip/include have no field defaults
      const document = parse(
        `
          query($shouldDefer: Boolean = false) {
            ...a
          }
          fragment a($shouldDefer: Boolean) on TestType {
            ... @defer(if: $shouldDefer) {
              fieldWithDefaultArgumentValue
            }
          }
        `,
        { experimentalFragmentArguments: true },
      );
      const result = execute({ schema, document });
      expect(result).to.include.keys('initialResult', 'subsequentResults');
    });
  });
});
