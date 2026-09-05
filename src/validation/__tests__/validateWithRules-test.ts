import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';
import { expectMatchingValues } from '../../__testUtils__/expectMatchingValues.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DocumentNode } from '../../language/ast.ts';
import { DirectiveLocation } from '../../language/directiveLocation.ts';
import { Kind } from '../../language/kinds.ts';
import { parse } from '../../language/parser.ts';

import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../type/definition.ts';
import { GraphQLDirective } from '../../type/directives.ts';
import { GraphQLInt, GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';
import { validateSchema } from '../../type/validate.ts';

import { validateWithRules } from '../index.ts';
import type { TypeSystemValidationFn } from '../TypeSystemValidationIndex.ts';
import type { ASTVisitorFn } from '../unifiedValidationRules/ASTValidationContext.ts';
import { FieldsOnCorrectTypeASTVisitor } from '../unifiedValidationRules/FieldsOnCorrectTypeRule.ts';
import { ValuesOfCorrectTypeASTVisitor } from '../unifiedValidationRules/ValuesOfCorrectTypeRule.ts';
import { validate } from '../validate.ts';

describe('validateWithRules', () => {
  it('requires a schema or document', () => {
    expect(() => validateWithRules({})).to.throw(
      'Must provide a schema or document to validate.',
    );
  });

  it('validates a schema with explicit schema validation rules', () => {
    const schema = schemaWithQuery();
    const rule: TypeSystemValidationFn = (context) => {
      if (context.schema === schema) {
        context.reportError('Visited schema.');
      }
    };

    expectJSON(
      validateWithRules({ schema, typeSystemRules: [rule] }),
    ).toDeepEqual([{ message: 'Visited schema.' }]);
  });

  it('ignores AST-only visitors when validating a schema', () => {
    const schema = schemaWithQuery();
    const rule: ASTVisitorFn = () => {
      throw new Error('Unexpected AST visitor creation.');
    };

    expectJSON(validateWithRules({ schema, rules: [rule] })).toDeepEqual([]);
  });

  it('validates a schema with the default schema validation visitors', () => {
    const EmptyEnum = new GraphQLEnumType({
      name: 'EmptyEnum',
      values: {},
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyEnum },
        },
      }),
    });

    expectJSON(validateWithRules({ schema })).toDeepEqual([
      { message: 'Enum type EmptyEnum must define one or more values.' },
    ]);
  });

  it('ignores the legacy schema validation cache', () => {
    const schema = schemaWithQuery();
    const cachedErrors = [new GraphQLError('Cached schema error.')];
    schema.__validationErrors = cachedErrors;

    expectJSON(validateWithRules({ schema })).toDeepEqual([]);
    expect(schema.__validationErrors).to.equal(cachedErrors);
  });

  it('rejects disabling existing schema errors for schema-only validation', () => {
    expect(() =>
      validateWithRules({
        schema: schemaWithQuery(),
        includeExistingSchemaErrors: false,
      }),
    ).to.throw(
      'Cannot validate a schema without reporting existing schema errors.',
    );
  });

  it('matches validateSchema with default schema validation rules', () => {
    const EmptyEnum = new GraphQLEnumType({
      name: 'EmptyEnum',
      values: {},
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyEnum },
        },
      }),
    });

    expectJSON(
      expectMatchingValues([
        validateSchema(schema),
        validateWithRules({ schema }),
      ]),
    ).toDeepEqual([
      { message: 'Enum type EmptyEnum must define one or more values.' },
    ]);
  });

  it('matches validate with default executable validation rules', () => {
    const schema = schemaWithQuery();
    const document = parse('{ missing }');

    expectJSON(
      expectMatchingValues([
        validate(schema, document),
        validateWithRules({ documentAST: document, schema }),
      ]),
    ).toDeepEqual([
      {
        message: 'Cannot query field "missing" on type "Query".',
        locations: [{ line: 1, column: 3 }],
      },
    ]);
  });

  it('validates SDL with corresponding GraphQL validation rules', () => {
    const document = parse(`
      directive @tag on OBJECT

      type Query @unknown @tag @tag {
        field: Missing
      }

      type Query {
        other: String
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
      }),
    ).toDeepEqual([
      {
        message: 'Unknown type "Missing".',
        locations: [{ line: 5, column: 16 }],
      },
      {
        message: 'There can be only one type named "Query".',
        locations: [
          { line: 4, column: 12 },
          { line: 8, column: 12 },
        ],
      },
      {
        message: 'The directive "@tag" can only be used once at this location.',
        locations: [
          { line: 4, column: 27 },
          { line: 4, column: 32 },
        ],
      },
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 4, column: 18 }],
      },
    ]);
  });

  it('validates an empty document without a schema', () => {
    const document: DocumentNode = { kind: Kind.DOCUMENT, definitions: [] };

    expectJSON(validateWithRules({ documentAST: document })).toDeepEqual([
      { message: 'Query root type must be provided.' },
    ]);
  });

  it('validates a document with explicit validations', () => {
    const rule: ASTVisitorFn = (context) => ({
      Field() {
        context.reportError(new GraphQLError('Visited executable.'));
      },
    });

    expectJSON(
      validateWithRules({ documentAST: parse('{ field }'), rules: [rule] }),
    ).toDeepEqual([{ message: 'Visited executable.' }]);
  });

  it('rethrows unexpected rule errors', () => {
    const rule: ASTVisitorFn = () => ({
      Field() {
        throw new Error('Unexpected rule error.');
      },
    });

    expect(() =>
      validateWithRules({ documentAST: parse('{ field }'), rules: [rule] }),
    ).to.throw('Unexpected rule error.');
  });

  it('passes a schema to validations', () => {
    const schema = schemaWithQuery();
    const rule: TypeSystemValidationFn = (context) => {
      context.reportError(
        context.schema?.getQueryType()?.name ?? 'missing schema',
      );
    };

    expectJSON(
      validateWithRules({
        documentAST: parse('extend type Query { other: String }'),
        typeSystemRules: [rule],
        schema,
      }),
    ).toDeepEqual([{ message: 'Query' }]);
  });

  it('validates only type names from the document when extending a schema', () => {
    const schema = schemaWithQuery();
    const rule: TypeSystemValidationFn = (context) => {
      context.reportError(
        context.documentIndex.getDocumentTypeNames().join(','),
      );
    };

    expectJSON(
      validateWithRules({
        documentAST: parse('type Other { field: String }'),
        typeSystemRules: [rule],
        schema,
      }),
    ).toDeepEqual([{ message: 'Other' }]);
  });

  it('tracks executable type information for executable definitions', () => {
    const schema = schemaWithQuery();
    const rule: ASTVisitorFn = (context) => ({
      Field() {
        const fieldDef = context.indexCursor.getCurrentFieldDef();
        if (fieldDef != null) {
          context.reportError(
            new GraphQLError(context.index.getFieldName(fieldDef)),
          );
        }
      },
    });

    expectJSON(
      validateWithRules({
        documentAST: parse('{ field }'),
        rules: [rule],
        schema,
      }),
    ).toDeepEqual([{ message: 'field' }]);
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          extend type Query {
            other: String
          }

          {
            field
          }
        `),
        rules: [rule],
        schema,
      }),
    ).toDeepEqual([{ message: 'field' }]);
  });

  it('uses default executable validation for executable-only documents with a schema', () => {
    const schema = schemaWithQuery();
    const documentAST = parse('{ missing }');
    const firstErrors = validateWithRules({
      documentAST,
      schema,
    });
    const secondErrors = validateWithRules({
      documentAST,
      schema,
    });

    expectJSON(firstErrors).toDeepEqual([
      {
        message: 'Cannot query field "missing" on type "Query".',
        locations: [{ line: 1, column: 3 }],
      },
    ]);
    expectJSON(secondErrors).toDeepEqual([
      {
        message: 'Cannot query field "missing" on type "Query".',
        locations: [{ line: 1, column: 3 }],
      },
    ]);
  });

  it('validates a document with the default validations', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse('type Query { field(arg: Int = "bad"): String }'),
      }),
    ).toDeepEqual([
      {
        message:
          'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
        locations: [{ line: 1, column: 31 }],
      },
    ]);
  });

  it('runs default validations when the schema is defined by SDL', () => {
    const documentAST = parse(
      `
        directive @tag(value: Int!) on FIELD

        type Query {
          field(required: Int!, input: Input): String
          dog: Dog
        }

        type Dog {
          name: String
        }

        input Input {
          int: Int
        }

        query($v: String) {
          missing
          field(required: "bad", input: { int: "bad" })
          other: field @tag(value: "bad")
          dog
          variable: field(required: $v)
        }
      `,
      { noLocation: true },
    );

    expect(
      validateWithRules({ documentAST }).map((error) => error.message),
    ).to.eql([
      'Cannot query field "missing" on type "Query".',
      'Int cannot represent non-integer value: "bad"',
      'Int cannot represent non-integer value: "bad"',
      'Int cannot represent non-integer value: "bad"',
      'Argument "Query.field(required:)" of type "Int!" is required, but it was not provided.',
      'Field "dog" of type "Dog" must have a selection of subfields. Did you mean "dog { ... }"?',
      'Variable "$v" of type "String" used in position expecting type "Int!".',
    ]);
  });

  it('validates split mixed-document definitions repeatedly', () => {
    const documentAST = parse(`
      type Query {
        field: String
      }

      {
        field
      }
    `);

    expectJSON(validateWithRules({ documentAST })).toDeepEqual([]);
    expectJSON(validateWithRules({ documentAST })).toDeepEqual([]);
  });

  it('reports invalid mixed extensions with assumed-valid schemas', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          extend type Missing {
            other: String
          }

          {
            field
          }
        `),
        schema: assumedValidSchema(),
      }),
    ).toDeepEqual([
      {
        message: 'Cannot extend type "Missing" because it is not defined.',
        locations: [{ line: 2, column: 23 }],
      },
    ]);
  });

  it('respects max errors during type-system document validation', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse('type Query @unknown { field: String }'),
        maxErrors: 0,
      }),
    ).toDeepEqual([
      {
        message:
          'Too many validation errors, error limit reached. Validation aborted.',
      },
    ]);
  });

  it('rejects schema extensions without explicit schema definitions', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          directive @tag on SCHEMA

          extend schema @tag

          type Query {
            field: String
          }
        `),
      }),
    ).toDeepEqual([
      {
        message: 'Cannot extend schema because it is not defined.',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('continues validating invalid schema extensions', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          extend schema {
            query: String
          }

          type Mutation {
            field: String
          }
        `),
      }),
    ).toDeepEqual([
      {
        message: 'Cannot extend schema because it is not defined.',
        locations: [{ line: 2, column: 11 }],
      },
      {
        message: 'Query root type must be Object type, it cannot be String.',
        locations: [{ line: 3, column: 20 }],
      },
    ]);
  });

  it('runs default type-system validations when extending a schema', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(
          'extend type Query { other(arg: Int = "bad"): String }',
        ),
        schema: schemaWithQuery(),
      }),
    ).toDeepEqual([
      {
        message:
          'Query.other(arg:) has invalid default value: Int cannot represent non-integer value: "bad"',
        locations: [{ line: 1, column: 38 }],
      },
    ]);
  });

  it('requires a query root type when no schema is provided', () => {
    expectJSON(
      validateWithRules({ documentAST: parse('{ field }') }),
    ).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });

  it('can include errors from an existing schema when validating a document', () => {
    const EmptyEnum = new GraphQLEnumType({
      name: 'EmptyEnum',
      values: {},
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyEnum },
        },
      }),
    });
    const document = parse('extend type Query { other: String }');

    expectJSON(
      validateWithRules({ documentAST: document, schema }),
    ).toDeepEqual([]);
    expectJSON(
      validateWithRules({
        documentAST: document,
        schema,
        includeExistingSchemaErrors: true,
      }),
    ).toDeepEqual([
      { message: 'Enum type EmptyEnum must define one or more values.' },
    ]);
  });

  it('does not include schema errors corrected by document extensions', () => {
    const EmptyEnum = new GraphQLEnumType({
      name: 'EmptyEnum',
      values: {},
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyEnum },
        },
      }),
    });
    const document = parse('extend enum EmptyEnum { VALUE }');

    expectJSON(
      validateWithRules({
        documentAST: document,
        schema,
        includeExistingSchemaErrors: true,
      }),
    ).toDeepEqual([]);
  });

  it('reports invalid extensions when including existing schema errors', () => {
    const document = parse('extend type Missing { field: String }');

    expectJSON(
      validateWithRules({
        documentAST: document,
        schema: schemaWithQuery(),
        includeExistingSchemaErrors: true,
      }).map((error) => error.message),
    ).toDeepEqual(['Cannot extend type "Missing" because it is not defined.']);
  });

  it('requires an existing schema when existing schema errors are requested', () => {
    const document = parse('type Query { field: String }');

    expect(() =>
      validateWithRules({
        documentAST: document,
        includeExistingSchemaErrors: true,
      }),
    ).to.throw(
      'Cannot include existing schema errors without an existing schema.',
    );
  });

  it('uses the last duplicate input object field value', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: {
                type: new GraphQLInputObjectType({
                  name: 'Input',
                  fields: {
                    value: { type: GraphQLInt },
                  },
                }),
              },
            },
          },
        },
      }),
    });
    const document = parse('{ field(input: { value: "bad", value: 1 }) }');

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [ValuesOfCorrectTypeASTVisitor],
        schema,
      }),
    ).toDeepEqual([]);
  });

  it('can hide suggestions in validations', () => {
    const schema = schemaWithQuery();
    const document = parse('{ filed }');

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [FieldsOnCorrectTypeASTVisitor],
        schema,
        hideSuggestions: true,
      }),
    ).toDeepEqual([
      {
        message: 'Cannot query field "filed" on type "Query".',
        locations: [{ line: 1, column: 3 }],
      },
    ]);
  });

  it('can limit document validation errors', () => {
    const schema = schemaWithQuery();
    const document = parse('{ missing other }');

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [FieldsOnCorrectTypeASTVisitor],
        schema,
        maxErrors: 1,
      }),
    ).toDeepEqual([
      {
        message: 'Cannot query field "missing" on type "Query".',
        locations: [{ line: 1, column: 3 }],
      },
      {
        message:
          'Too many validation errors, error limit reached. Validation aborted.',
      },
    ]);
  });

  it('can report existing schema errors through an empty document', () => {
    const EmptyEnum = new GraphQLEnumType({
      name: 'EmptyEnum',
      values: {},
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyEnum },
        },
      }),
    });
    const document: DocumentNode = { kind: Kind.DOCUMENT, definitions: [] };

    expectJSON(
      validateWithRules({
        documentAST: document,
        schema,
        includeExistingSchemaErrors: true,
      }),
    ).toDeepEqual([
      { message: 'Enum type EmptyEnum must define one or more values.' },
    ]);
  });
});

function schemaWithQuery(): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    }),
  });
}

function assumedValidSchema(): GraphQLSchema {
  return new GraphQLSchema({
    assumeValid: true,
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    }),
    types: [
      new GraphQLInputObjectType({
        name: 'Input',
        fields: {
          value: { type: GraphQLString },
        },
      }),
    ],
    directives: [
      new GraphQLDirective({
        name: 'tag',
        locations: [
          DirectiveLocation.FIELD_DEFINITION,
          DirectiveLocation.OBJECT,
        ],
      }),
    ],
  });
}
