import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { PossibleDirectiveExtensionsTypeSystemValidation } from '../PossibleDirectiveExtensionsRule.ts';

import { expectSDLRuleErrors, schemaWithQuery } from './harness.ts';

describe('Validate: PossibleDirectiveExtensionsRule', () => {
  it('validates SDL directive extensions', () => {
    expectSDLRuleErrors(
      PossibleDirectiveExtensionsTypeSystemValidation,
      `
        directive @compose on DIRECTIVE_DEFINITION
        extend directive @missing @compose
        type Query { field: String }
      `,
    ).toDeepEqual([
      {
        message:
          'Cannot extend directive "@missing" because it is not defined.',
      },
    ]);
  });

  it('accepts directive extensions for local and existing directives', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'existing',
          locations: [DirectiveLocation.OBJECT],
        }),
      ],
    });

    expectSDLRuleErrors(
      PossibleDirectiveExtensionsTypeSystemValidation,
      `
        directive @compose on DIRECTIVE_DEFINITION
        directive @local on OBJECT

        extend directive @local @compose
        extend directive @existing @compose
      `,
      schema,
    ).toDeepEqual([]);
  });

  it('accepts directive extensions before local directive definitions', () => {
    expectSDLRuleErrors(
      PossibleDirectiveExtensionsTypeSystemValidation,
      `
        extend directive @local @compose

        directive @compose on DIRECTIVE_DEFINITION
        directive @local on OBJECT
      `,
    ).toDeepEqual([]);
  });

  it('suggests existing schema directives for unknown directive extensions', () => {
    const misspelledExisting = ['e', 'x', 'i', 's', 'i', 't', 'n', 'g'].join(
      '',
    );
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'existing',
          locations: [DirectiveLocation.OBJECT],
        }),
      ],
    });

    expectSDLRuleErrors(
      PossibleDirectiveExtensionsTypeSystemValidation,
      `extend directive @${misspelledExisting} @compose`,
      schema,
    ).toDeepEqual([
      {
        message: `Cannot extend directive "@${misspelledExisting}" because it is not defined. Did you mean "existing"?`,
      },
    ]);
  });

  it('can hide directive extension suggestions', () => {
    const misspelledExisting = ['e', 'x', 'i', 's', 'i', 't', 'n', 'g'].join(
      '',
    );
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'existing',
          locations: [DirectiveLocation.OBJECT],
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        documentAST: parse(`extend directive @${misspelledExisting} @compose`, {
          noLocation: true,
        }),
        typeSystemRules: [PossibleDirectiveExtensionsTypeSystemValidation],
        schema,
        hideSuggestions: true,
      }),
    ).toDeepEqual([
      {
        message: `Cannot extend directive "@${misspelledExisting}" because it is not defined.`,
      },
    ]);
  });
});
