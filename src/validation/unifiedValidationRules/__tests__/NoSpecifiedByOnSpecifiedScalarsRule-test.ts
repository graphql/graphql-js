import { describe, it } from 'node:test';

import { GraphQLScalarType } from '../../../type/definition.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation } from '../NoSpecifiedByOnSpecifiedScalarsRule.ts';

import {
  expectSchemaErrors,
  expectSDLRuleErrors,
  schemaWithQuery,
} from './harness.ts';

describe('Validate: NoSpecifiedByOnSpecifiedScalarsRule', () => {
  it('validates SDL @specifiedBy on specified scalars', () => {
    expectSDLRuleErrors(
      NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation,
      'extend scalar String @specifiedBy(url: "https://example.com")',
    ).toDeepEqual([
      {
        message:
          'Directive "@specifiedBy" must not be used on built-in scalar type "String".',
      },
    ]);

    expectSDLRuleErrors(
      NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation,
      'extend scalar String @specifiedBy(url: "https://example.com")',
      schemaWithQuery(),
    ).toDeepEqual([
      {
        message:
          'Directive "@specifiedBy" must not be used on built-in scalar type "String".',
      },
    ]);
  });

  it('ignores SDL @specifiedBy on non-specified scalars', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      types: [new GraphQLScalarType({ name: 'DateTime' })],
    });

    expectSDLRuleErrors(
      NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation,
      'scalar DateTime @specifiedBy(url: "https://example.com")',
      schemaWithQuery(),
    ).toDeepEqual([]);
    expectSDLRuleErrors(
      NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation,
      'extend scalar DateTime @specifiedBy(url: "https://example.com")',
      schema,
    ).toDeepEqual([]);
  });

  it('ignores SDL specified scalars without @specifiedBy', () => {
    expectSDLRuleErrors(
      NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation,
      `
        scalar String
        scalar String @other
        extend scalar String @other
      `,
      schemaWithQuery(),
    ).toDeepEqual([]);
  });

  it('validates schema @specifiedBy on specified scalars', () => {
    const customDateTime = new GraphQLScalarType({
      name: 'DateTime',
      specifiedByURL: 'https://example.com/date-time',
    });
    const customString = new GraphQLScalarType({
      name: 'String',
      specifiedByURL: 'https://example.com',
    });
    const schema = schemaWithQuery();
    schema.getTypeMap().DateTime = customDateTime;
    schema.getTypeMap().String = customString;

    expectSchemaErrors(
      schema,
      NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation,
    ).toDeepEqual([
      {
        message:
          'Directive "@specifiedBy" must not be used on built-in scalar type "String".',
      },
    ]);
  });
});
