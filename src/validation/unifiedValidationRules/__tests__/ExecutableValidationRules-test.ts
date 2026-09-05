import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { GraphQLError } from '../../../error/GraphQLError.ts';

import type { FieldNode, VariableNode } from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';
import type { ASTVisitFn } from '../../../language/visitor.ts';
import { visit } from '../../../language/visitor.ts';

import { isInterfaceType, isObjectType } from '../../../type/definition.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { visitWithIndexCursor } from '../../IndexCursor.ts';
import { validateWithRules } from '../../validateWithRules.ts';

import { DeferStreamDirectiveLabelASTVisitor } from '../DeferStreamDirectiveLabelRule.ts';
import { DeferStreamDirectiveOnRootFieldASTVisitor } from '../DeferStreamDirectiveOnRootFieldRule.ts';
import { DeferStreamDirectiveOnValidOperationsASTVisitor } from '../DeferStreamDirectiveOnValidOperationsRule.ts';
import { FieldsOnCorrectTypeASTVisitor as fieldsOnCorrectTypeASTVisitor } from '../FieldsOnCorrectTypeRule.ts';
import { FragmentsOnCompositeTypesASTVisitor } from '../FragmentsOnCompositeTypesRule.ts';
import { KnownArgumentNamesASTVisitor as knownArgumentNamesASTVisitor } from '../KnownArgumentNamesRule.ts';
import { KnownDirectivesASTVisitor } from '../KnownDirectivesRule.ts';
import { KnownOperationTypesASTVisitor } from '../KnownOperationTypesRule.ts';
import { KnownTypeNamesASTVisitor } from '../KnownTypeNamesRule.ts';
import { NoUndefinedVariablesASTVisitor as noUndefinedVariablesASTVisitor } from '../NoUndefinedVariablesRule.ts';
import { NoUnusedVariablesASTVisitor } from '../NoUnusedVariablesRule.ts';
import { OverlappingFieldsCanBeMergedASTVisitor } from '../OverlappingFieldsCanBeMergedRule.ts';
import { PossibleFragmentSpreadsASTVisitor } from '../PossibleFragmentSpreadsRule.ts';
import { ProvidedRequiredArgumentsASTVisitor } from '../ProvidedRequiredArgumentsRule.ts';
import { ScalarLeafsASTVisitor as scalarLeafsASTVisitor } from '../ScalarLeafsRule.ts';
import { SingleFieldSubscriptionsASTVisitor } from '../SingleFieldSubscriptionsRule.ts';
import { StreamDirectiveOnListFieldASTVisitor } from '../StreamDirectiveOnListFieldRule.ts';
import { ValuesOfCorrectTypeASTVisitor } from '../ValuesOfCorrectTypeRule.ts';
import { VariablesAreInputTypesASTVisitor } from '../VariablesAreInputTypesRule.ts';
import { VariablesInAllowedPositionASTVisitor } from '../VariablesInAllowedPositionRule.ts';

import { createRuleValidationContext } from './harness.ts';

interface FieldVisitor {
  readonly Field?: ASTVisitFn<FieldNode>;
}

function getFieldVisitor(visitor: FieldVisitor): ASTVisitFn<FieldNode> {
  const fieldVisitor = visitor.Field;
  if (typeof fieldVisitor !== 'function') {
    throw new Error('Expected field visitor.');
  }
  return fieldVisitor;
}

