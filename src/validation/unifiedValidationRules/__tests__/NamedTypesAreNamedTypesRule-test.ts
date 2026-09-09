import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLDirective } from '../../../type/directives.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../validateWithRules.ts';

import { NamedTypesAreNamedTypesTypeSystemValidation } from '../NamedTypesAreNamedTypesRule.ts';

import { expectSDLRuleErrors, schemaWithQuery } from './harness.ts';

describe('Validate: NamedTypesAreNamedTypesRule', () => {
  it('ignores documents without an existing schema', () => {
    expectSDLRuleErrors(
      NamedTypesAreNamedTypesTypeSystemValidation,
      'type Query { field: String }',
    ).toDeepEqual([]);
  });

  it('rejects schema type-map entries that are not named types', () => {
    const schema = schemaWithQuery();
    const invalidType = { name: 'SomeType' };
    const directiveAstNode = parse('directive @SomeDirective on QUERY')
      .definitions[0];
    if (directiveAstNode.kind !== Kind.DIRECTIVE_DEFINITION) {
      throw new Error('Expected directive definition.');
    }
    const invalidDirective = new GraphQLDirective({
      name: 'SomeDirective',
      locations: [DirectiveLocation.QUERY],
      astNode: directiveAstNode,
    });

    schema.getTypeMap = () =>
      ({
        Query: schema.getQueryType(),
        SomeType: invalidType,
        SomeDirective: invalidDirective,
      }) as unknown as ReturnType<GraphQLSchema['getTypeMap']>;

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NamedTypesAreNamedTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Expected GraphQL named type but got: { name: "SomeType" }.',
      },
      {
        message: 'Expected GraphQL named type but got: @SomeDirective.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });
});
