import { describe, it } from 'node:test';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';

import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { UniqueDirectiveNamesTypeSystemValidation } from '../UniqueDirectiveNamesRule.ts';

import {
  expectSchemaErrors,
  expectSDLRuleErrors,
  schemaWithQuery,
} from './harness.ts';

describe('Validate: UniqueDirectiveNamesRule', () => {
  it('validates SDL directive names', () => {
    expectSDLRuleErrors(
      UniqueDirectiveNamesTypeSystemValidation,
      `
        directive @tag on OBJECT
        directive @tag on FIELD_DEFINITION
        type Query { field: String }
      `,
    ).toDeepEqual([
      { message: 'There can be only one directive named "@tag".' },
    ]);
  });

  it('rejects redefining existing schema directives', () => {
    expectSDLRuleErrors(
      UniqueDirectiveNamesTypeSystemValidation,
      'directive @tag on FIELD_DEFINITION',
      new GraphQLSchema({
        query: schemaWithQuery().getQueryType(),
        directives: [
          new GraphQLDirective({
            name: 'tag',
            locations: [DirectiveLocation.OBJECT],
          }),
        ],
      }),
    ).toDeepEqual([
      {
        message:
          'Directive "@tag" already exists in the schema. It cannot be redefined.',
      },
    ]);
  });

  it('validates schema directive names', () => {
    expectSchemaErrors(
      new GraphQLSchema({
        query: schemaWithQuery().getQueryType(),
        directives: [
          new GraphQLDirective({
            name: 'tag',
            locations: [DirectiveLocation.OBJECT],
          }),
          new GraphQLDirective({
            name: 'tag',
            locations: [DirectiveLocation.FIELD],
          }),
        ],
      }),
      UniqueDirectiveNamesTypeSystemValidation,
    ).toDeepEqual([
      { message: 'There can be only one directive named "@tag".' },
    ]);
  });
});
