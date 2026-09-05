import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { GraphQLError } from '../../../error/GraphQLError.ts';

import type {
  ConstValueNode,
  InputValueDefinitionNode,
  ObjectTypeDefinitionNode,
} from '../../../language/ast.ts';
import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse, parseValue } from '../../../language/parser.ts';

import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLInt, GraphQLString } from '../../../type/scalars.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';
import { GraphQLSchema as GraphQLSchemaImpl } from '../../../type/schema.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { validateWithRules } from '../../index.ts';
import { validateSDL } from '../../validate.ts';

import type { ASTVisitorFn } from '../ASTValidationContext.ts';
import {
  ValuesOfCorrectTypeASTVisitor,
  ValuesOfCorrectTypeTypeSystemValidation,
} from '../ValuesOfCorrectTypeRule.ts';

import {
  createRuleValidationContext,
  expectSchemaErrors,
  getSDLRuleVisitor,
} from './harness.ts';

const SDLInputValueRules = [ValuesOfCorrectTypeASTVisitor];

function expectErrors(
  sdlStr: string,
  schema?: GraphQLSchema,
  rules: ReadonlyArray<ASTVisitorFn> = SDLInputValueRules,
) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    rules,
    schema,
  });
  return expectJSON(errors);
}

function expectErrorsWithLocations(
  sdlStr: string,
  schema?: GraphQLSchema,
  rules: ReadonlyArray<ASTVisitorFn> = SDLInputValueRules,
) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    rules,
    schema,
  });
  return expectJSON(errors);
}

function expectValid(
  sdlStr: string,
  schema?: GraphQLSchema,
  rules?: ReadonlyArray<ASTVisitorFn>,
) {
  expectErrors(sdlStr, schema, rules).toDeepEqual([]);
}

function assertValidSDLWithValidationRules(
  documentAST: ReturnType<typeof parse>,
  schema?: GraphQLSchema,
): void {
  const errors = validateWithRules({
    documentAST,
    schema,
  });
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}

