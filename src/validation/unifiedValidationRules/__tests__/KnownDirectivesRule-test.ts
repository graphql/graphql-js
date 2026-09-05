import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { KnownDirectivesASTVisitor } from '../KnownDirectivesRule.ts';

import { expectSDLRuleErrors, schemaWithQuery } from './harness.ts';

describe('Validate: KnownDirectivesRule', () => {
  it('validates SDL directive definitions and locations', () => {
    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      'type Query @missing { field: String }',
    ).toDeepEqual([{ message: 'Unknown directive "@missing".' }]);
  });

  it('uses existing schema directive definitions', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'schemaDirective',
          locations: [DirectiveLocation.OBJECT],
        }),
      ],
    });

    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      'extend type Query @schemaDirective',
      schema,
    ).toDeepEqual([]);
  });

  it('uses the custom schema directive list as-is', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [],
    });

    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      'extend type Query { other: String @deprecated }',
      schema,
    ).toDeepEqual([{ message: 'Unknown directive "@deprecated".' }]);
  });

  it('accepts well placed executable directive locations', () => {
    const doc = parse(
      `
        directive @onQuery on QUERY
        directive @onMutation on MUTATION
        directive @onSubscription on SUBSCRIPTION
        directive @onField on FIELD
        directive @onFragmentDefinition on FRAGMENT_DEFINITION
        directive @onFragmentSpread on FRAGMENT_SPREAD
        directive @onInlineFragment on INLINE_FRAGMENT
        directive @onVariableDefinition on VARIABLE_DEFINITION
        directive @onFragmentVariableDefinition on FRAGMENT_VARIABLE_DEFINITION

        query ($var: Boolean @onVariableDefinition) @onQuery {
          field @onField
          ...Frag @onFragmentSpread
          ... @onInlineFragment {
            field @onField
          }
        }

        mutation @onMutation {
          field @onField
        }

        subscription @onSubscription {
          field @onField
        }

        fragment Frag(
          $arg: Int @onFragmentVariableDefinition
        ) on Query @onFragmentDefinition {
          field @onField
        }
      `,
      { noLocation: true, experimentalFragmentArguments: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownDirectivesASTVisitor],
      }),
    ).toDeepEqual([]);
  });

  it('does not treat type-system directives as executable directives', () => {
    const doc = parse(
      `
        directive @tag on OBJECT

        type Query @tag {
          field: String
        }

        query @tag {
          field
        }
      `,
      { noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownDirectivesASTVisitor],
      }),
    ).toDeepEqual([{ message: 'Directive "@tag" may not be used on QUERY.' }]);
  });

  it('accepts well placed type-system directive locations', () => {
    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      `
        directive @onSchema on SCHEMA
        directive @onScalar on SCALAR
        directive @onObject on OBJECT
        directive @onFieldDefinition on FIELD_DEFINITION
        directive @onArgumentDefinition on ARGUMENT_DEFINITION
        directive @onInterface on INTERFACE
        directive @onUnion on UNION
        directive @onEnum on ENUM
        directive @onEnumValue on ENUM_VALUE
        directive @onInputObject on INPUT_OBJECT
        directive @onInputFieldDefinition on INPUT_FIELD_DEFINITION
        directive @onDirectiveDefinition on DIRECTIVE_DEFINITION

        schema @onSchema {
          query: Query
        }
        extend schema @onSchema

        scalar MyScalar @onScalar
        extend scalar MyScalar @onScalar

        type Query @onObject {
          field(arg: Int @onArgumentDefinition): String @onFieldDefinition
        }
        extend type Query @onObject {
          another(arg: Int @onArgumentDefinition): String @onFieldDefinition
        }

        interface MyInterface @onInterface {
          field(arg: Int @onArgumentDefinition): String @onFieldDefinition
        }
        extend interface MyInterface @onInterface {
          another(arg: Int @onArgumentDefinition): String @onFieldDefinition
        }

        union MyUnion @onUnion = Query
        extend union MyUnion @onUnion

        enum MyEnum @onEnum {
          VALUE @onEnumValue
        }
        extend enum MyEnum @onEnum {
          OTHER @onEnumValue
        }

        input MyInput @onInputObject {
          field: Int @onInputFieldDefinition
        }
        extend input MyInput @onInputObject {
          another: Int @onInputFieldDefinition
        }

        directive @tag @onDirectiveDefinition on FIELD
        extend directive @tag @onDirectiveDefinition
      `,
    ).toDeepEqual([]);
  });

  it('uses the last duplicate local SDL directive definition locations', () => {
    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      `
        directive @tag on OBJECT
        directive @tag on FIELD_DEFINITION

        type Query @tag {
          field: String @tag
        }
      `,
    ).toDeepEqual([{ message: 'Directive "@tag" may not be used on OBJECT.' }]);
  });

  it('uses later SDL directive definitions for earlier applications', () => {
    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      `
        type Query @tag {
          field: String
        }

        directive @tag on OBJECT
      `,
    ).toDeepEqual([]);
  });

  it('rejects misplaced SDL directives', () => {
    expectSDLRuleErrors(
      KnownDirectivesASTVisitor,
      `
        directive @tag on FIELD_DEFINITION
        type Query @tag { field: String }
      `,
    ).toDeepEqual([{ message: 'Directive "@tag" may not be used on OBJECT.' }]);
  });
});
