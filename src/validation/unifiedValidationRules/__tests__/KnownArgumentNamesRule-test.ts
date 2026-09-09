import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { GraphQLError } from '../../../error/GraphQLError.ts';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';
import { visit } from '../../../language/visitor.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLInt, GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { KnownArgumentNamesASTVisitor } from '../KnownArgumentNamesRule.ts';

import {
  createRuleValidationContext,
  expectSDLRuleErrors,
  getSDLRuleVisitor,
  schemaWithQuery,
} from './harness.ts';

describe('Validate: KnownArgumentNamesRule', () => {
  it('validates SDL directive argument names', () => {
    expectSDLRuleErrors(
      KnownArgumentNamesASTVisitor,
      `
        directive @tag(arg: Int) on OBJECT
        type Query @tag(extra: 1) { field: String }
      `,
    ).toDeepEqual([
      { message: 'Unknown argument "extra" on directive "@tag".' },
    ]);
  });

  it('uses existing schema and the last duplicate SDL directive argument definition', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'tag',
          locations: [DirectiveLocation.OBJECT],
          args: { schemaArg: { type: GraphQLInt } },
        }),
      ],
    });

    expectSDLRuleErrors(
      KnownArgumentNamesASTVisitor,
      `
        extend type Query @tag(schemaArg: 1)

        directive @dup(a: Int) on OBJECT
        directive @dup(b: Int) on OBJECT

        type Local @dup(a: 1, b: 2) { field: String }
      `,
      schema,
    ).toDeepEqual([
      {
        message: 'Unknown argument "a" on directive "@dup". Did you mean "b"?',
      },
    ]);
  });

  it('uses later SDL directive arguments for earlier applications', () => {
    expectSDLRuleErrors(
      KnownArgumentNamesASTVisitor,
      `
        type Query @tag(arg: 1) {
          field: String
        }

        directive @tag(arg: Int) on OBJECT
      `,
    ).toDeepEqual([]);
  });

  it('validates executable field, fragment, and directive argument names', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              known: { type: GraphQLInt },
            },
          },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'tag',
          locations: [
            DirectiveLocation.QUERY,
            DirectiveLocation.VARIABLE_DEFINITION,
            DirectiveLocation.FIELD,
            DirectiveLocation.FRAGMENT_SPREAD,
            DirectiveLocation.INLINE_FRAGMENT,
            DirectiveLocation.FRAGMENT_DEFINITION,
          ],
          args: {
            known: { type: GraphQLInt },
          },
        }),
      ],
    });
    const doc = parse(
      `
        query Test($v: Int @tag(unknown: 1)) @tag(unknown: 1) {
          field(unknown: 1) @tag(unknown: 1)
          ...Frag(unknown: 1) @tag(unknown: 1)
          ... on Query @tag(unknown: 1) {
            field
          }
        }

        fragment Frag($known: Int) on Query @tag(unknown: 1) {
          field
        }
      `,
      { experimentalFragmentArguments: true, noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownArgumentNamesASTVisitor],
        schema,
        hideSuggestions: true,
      }),
    ).toDeepEqual([
      { message: 'Unknown argument "unknown" on directive "@tag".' },
      { message: 'Unknown argument "unknown" on directive "@tag".' },
      { message: 'Unknown argument "unknown" on directive "@tag".' },
      { message: 'Unknown argument "unknown" on field "Query.field".' },
      { message: 'Unknown argument "unknown" on directive "@tag".' },
      { message: 'Unknown argument "unknown" on fragment "Frag".' },
      { message: 'Unknown argument "unknown" on directive "@tag".' },
      { message: 'Unknown argument "unknown" on directive "@tag".' },
    ]);
  });

  it('reports unknown executable field and fragment arguments', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              known: { type: GraphQLInt },
            },
          },
        },
      }),
    });
    const doc = parse(
      `
        query {
          field(extra: 1)
          unknownField(unknownArg: 1)
          ...Frag(known: 1)
          ...Frag(extra: 1)
          ...Missing(extra: 1)
        }

        fragment Frag($known: Int) on Query {
          field
        }
      `,
      { experimentalFragmentArguments: true, noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownArgumentNamesASTVisitor],
        schema,
      }),
    ).toDeepEqual([
      {
        message: 'Unknown argument "extra" on field "Query.field".',
      },
      {
        message: 'Unknown argument "extra" on fragment "Frag".',
      },
    ]);
  });

  it('ignores SDL arguments on unknown directives', () => {
    expectSDLRuleErrors(
      KnownArgumentNamesASTVisitor,
      `
        directive @tag(arg: Int) on OBJECT
        type Query @missing(arg: 1) @tag { field: String }
      `,
    ).toDeepEqual([]);
  });

  it('rejects arguments on known directives without argument definitions', () => {
    expectSDLRuleErrors(
      KnownArgumentNamesASTVisitor,
      `
        directive @marker on OBJECT
        type Query @marker(extra: 1) { field: String }
      `,
    ).toDeepEqual([
      { message: 'Unknown argument "extra" on directive "@marker".' },
    ]);
  });

  it('ignores non-directive SDL arguments', () => {
    expectSDLRuleErrors(
      KnownArgumentNamesASTVisitor,
      `
        type Query {
          field(arg: Int): String
        }

        query {
          field(arg: 1)
        }
      `,
    ).toDeepEqual([]);
  });

  it('can hide SDL directive argument suggestions', () => {
    const misspelledKnown = ['k', 'n', 'w', 'o', 'n'].join('');
    const doc = parse(
      `
        directive @tag(known: Int) on OBJECT
        type Query @tag(${misspelledKnown}: 1) { field: String }
      `,
      { noLocation: true },
    );
    const errors: Array<GraphQLError> = [];
    const context = createRuleValidationContext(
      doc,
      undefined,
      (error) => {
        errors.push(error);
      },
      { hideSuggestions: true },
    );

    visit(doc, getSDLRuleVisitor(KnownArgumentNamesASTVisitor, context));

    expectJSON(errors).toDeepEqual([
      {
        message: `Unknown argument "${misspelledKnown}" on directive "@tag".`,
      },
    ]);
  });
});