describe('Validate: ValuesOfCorrectTypeRule', () => {
  it('ignores input value definitions without parent cursor info', () => {
    const doc = parse('input Input { value: Int = "bad" }', {
      noLocation: true,
    });
    const input = doc.definitions[0];
    if (input?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      throw new Error('Expected input object definition.');
    }
    const inputValue = input.fields?.[0];
    if (inputValue == null) {
      throw new Error('Expected input value definition.');
    }

    const errors = new Array<unknown>();
    const context = createRuleValidationContext(doc, undefined, (error) => {
      errors.push(error);
    });
    const visitor = getSDLRuleVisitor(ValuesOfCorrectTypeASTVisitor, context);
    const inputValueDefinition = (
      visitor as {
        readonly InputValueDefinition?:
          | ((node: InputValueDefinitionNode) => void)
          | undefined;
      }
    ).InputValueDefinition;
    if (typeof inputValueDefinition !== 'function') {
      throw new Error('Expected input value definition visitor.');
    }

    inputValueDefinition(inputValue);

    expectJSON(errors).toDeepEqual([]);
  });

  it('accepts SDL input value definitions with directives and no default', () => {
    expectValid(`
      directive @tag on ARGUMENT_DEFINITION

      type Query {
        field(arg: Int @tag): String
      }
    `);
  });

  it('runs validations without changing validateSDL defaults', () => {
    const doc = parse(
      `
        directive @tag(value: Int) on FIELD_DEFINITION

        type Query {
          field(arg: Int = "bad"): String @tag(value: "bad")
        }
      `,
      { noLocation: true },
    );

    expectJSON(validateSDL(doc)).toDeepEqual([]);
    expectJSON(
      validateWithRules({
        documentAST: doc,
      }),
    ).toDeepEqual([
      {
        message:
          'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
      },
      {
        message: 'Int cannot represent non-integer value: "bad"',
      },
    ]);
  });

  it('asserts SDL with validations', () => {
    expect(() =>
      assertValidSDLWithValidationRules(parse('type Query { field: String }')),
    ).not.to.throw();

    expect(() =>
      assertValidSDLWithValidationRules(
        parse('type Query { field(arg: Int = "bad"): String }'),
      ),
    ).to.throw(
      'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
    );
  });

  it('validates default values and directive argument values together', () => {
    expectErrors(
      `
        directive @tag(value: Int = "bad") on FIELD_DEFINITION

        type Query {
          field(arg: Int = "bad"): String @tag(value: "bad")
        }
      `,
      undefined,
    ).toDeepEqual([
      {
        message:
          '@tag(value:) has invalid default value: Int cannot represent non-integer value: "bad"',
      },
      {
        message:
          'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
      },
      {
        message: 'Int cannot represent non-integer value: "bad"',
      },
    ]);
  });

  it('accepts valid SDL default values and directive arguments', () => {
    expectValid(`
      scalar Custom

      enum Color {
        RED
      }

      input Input {
        int: Int!
        tags: [String]
        color: Color
        custom: Custom
      }

      directive @meta(input: Input) on FIELD_DEFINITION

      type Query {
        field(
          arg: Input = { int: 1, tags: ["a"], color: RED, custom: { anything: true } }
        ): String @meta(input: { int: 2 })
      }
    `);
  });

  it('validates executable input values', () => {
    const schema = buildSchema(`
      enum Color {
        RED
      }

      input Input {
        int: Int
      }

      type Query {
        field(
          int: Int
          list: [Int]
          input: Input
          color: Color
          floatInt: Int
          nullable: Int
          flag: Boolean
        ): String
      }
    `);
    const doc = parse(
      `
        query {
          field(
            int: "bad"
            list: [1, "bad"]
            input: { int: "bad" }
            color: RED
            floatInt: 1.2
            nullable: null
            flag: true
          )
          ...Frag
        }

        fragment Frag on Query {
          field(int: "bad")
        }
      `,
      { noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [ValuesOfCorrectTypeASTVisitor],
        schema,
      }),
    ).toDeepEqual([
      { message: 'Int cannot represent non-integer value: "bad"' },
      { message: 'Int cannot represent non-integer value: "bad"' },
      { message: 'Int cannot represent non-integer value: "bad"' },
      { message: 'Int cannot represent non-integer value: 1.2' },
      { message: 'Int cannot represent non-integer value: "bad"' },
    ]);
  });

  it('rejects invalid SDL default values and directive arguments', () => {
    expectErrors(`
      directive @bad(arg: Int = 2.718) on FIELD_DEFINITION

      type Query {
        field(arg: Int = 3.14): Int @bad(arg: "wrong")
      }

      input SomeInput {
        field: Int = 3.14
      }
    `).toDeepEqual([
      {
        message:
          '@bad(arg:) has invalid default value: Int cannot represent non-integer value: 2.718',
      },
      {
        message:
          'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: 3.14',
      },
      {
        message: 'Int cannot represent non-integer value: "wrong"',
      },
      {
        message:
          'SomeInput.field has invalid default value: Int cannot represent non-integer value: 3.14',
      },
    ]);
  });

  it('ignores values whose directive, argument, or input type is unknown', () => {
    expectValid(`
      directive @bad(arg: Query) on FIELD_DEFINITION

      type Output {
        field: String
      }

      input Input {
        field: Missing
        optional: Int! = 1
      }

      type Query {
        field(arg: Output = { field: "value" }): String
        input(arg: Input = { field: "value" }): String
        other: String @unknown(arg: "value") @deprecated(unknown: "value") @bad(arg: {})
      }

      extend input Missing {
        field: Int
      }

      extend input String {
        field: Int
      }
    `);
  });

  it('uses the custom schema directive list as-is for SDL directive values', () => {
    const schema = new GraphQLSchemaImpl({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      directives: [],
    });

    expectValid(
      'extend type Query { other: String @deprecated(reason: 123) }',
      schema,
    );
  });

  it('accepts sparse SDL definitions without values to validate', () => {
    expectValid(`
      directive @marker on FIELD_DEFINITION | INPUT_OBJECT | INTERFACE | ENUM

      enum EmptyEnum
      extend enum EmptyEnum @marker

      input EmptyInput @marker
      extend input EmptyInput @marker
      extend input MissingInput @marker

      interface EmptyInterface @marker
      extend interface EmptyInterface @marker

      type Query {
        field: String @marker
      }
    `);
  });

  it('validates nested SDL input object values', () => {
    expectErrors(`
      enum Color {
        RED
      }

      input Input {
        color: Color!
        count: Int
      }

      type Query {
        field(arg: Input = { color: "RED", count: "many" }): String
      }
    `).toDeepEqual([
      {
        message:
          'Query.field(arg:) has invalid default value at .color: Enum "Color" cannot represent non-enum value: "RED". Did you mean the enum value "RED"?',
      },
      {
        message:
          'Query.field(arg:) has invalid default value at .count: Int cannot represent non-integer value: "many"',
      },
    ]);
  });

  it('validates interface field argument defaults', () => {
    expectErrors(`
      interface Node {
        field(arg: Int = "bad"): String
      }

      extend interface Node {
        other(arg: Int = "bad"): String
      }

      type Query {
        node: Node
      }
    `).toDeepEqual([
      {
        message:
          'Node.field(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
      },
      {
        message:
          'Node.other(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
      },
    ]);
  });

  it('uses SDL enum and input object extensions', () => {
    expectErrors(`
      enum Color {
        RED
      }

      extend enum Color {
        GREEN
      }

      input Input {
        color: Color
      }

      extend input Input {
        size: Int = "large"
      }

      type Query {
        field(arg: Input = { color: GREEN, size: "large" }): String
      }
    `).toDeepEqual([
      {
        message:
          'Input.size has invalid default value: Int cannot represent non-integer value: "large"',
      },
      {
        message:
          'Query.field(arg:) has invalid default value at .size: Int cannot represent non-integer value: "large"',
      },
    ]);
  });

  it('uses SDL input object extensions before definitions', () => {
    expectErrors(`
      extend input Input {
        size: Int
      }

      input Input {
        color: String
      }

      type Query {
        field(arg: Input = { size: "large" }): String
      }
    `).toDeepEqual([
      {
        message:
          'Query.field(arg:) has invalid default value at .size: Int cannot represent non-integer value: "large"',
      },
    ]);
  });

  it('validates input object literal fields against the last duplicate SDL field definition', () => {
    expectErrors(`
      input Input {
        value: Int
        value: Boolean
      }

      type Query {
        field(arg: Input = { value: "bad" }): String
      }
    `).toDeepEqual([
      {
        message:
          'Query.field(arg:) has invalid default value at .value: Boolean cannot represent a non boolean value: "bad"',
      },
    ]);
  });

  it('validates directive arguments against the last duplicate SDL argument definition', () => {
    expectErrors(`
      directive @tag(value: Int, value: Boolean) on FIELD_DEFINITION

      type Query {
        field: String @tag(value: "bad")
      }
    `).toDeepEqual([
      {
        message: 'Boolean cannot represent a non boolean value: "bad"',
      },
    ]);
  });

  it('validates SDL OneOf input object values', () => {
    expectErrors(`
      input Choice @oneOf {
        a: String
        b: Int
      }

      type Query {
        field(arg: Choice = {}): String
      }
    `).toDeepEqual([
      {
        message:
          'Query.field(arg:) has invalid default value: Within OneOf Input Object type "Choice", exactly one field must be specified, and the value for that field must be non-null.',
      },
    ]);
  });

  it('uses an existing schema when validating SDL extensions', () => {
    const schema = buildSchema(`
      directive @limit(
        max: Int
        input: ExistingInput
        values: [Int!]!
      ) on FIELD_DEFINITION

      input ExistingInput {
        required: Int!
      }

      type Query {
        field: String
      }
    `);

    expectErrors(
      `
        extend type Query {
          other: String @limit(max: "many", input: { required: "bad" }, values: [1, null])
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message: 'Int cannot represent non-integer value: "many"',
      },
      {
        message: 'Int cannot represent non-integer value: "bad"',
      },
      {
        message: 'Expected value of non-null type "Int!" not to be null.',
      },
    ]);
  });

  it('uses existing scalar coercion errors when validating SDL extensions', () => {
    const CustomScalar = new GraphQLScalarType({
      name: 'Custom',
      parseValue() {
        return null;
      },
      parseLiteral() {
        throw new GraphQLError('Custom scalar rejected this value.');
      },
    });

    const schema = new GraphQLSchemaImpl({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      types: [CustomScalar],
    });

    expectErrors(
      `
        extend type Query {
          other(arg: Custom = "bad"): String
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Query.other(arg:) has invalid default value: Custom scalar rejected this value.',
      },
    ]);
  });

  it('reports directive argument scalar errors on the argument value', () => {
    const CustomScalar = new GraphQLScalarType({
      name: 'Custom',
      parseValue() {
        return null;
      },
      parseLiteral() {
        throw new GraphQLError('Custom scalar rejected this value.');
      },
    });

    const schema = new GraphQLSchemaImpl({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      types: [CustomScalar],
    });

    expectErrorsWithLocations(
      `
        directive @tag(arg: Custom) on OBJECT

        type Query @tag(arg: "bad") {
          field: String
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message: 'Custom scalar rejected this value.',
        locations: [{ line: 4, column: 30 }],
      },
    ]);
  });

  it('uses existing OneOf input objects when validating SDL extensions', () => {
    const schema = buildSchema(`
      directive @choose(input: Choice) on FIELD_DEFINITION

      input Choice @oneOf {
        a: String
        b: Int
      }

      type Query {
        field: String
      }
    `);

    expectErrors(
      `
        extend type Query {
          other: String @choose(input: {})
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Within OneOf Input Object type "Choice", exactly one field must be specified, and the value for that field must be non-null.',
      },
    ]);
  });

  it('validates schema default values', () => {
    const queryDefinition = parse(
      `
        type Query {
          field(
            suggestionArg: [SuggestInput]! = [{ color: RED }]
            nonNullArg: Int! = null
          ): String
        }
      `,
      { noLocation: true },
    ).definitions[0] as ObjectTypeDefinitionNode;
    const suggestionArgNode = queryDefinition.fields?.[0].arguments?.[0];
    const nonNullArgNode = queryDefinition.fields?.[0].arguments?.[1];
    if (suggestionArgNode == null || nonNullArgNode == null) {
      throw new Error('Expected argument nodes.');
    }

    const CustomScalar = new GraphQLScalarType({
      name: 'CustomScalar',
      parseValue() {
        return null;
      },
      parseLiteral() {
        throw new GraphQLError('Custom schema scalar rejected this value.');
      },
    });
    const Color = new GraphQLEnumType({
      name: 'Color',
      values: {
        RED: { value: 0 },
      },
    });
    const LiteralInput = new GraphQLInputObjectType({
      name: 'LiteralInput',
      fields: {
        required: { type: new GraphQLNonNull(GraphQLInt) },
        items: { type: new GraphQLList(GraphQLInt) },
      },
    });
    const SuggestInput = new GraphQLInputObjectType({
      name: 'SuggestInput',
      fields: {
        color: { type: Color },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            literalArg: {
              type: LiteralInput,
              default: {
                literal: parseValue('{ required: "bad", items: [1, "bad"] }', {
                  noLocation: true,
                }) as ConstValueNode,
              },
            },
            suggestionArg: {
              type: new GraphQLNonNull(new GraphQLList(SuggestInput)),
              default: { value: [{ color: 0 }] },
              astNode: suggestionArgNode,
            },
            listSuggestionArg: {
              type: new GraphQLList(Color),
              default: { value: 0 },
            },
            nonNullArg: {
              type: new GraphQLNonNull(GraphQLInt),
              default: { value: null },
              astNode: nonNullArgNode,
            },
            customLiteralArg: {
              type: CustomScalar,
              default: {
                literal: parseValue('"bad"', {
                  noLocation: true,
                }) as ConstValueNode,
              },
            },
            originalArg: {
              type: LiteralInput,
              default: { value: { missing: 1 } },
            },
          },
        },
      },
    });
    const schema = new GraphQLSchemaImpl({
      query: Query,
      types: [Color, CustomScalar],
    });

    expectSchemaErrors(
      schema,
      ValuesOfCorrectTypeTypeSystemValidation,
    ).toDeepEqual([
      {
        message:
          'Query.field(literalArg:) has invalid default value at .required: Int cannot represent non-integer value: "bad"',
      },
      {
        message:
          'Query.field(literalArg:) has invalid default value at .items[1]: Int cannot represent non-integer value: "bad"',
      },
      {
        message:
          'Query.field(suggestionArg:) has invalid default value: [{ color: 0 }]. Did you mean: [{ color: "RED" }]?',
      },
      {
        message:
          'Query.field(listSuggestionArg:) has invalid default value: 0. Did you mean: ["RED"]?',
      },
      {
        message:
          'Query.field(nonNullArg:) has invalid default value: Expected value of non-null type "Int!" not to be null.',
      },
      {
        message:
          'Query.field(customLiteralArg:) has invalid default value: Custom schema scalar rejected this value.',
      },
      {
        message:
          'Query.field(originalArg:) has invalid default value: Expected value of type "LiteralInput" to include required field "required", found: { missing: 1 }.',
      },
      {
        message:
          'Query.field(originalArg:) has invalid default value: Expected value of type "LiteralInput" not to include unknown field "missing", found: { missing: 1 }.',
      },
    ]);
  });

  it('ignores schema values whose declared input types are invalid', () => {
    const BadInput = new GraphQLObjectType({
      name: 'BadInput',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            bad: {
              // @ts-expect-error Testing defensive validation of invalid config.
              type: BadInput,
              default: { value: 'not validated here' },
            },
          },
        },
      },
    });
    const tagDirective = new GraphQLDirective({
      name: 'tag',
      locations: [DirectiveLocation.OBJECT],
      args: {
        // @ts-expect-error Testing defensive validation of invalid config.
        bad: { type: BadInput },
      },
    });
    const schema = new GraphQLSchemaImpl({
      query: Query,
      directives: [tagDirective],
    });
    expectSchemaErrors(
      schema,
      ValuesOfCorrectTypeTypeSystemValidation,
    ).toDeepEqual([]);
  });
});