describe('Executable validations', () => {
  it('runs executable AST rules without a schema', () => {
    const document = parse(`
      query A {
        ...Missing
      }

      query A {
        field
      }

      fragment Unused on Query {
        field
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 1, column: 1 }],
      },
      {
        message: 'Unknown fragment "Missing".',
        locations: [{ line: 3, column: 12 }],
      },
      {
        message: 'There can be only one operation named "A".',
        locations: [
          { line: 2, column: 13 },
          { line: 6, column: 13 },
        ],
      },
      {
        message: 'Unknown type "Query".',
        locations: [{ line: 10, column: 26 }],
      },
      {
        message: 'Fragment "Unused" is never used.',
        locations: [{ line: 10, column: 7 }],
      },
    ]);
  });

  it('uses document type information for SDL-defined operation and input types', () => {
    const document = parse(`
      type Query {
        field: String
      }

      query UsesBad($bad: Query) {
        field
        ... on String {
          __typename
        }
        included: field @include(if: $bad)
      }

      mutation Unsupported {
        field
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
      }),
    ).toDeepEqual([
      {
        message: 'Variable "$bad" cannot be non-input type "Query".',
        locations: [{ line: 6, column: 27 }],
      },
      {
        message: 'Fragment cannot condition on non composite type "String".',
        locations: [{ line: 8, column: 16 }],
      },
      {
        message:
          'Variable "$bad" of type "Query" used in position expecting type "Boolean!".',
        locations: [
          { line: 6, column: 21 },
          { line: 11, column: 38 },
        ],
      },
      {
        message: 'The mutation operation is not supported by the schema.',
        locations: [{ line: 14, column: 7 }],
      },
    ]);
  });

  it('uses document type information for executable type checks without SDL', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    const document = parse(
      `
        query UsesBad($bad: Query) {
          ... on String {
            __typename
          }
          field
        }

        fragment Invalid on String {
          __typename
        }

        mutation Unsupported {
          field
        }
      `,
      { noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [
          KnownOperationTypesASTVisitor,
          VariablesAreInputTypesASTVisitor,
          FragmentsOnCompositeTypesASTVisitor,
        ],
        schema,
      }),
    ).toDeepEqual([
      { message: 'Variable "$bad" cannot be non-input type "Query".' },
      {
        message: 'Fragment cannot condition on non composite type "String".',
      },
      {
        message:
          'Fragment "Invalid" cannot condition on non composite type "String".',
      },
      {
        message: 'The mutation operation is not supported by the schema.',
      },
    ]);
  });

  it('checks executable type references with an existing schema', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: parse(
          'query ($var: Missing) { ... on Missing { field } }',
          {
            noLocation: true,
          },
        ),
        rules: [KnownTypeNamesASTVisitor],
        schema,
      }),
    ).toDeepEqual([
      { message: 'Unknown type "Missing".' },
      { message: 'Unknown type "Missing".' },
    ]);
  });

  it('runs type-aware executable rules when an existing schema is provided', () => {
    const schema = buildSchema(`
      type Query {
        field(required: Int!): String
      }
    `);

    const document = parse(`
      {
        missing
        field(required: "bad")
        other: field
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
        schema,
      }),
    ).toDeepEqual([
      {
        message: 'Cannot query field "missing" on type "Query".',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message: 'Int cannot represent non-integer value: "bad"',
        locations: [{ line: 4, column: 25 }],
      },
      {
        message:
          'Argument "Query.field(required:)" of type "Int!" is required, but it was not provided.',
        locations: [{ line: 5, column: 9 }],
      },
    ]);
  });

  it('checks executable input object field uniqueness with an existing schema', () => {
    const schema = buildSchema(`
      input Input {
        value: Int
      }

      type Query {
        field(input: Input): String
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: parse('{ field(input: { value: 1, value: 2 }) }', {
          noLocation: true,
        }),
        schema,
      }),
    ).toDeepEqual([
      { message: 'There can be only one input field named "value".' },
    ]);
  });

  it('runs type-aware executable rules when the schema is defined by SDL', () => {
    const document = parse(
      `
        interface Pet {
          name: String
        }

        type Dog implements Pet {
          name: String
          bark: String
        }

        type Cat implements Pet {
          name: String
        }

        input Input {
          int: Int
        }

        enum Color {
          RED
        }

        type Query {
          field(required: Int!, input: Input, color: Color): String
          dog: Dog
          pet: Pet
        }

        query ($v: String) {
          missing
          field(
            required: "bad"
            unknown: 1
            input: { int: "bad" }
            color: BLUE
          )
          other: field
          dog
          selected: field(required: 1) { sub }
          pet { bark }
          dog { ... on Cat { name } }
          variable: field(required: $v)
        }
      `,
      { noLocation: true },
    );

    expect(
      validateWithRules({
        documentAST: document,
        rules: [
          fieldsOnCorrectTypeASTVisitor,
          knownArgumentNamesASTVisitor,
          ProvidedRequiredArgumentsASTVisitor,
          ValuesOfCorrectTypeASTVisitor,
          scalarLeafsASTVisitor,
          PossibleFragmentSpreadsASTVisitor,
          VariablesInAllowedPositionASTVisitor,
        ],
      }).map((error) => error.message),
    ).to.deep.equal([
      'Cannot query field "missing" on type "Query".',
      'Int cannot represent non-integer value: "bad"',
      'Unknown argument "unknown" on field "Query.field".',
      'Int cannot represent non-integer value: "bad"',
      'Value "BLUE" does not exist in "Color" enum.',
      'Argument "Query.field(required:)" of type "Int!" is required, but it was not provided.',
      'Field "dog" of type "Dog" must have a selection of subfields. Did you mean "dog { ... }"?',
      'Field "field" must not have a selection since type "String" has no subfields.',
      'Cannot query field "bark" on type "Pet". Did you mean to use an inline fragment on "Dog"?',
      'Fragment cannot be spread here as objects of type "Dog" can never be of type "Cat".',
      'Variable "$v" of type "String" used in position expecting type "Int!".',
    ]);
  });

  it('runs type-aware executable rules against SDL extensions', () => {
    const schema = buildSchema(`
      type Query {
        existing: String
      }
    `);
    const document = parse(
      `
        extend type Query {
          added(required: Int!): String
        }

        query {
          existing
          added(required: "bad")
          missing
        }
      `,
      { noLocation: true },
    );

    expect(
      validateWithRules({
        documentAST: document,
        rules: [fieldsOnCorrectTypeASTVisitor, ValuesOfCorrectTypeASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Int cannot represent non-integer value: "bad"',
      'Cannot query field "missing" on type "Query". Did you mean "existing"?',
    ]);
  });

  it('runs executable directive validation with the default validations', () => {
    const schema = buildSchema(`
      directive @fieldOnly(arg: Int!) on FIELD

      type Query {
        field(arg: Int): String
      }
    `);

    expect(
      validateWithRules({
        documentAST: parse(`
          {
            field(arg: 1, arg: 2)
              @fieldOnly(bad: 1)
              @fieldOnly(arg: "bad")
              @fieldOnly(arg: 1, arg: 2)
              @unknown
              @deprecated
          }
        `),
        schema,
      }).map((error) => error.message),
    ).to.include.members([
      'Unknown directive "@unknown".',
      'Directive "@deprecated" may not be used on FIELD.',
      'The directive "@fieldOnly" can only be used once at this location.',
      'Unknown argument "bad" on directive "@fieldOnly".',
      'Int cannot represent non-integer value: "bad"',
      'Argument "@fieldOnly(arg:)" of type "Int!" is required, but it was not provided.',
      'There can be only one argument named "arg".',
    ]);
  });

  it('checks executable directive locations from document directive definitions', () => {
    const document = parse(
      `
        directive @onQuery on QUERY
        directive @onMutation on MUTATION
        directive @onSubscription on SUBSCRIPTION
        directive @onVariable on VARIABLE_DEFINITION
        directive @onFragmentVariable on FRAGMENT_VARIABLE_DEFINITION
        directive @onField(arg: Int) on FIELD

        type Query {
          field: String
        }

        type Mutation {
          field: String
        }

        type Subscription {
          field: String
        }

        query ($var: Boolean @onVariable) @onQuery {
          field @onField(agr: 1)
        }

        mutation @onMutation {
          field
        }

        subscription @onSubscription {
          field
        }

        fragment Frag(
          $arg: Int @onFragmentVariable
        ) on Query {
          field
        }
      `,
      { experimentalFragmentArguments: true, noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [KnownDirectivesASTVisitor, knownArgumentNamesASTVisitor],
      }),
    ).toDeepEqual([
      {
        message:
          'Unknown argument "agr" on directive "@onField". Did you mean "arg"?',
      },
    ]);
  });

  it('does not duplicate directive argument validation from type-system validations', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    const document = parse(`
      {
        field @include(unless: true)
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
        schema,
      }),
    ).toDeepEqual([
      {
        message: 'Unknown argument "unless" on directive "@include".',
        locations: [{ line: 3, column: 24 }],
      },
      {
        message:
          'Argument "@include(if:)" of type "Boolean!" is required, but it was not provided.',
        locations: [{ line: 3, column: 15 }],
      },
    ]);
  });

  it('does not duplicate input object field uniqueness from type-system validations', () => {
    const document = parse(`
      input Input {
        value: Int
      }

      type Query {
        field(input: Input): String
      }

      {
        field(input: { value: 1, value: 2 })
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
      }),
    ).toDeepEqual([
      {
        message: 'There can be only one input field named "value".',
        locations: [
          { line: 11, column: 24 },
          { line: 11, column: 34 },
        ],
      },
    ]);
  });

  it('does not duplicate known type names from type-system validations', () => {
    const document = parse(`
      type Query {
        field: String
      }

      query ($var: Missing) {
        ... on Missing {
          field
        }
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
      }),
    ).toDeepEqual([
      {
        message: 'Variable "$var" is never used.',
        locations: [{ line: 6, column: 14 }],
      },
      {
        message: 'Unknown type "Missing".',
        locations: [{ line: 6, column: 20 }],
      },
      {
        message: 'Unknown type "Missing".',
        locations: [{ line: 7, column: 16 }],
      },
    ]);
  });

  it('checks required executable directive arguments from document directive definitions', () => {
    const document = parse(
      `
        directive @field(
          required: Int!
          invalid: Query!
        ) on FIELD

        type Query {
          field: String
        }

        query {
          field @field
        }
      `,
      { noLocation: true },
    );

    expect(
      validateWithRules({
        documentAST: document,
        rules: [ProvidedRequiredArgumentsASTVisitor],
      }).map((error) => error.message),
    ).to.deep.equal([
      'Argument "@field(required:)" of type "Int!" is required, but it was not provided.',
    ]);
  });

  it('ignores missing required SDL field arguments with invalid input types', () => {
    const document = parse(`
      type Query {
        field(required: Missing!): String
      }

      query {
        field
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [ProvidedRequiredArgumentsASTVisitor],
      }),
    ).toDeepEqual([]);
  });

  it('checks field and fragment argument names through executable rules', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: Int): String
      }
    `);

    const document = parse(
      `
        query {
          field(unknown: 1)
          ...Frag(unknown: 1)
        }

        fragment Frag($required: Int!, $known: Int) on Query {
          field(arg: $known)
        }
      `,
      { experimentalFragmentArguments: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [
          knownArgumentNamesASTVisitor,
          ProvidedRequiredArgumentsASTVisitor,
        ],
        schema,
      }),
    ).toDeepEqual([
      {
        message: 'Unknown argument "unknown" on field "Query.field".',
        locations: [{ line: 3, column: 17 }],
      },
      {
        message:
          'Unknown argument "unknown" on fragment "Frag". Did you mean "known"?',
        locations: [{ line: 4, column: 19 }],
      },
      {
        message:
          'Fragment "Frag" argument "required" of type "Int!" is required, but it was not provided.',
        locations: [{ line: 4, column: 11 }],
      },
    ]);

    expect(
      validateWithRules({
        documentAST: parse(
          `
            query {
              ...NeedsArg
            }

            fragment NeedsArg($required: Int!) on Query {
              field
            }
          `,
          { experimentalFragmentArguments: true, noLocation: true },
        ),
        rules: [ProvidedRequiredArgumentsASTVisitor],
      }).map((error) => error.message),
    ).to.deep.equal([
      'Fragment "NeedsArg" argument "required" of type "Int!" is required, but it was not provided.',
    ]);
  });

  it('ignores fragment arguments that are known or have no signature', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    const document = parse(
      `
        query {
          ...Known(known: 1)
          ...Missing(unknown: 1)
        }

        fragment Known($known: Int) on Query {
          field
        }
      `,
      { experimentalFragmentArguments: true, noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [
          knownArgumentNamesASTVisitor,
          ProvidedRequiredArgumentsASTVisitor,
        ],
        schema,
      }),
    ).toDeepEqual([]);
  });

  it('can hide executable argument suggestions', () => {
    const schema = buildSchema(`
      type Query {
        field(known: Int): String
      }
    `);
    const misspelledKnown = ['k', 'n', 'w', 'o', 'n'].join('');
    const document = parse(
      `
        directive @tag(known: Int) on FIELD

        query {
          field(unknown: 1) @tag(${misspelledKnown}: 1)
          ...Frag(unknown: 1)
        }

        fragment Frag($known: Int) on Query {
          field
        }
      `,
      { experimentalFragmentArguments: true, noLocation: true },
    );
    const errors: Array<GraphQLError> = [];
    const context = createRuleValidationContext(
      document,
      schema,
      (error) => {
        errors.push(error);
      },
      { hideSuggestions: true },
    );
    const indexCursor = context.indexCursor;

    visit(
      document,
      visitWithIndexCursor(indexCursor, knownArgumentNamesASTVisitor(context)),
    );

    expectJSON(errors).toDeepEqual([
      { message: `Unknown argument "${misspelledKnown}" on directive "@tag".` },
      { message: 'Unknown argument "unknown" on field "Query.field".' },
      { message: 'Unknown argument "unknown" on fragment "Frag".' },
    ]);
  });

  it('checks executable value literal kinds through the value rule', () => {
    const schema = buildSchema(`
      enum Color {
        RED
      }

      input Input {
        value: Int
      }

      type Query {
        field: String
      }
    `);

    const document = parse(`
      query (
        $nullValue: Int! = null
        $listValue: [Int] = [1, "bad"]
        $objectValue: Input = { value: "bad" }
        $enumValue: Color = BLUE
        $intValue: Int = 1.2
        $stringValue: String = 1
        $booleanValue: Boolean = "bad"
      ) {
        field
      }
    `);

    const errors = validateWithRules({
      documentAST: document,
      rules: [ValuesOfCorrectTypeASTVisitor],
      schema,
    });

    expect(errors.map((error) => error.message)).to.include.members([
      'Expected value of non-null type "Int!" not to be null.',
      'Int cannot represent non-integer value: "bad"',
      'Value "BLUE" does not exist in "Color" enum.',
      'Int cannot represent non-integer value: 1.2',
      'String cannot represent a non string value: 1',
      'Boolean cannot represent a non boolean value: "bad"',
    ]);
  });

  it('checks fragment type conditions through document type information', () => {
    const document = parse(`
      type Query {
        field: String
      }

      fragment Valid on Query {
        field
      }

      fragment Invalid on String {
        __typename
      }

      query {
        ... on Query {
          field
        }
        ... on Missing {
          __typename
        }
        ... {
          field
        }
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: document,
        rules: [FragmentsOnCompositeTypesASTVisitor],
      }),
    ).toDeepEqual([
      {
        message:
          'Fragment "Invalid" cannot condition on non composite type "String".',
        locations: [{ line: 10, column: 27 }],
      },
    ]);
  });

  it('checks defer and stream directive labels', () => {
    const document = parse(`
      {
        field @include(if: true)
        a: field @defer
        b: field @stream(label: null)
        c: field @defer(label: 1)
        d: field @stream(label: "same")
        e: field @defer(label: "same")
      }
    `);

    expect(
      validateWithRules({
        documentAST: document,
        rules: [DeferStreamDirectiveLabelASTVisitor],
      }).map((error) => error.message),
    ).to.deep.equal([
      'Argument "@defer(label:)" must be a static string.',
      'Value for arguments "defer(label:)" and "stream(label:)" must be unique across all Defer/Stream directive usages.',
    ]);
  });

  it('checks defer and stream labels on operation directives', () => {
    const document = parse(`
      query @defer(label: "same") {
        field
      }

      mutation @stream(label: "same") {
        field
      }

      subscription @defer(label: 1) {
        field
      }
    `);

    expect(
      validateWithRules({
        documentAST: document,
        rules: [DeferStreamDirectiveLabelASTVisitor],
      }).map((error) => error.message),
    ).to.deep.equal([
      'Value for arguments "defer(label:)" and "stream(label:)" must be unique across all Defer/Stream directive usages.',
      'Argument "@defer(label:)" must be a static string.',
    ]);
  });

  it('checks defer and stream on root fields', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }

      type Mutation {
        field: String
      }
    `);
    const document = parse(`
      query {
        field
      }

      mutation {
        field @stream
        ...Frag @defer
        ...Frag @defer
        ...Missing @defer
        ... @defer {
          field
        }
      }

      fragment Frag on Mutation {
        field
      }
    `);

    expect(
      validateWithRules({
        documentAST: document,
        rules: [DeferStreamDirectiveOnRootFieldASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Stream directive cannot be used on root mutation type "Mutation".',
      'Defer directive cannot be used on root mutation type "Mutation".',
      'Defer directive cannot be used on root mutation type "Mutation".',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('mutation { field }'),
        rules: [DeferStreamDirectiveOnRootFieldASTVisitor],
        schema: buildSchema('type Query { field: String }'),
      }),
    ).to.deep.equal([]);
  });

  it('checks defer and stream on subscription operations', () => {
    const document = parse(`
      query {
        field
      }

      subscription ($enabled: Boolean) {
        skipped @skip
        alsoSkipped @skip(if: true)
        missingInclude @include @defer
        included @include(if: true) @defer
        notIncluded @include(if: false) @defer
        variableDefer @defer(if: $enabled)
        falseDefer @defer(if: false)
        trueDefer @defer(if: true)
        badDefer @defer(if: 1)
        streamField @stream
        streamVariable @stream(if: $enabled)
        group {
          nested @stream
        }
        ...Frag
        ...Frag
        ...Missing
      }

      fragment Frag on Query {
        nested @stream
      }
    `);

    expect(
      validateWithRules({
        documentAST: document,
        rules: [DeferStreamDirectiveOnValidOperationsASTVisitor],
      }).map((error) => error.message),
    ).to.deep.equal([
      'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
      'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
      'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
    ]);
  });

  it('checks fields on correct type through document type information', () => {
    const schema = buildSchema(`
      interface Pet {
        name: String
      }

      interface CanBark {
        barkVolume: Int
      }

      type Dog implements Pet & CanBark {
        name: String
        barkVolume: Int
      }

      type Wolf implements Pet & CanBark {
        name: String
        barkVolume: Int
      }

      type Cat implements Pet {
        name: String
      }

      union Search = Dog | Wolf | Cat

      type Query {
        pet: Pet
        dog: Dog
        search: Search
      }
    `);

    const messages = validateWithRules({
      documentAST: parse(`
        {
          pet {
            barkVolume
          }
          dog {
            nam
          }
          search {
            unknown
          }
        }
      `),
      rules: [fieldsOnCorrectTypeASTVisitor],
      schema,
    }).map((error) => error.message);

    expect(messages).to.deep.equal([
      'Cannot query field "barkVolume" on type "Pet". Did you mean to use an inline fragment on "CanBark", "Dog", or "Wolf"?',
      'Cannot query field "nam" on type "Dog". Did you mean "name"?',
      'Cannot query field "unknown" on type "Search".',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('{ field }'),
        rules: [fieldsOnCorrectTypeASTVisitor],
      }),
    ).to.deep.equal([]);
  });

  it('orders field suggestion super types before subtypes in either comparator direction', () => {
    const schema = buildSchema(`
      interface Named {
        nickname: String
      }

      interface Pet {
        name: String
      }

      type Dog implements Named {
        nickname: String
      }

      type Query {
        pet: Pet
      }
    `);
    const dog = schema.getType('Dog');
    const named = schema.getType('Named');
    const pet = schema.getType('Pet');
    const field = parse('{ nickname }').definitions[0];
    if (
      !isObjectType(dog) ||
      !isInterfaceType(named) ||
      !isInterfaceType(pet) ||
      field.kind !== 'OperationDefinition' ||
      field.selectionSet.selections[0].kind !== 'Field'
    ) {
      throw new Error('Expected test schema and field.');
    }
    const fieldNode = field.selectionSet.selections[0];

    function messagesForPossibleTypes(
      possibleTypes: ReadonlyArray<{ readonly name: string }>,
    ): ReadonlyArray<string> {
      const errors: Array<GraphQLError> = [];
      const rule = fieldsOnCorrectTypeASTVisitor({
        hideSuggestions: false,
        index: {
          getSuggestedTypeNames: () => possibleTypes.map((type) => type.name),
          getSuggestedFieldNames: () => [],
          typeToString: () => 'Pet',
        },
        indexCursor: {
          getCurrentParentType: () => pet,
          getCurrentFieldDef: () => undefined,
        } as unknown as Parameters<
          typeof fieldsOnCorrectTypeASTVisitor
        >[0]['indexCursor'],
        reportError: (error: GraphQLError) => {
          errors.push(error);
        },
      } as unknown as Parameters<typeof fieldsOnCorrectTypeASTVisitor>[0]);
      const fieldVisitor = getFieldVisitor(rule as FieldVisitor);

      fieldVisitor(fieldNode, undefined, undefined, [], []);
      return errors.map((error) => error.message);
    }

    expect(messagesForPossibleTypes([dog, named])).to.deep.equal([
      'Cannot query field "nickname" on type "Pet". Did you mean to use an inline fragment on "Dog" or "Named"?',
    ]);

    function messagesForFieldContext({
      fieldSource,
      hideSuggestions,
      suggestedFieldNames = [],
    }: {
      fieldSource: string;
      hideSuggestions: boolean;
      suggestedFieldNames?: ReadonlyArray<string>;
    }): ReadonlyArray<string> {
      const fieldDocument = parse(fieldSource);
      const operation = fieldDocument.definitions[0];
      if (
        operation.kind !== 'OperationDefinition' ||
        operation.selectionSet.selections[0].kind !== 'Field'
      ) {
        throw new Error('Expected operation field.');
      }
      const errors: Array<GraphQLError> = [];
      const rule = fieldsOnCorrectTypeASTVisitor({
        hideSuggestions,
        index: {
          getSuggestedTypeNames: () => [],
          getSuggestedFieldNames: () => suggestedFieldNames,
          typeToString: () => 'Dog',
        },
        indexCursor: {
          getCurrentParentType: () => dog,
          getCurrentFieldDef: () => undefined,
        } as unknown as Parameters<
          typeof fieldsOnCorrectTypeASTVisitor
        >[0]['indexCursor'],
        reportError: (error: GraphQLError) => {
          errors.push(error);
        },
      } as unknown as Parameters<typeof fieldsOnCorrectTypeASTVisitor>[0]);
      const fieldVisitor = getFieldVisitor(rule as FieldVisitor);

      fieldVisitor(
        operation.selectionSet.selections[0],
        undefined,
        undefined,
        [],
        [],
      );
      return errors.map((error) => error.message);
    }

    expect(
      messagesForFieldContext({
        fieldSource: '{ nickname }',
        hideSuggestions: true,
        suggestedFieldNames: ['nickname'],
      }),
    ).to.deep.equal(['Cannot query field "nickname" on type "Dog".']);
    expect(
      messagesForFieldContext({
        fieldSource: '{ unknown }',
        hideSuggestions: false,
      }),
    ).to.deep.equal(['Cannot query field "unknown" on type "Dog".']);
  });

  it('checks scalar leaf selections through document type information', () => {
    const schema = buildSchema(`
      type Query {
        scalar: String
        object: Query
      }
    `);

    expect(
      validateWithRules({
        documentAST: parse(`
          {
            scalar {
              field
            }
            object
          }
        `),
        rules: [scalarLeafsASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Field "scalar" must not have a selection since type "String" has no subfields.',
      'Field "object" of type "Query" must have a selection of subfields. Did you mean "object { ... }"?',
    ]);

    const document = parse('{ object { __typename } }');
    const field = document.definitions[0];
    if (field.kind !== 'OperationDefinition') {
      throw new Error('Expected operation.');
    }
    const objectField = field.selectionSet.selections[0];
    if (objectField.kind !== 'Field' || objectField.selectionSet == null) {
      throw new Error('Expected field with selection set.');
    }
    const emptySelectionField = {
      ...objectField,
      selectionSet: { ...objectField.selectionSet, selections: [] },
    };
    const errors: Array<GraphQLError> = [];
    const context = createRuleValidationContext(document, schema, (error) => {
      errors.push(error);
    });
    const indexCursor = context.indexCursor;

    const scalarLeafsVisitor = scalarLeafsASTVisitor(context);
    const scalarLeafsFieldVisitor = getFieldVisitor(
      scalarLeafsVisitor as FieldVisitor,
    );
    visit(
      { ...document, definitions: [field] },
      visitWithIndexCursor(indexCursor, {
        Field(node) {
          if (node === objectField) {
            scalarLeafsFieldVisitor(
              emptySelectionField,
              undefined,
              undefined,
              [],
              [],
            );
          }
        },
      }),
    );

    expect(errors.map((error) => error.message)).to.deep.equal([
      'Field "object" of type "Query" must have at least one field selected.',
    ]);
  });

  it('checks variable definition and usage validations', () => {
    const schema = buildSchema(`
      input Choice @oneOf {
        value: Int
      }

      type Query {
        field(arg: Int!, optional: Int = 1, choice: Choice): String
      }
    `);

    expect(
      validateWithRules({
        documentAST: parse(
          `
          query Named($unused: Int, $wrong: String, $nullableChoice: Int) {
            field(arg: $wrong, optional: $nullableChoice, choice: { value: $nullableChoice })
            ...Frag(defined: $wrong)
          }

          fragment Frag($defined: String, $unusedFrag: Int) on Query {
            field(arg: $defined)
          }
        `,
          { experimentalFragmentArguments: true },
        ),
        rules: [
          noUndefinedVariablesASTVisitor,
          NoUnusedVariablesASTVisitor,
          VariablesInAllowedPositionASTVisitor,
        ],
        schema,
      }).map((error) => error.message),
    ).to.include.members([
      'Variable "$unusedFrag" is never used in fragment "Frag".',
      'Variable "$unused" is never used in operation "Named".',
      'Variable "$wrong" of type "String" used in position expecting type "Int!".',
      'Variable "$nullableChoice" is of type "Int" but must be non-nullable to be used for OneOf Input Object "Choice".',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('{ field(arg: $missing) }'),
        rules: [noUndefinedVariablesASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal(['Variable "$missing" is not defined.']);

    expect(
      validateWithRules({
        documentAST: parse('query Named($id: Int) { field(arg: $missing) }'),
        rules: [noUndefinedVariablesASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Variable "$missing" is not defined by operation "Named".',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('query { field }'),
        rules: [
          NoUnusedVariablesASTVisitor,
          VariablesInAllowedPositionASTVisitor,
        ],
      }),
    ).to.deep.equal([]);

    expect(
      validateWithRules({
        documentAST: parse('fragment Empty on Query { field }'),
        rules: [NoUnusedVariablesASTVisitor],
      }),
    ).to.deep.equal([]);

    const context = createRuleValidationContext(
      parse('{ field }'),
      schema,
      () => {
        throw new Error('Unexpected validation error.');
      },
    );
    const visitor = noUndefinedVariablesASTVisitor(context);
    const visitVariable = (visitor as { Variable?: ASTVisitFn<VariableNode> })
      .Variable;
    if (typeof visitVariable !== 'function') {
      throw new Error('Expected variable visitor.');
    }
    expect(
      visitVariable(
        {
          kind: Kind.VARIABLE,
          name: { kind: Kind.NAME, value: 'outsideScope' },
        },
        undefined,
        undefined,
        [],
        [],
      ),
    ).to.equal(undefined);

    expect(
      validateWithRules({
        documentAST: parse('query ($unused: Int) { field }'),
        rules: [NoUnusedVariablesASTVisitor],
      }).map((error) => error.message),
    ).to.deep.equal(['Variable "$unused" is never used.']);

    expect(
      validateWithRules({
        documentAST: parse('{ field(arg: $missing) }'),
        rules: [VariablesInAllowedPositionASTVisitor],
        schema,
      }),
    ).to.deep.equal([]);

    expect(
      validateWithRules({
        documentAST: parse(`
          query ($withDefault: Int = 1, $usesLocationDefault: Int) {
            field(arg: $withDefault, defaulted: $usesLocationDefault)
          }
        `),
        rules: [VariablesInAllowedPositionASTVisitor],
        schema: buildSchema(`
          type Query {
            field(arg: Int!, defaulted: Int! = 1): String
          }
        `),
      }),
    ).to.deep.equal([]);

    expect(
      validateWithRules({
        documentAST: parse('query ($id: Int) { field }'),
        rules: [VariablesInAllowedPositionASTVisitor],
      }),
    ).to.deep.equal([]);
  });

  it('checks possible fragment spreads through document type information', () => {
    const schema = buildSchema(`
      type Dog {
        bark: String
      }

      type Cat {
        meow: String
      }

      type Query {
        dog: Dog
      }
    `);

    expect(
      validateWithRules({
        documentAST: parse(`
          {
            dog {
              ... on Cat {
                meow
              }
              ...CatFields
              ...Missing
              ...ScalarFields
            }
          }

          fragment CatFields on Cat {
            meow
          }

          fragment ScalarFields on String {
            length
          }
        `),
        rules: [PossibleFragmentSpreadsASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Fragment cannot be spread here as objects of type "Dog" can never be of type "Cat".',
      'Fragment "CatFields" cannot be spread here as objects of type "Dog" can never be of type "Cat".',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('{ field }'),
        rules: [PossibleFragmentSpreadsASTVisitor],
      }),
    ).to.deep.equal([]);
  });

  it('checks subscription single-field and stream-on-list rules', () => {
    const schema = buildSchema(`
      type Query {
        field: String
        list: [String]
      }

      type Subscription {
        a: String
        b: String
        list: [String]
      }
    `);

    expect(
      validateWithRules({
        documentAST: parse(`
          subscription Named {
            a @skip(if: false)
          }

          subscription Multi {
            a
            b
          }

          subscription Introspection {
            __typename
          }

          subscription {
            __typename
          }

          subscription FromFragment {
            ...SubFields
          }

          fragment SubFields on Subscription {
            a
          }
        `),
        rules: [SingleFieldSubscriptionsASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Subscription "Named" must not use `@skip` or `@include` directives in the top level selection.',
      'Subscription "Multi" must select only one top level field.',
      'Subscription "Introspection" must not select an introspection top level field.',
      'Anonymous Subscription must not select an introspection top level field.',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('subscription { a }'),
        rules: [SingleFieldSubscriptionsASTVisitor],
      }),
    ).to.deep.equal([]);

    expect(
      validateWithRules({
        documentAST: parse('subscription { a @include(if: true) }'),
        rules: [SingleFieldSubscriptionsASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Anonymous Subscription must not use `@skip` or `@include` directives in the top level selection.',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('subscription { a b }'),
        rules: [SingleFieldSubscriptionsASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Anonymous Subscription must select only one top level field.',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('{ field }'),
        rules: [SingleFieldSubscriptionsASTVisitor],
      }),
    ).to.deep.equal([]);

    expect(
      validateWithRules({
        documentAST: parse('subscription { a }'),
        rules: [SingleFieldSubscriptionsASTVisitor],
        schema: buildSchema(`
          type Query {
            field: String
          }
        `),
      }),
    ).to.deep.equal([]);

    expect(
      validateWithRules({
        documentAST: parse(`
          {
            a: field @stream
            list @stream
            wrappedList @stream
            missing @stream
            field @include(if: true)
          }
        `),
        rules: [StreamDirectiveOnListFieldASTVisitor],
        schema: buildSchema(`
          type Query {
            field: String
            list: [String]
            wrappedList: [String]!
          }
        `),
      }).map((error) => error.message),
    ).to.deep.equal([
      'Directive "@stream" cannot be used on non-list field "Query.field".',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('{ field @stream }'),
        rules: [StreamDirectiveOnListFieldASTVisitor],
      }),
    ).to.deep.equal([]);
  });

  it('checks overlapping fields through the validation bridge', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: Int): String
      }
    `);

    expect(
      validateWithRules({
        documentAST: parse(`
          {
            conflict: field(arg: 1)
            conflict: field(arg: 2)
          }
        `),
        rules: [OverlappingFieldsCanBeMergedASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.deep.equal([
      'Fields "conflict" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
    ]);

    expect(
      validateWithRules({
        documentAST: parse(
          `
            {
              ...A
              ...B
              ...ArgField(arg: 1)
              ...ArgField(arg: 2)
            }

            fragment A on Query {
              conflict: field(arg: 1)
            }

            fragment B on Query {
              conflict: field(arg: 2)
            }

            fragment ArgField($arg: Int) on Query {
              field(arg: $arg)
            }
          `,
          { experimentalFragmentArguments: true },
        ),
        rules: [OverlappingFieldsCanBeMergedASTVisitor],
        schema,
      }).map((error) => error.message),
    ).to.include.members([
      'Fields "conflict" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
      'Spreads "ArgField" conflict because ArgField(arg: 1) and ArgField(arg: 2) have different fragment arguments.',
    ]);

    expect(
      validateWithRules({
        documentAST: parse('{ field }'),
        rules: [OverlappingFieldsCanBeMergedASTVisitor],
      }),
    ).to.deep.equal([]);
  });
});
