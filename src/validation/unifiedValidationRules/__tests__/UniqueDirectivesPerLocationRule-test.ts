import { describe, it } from 'node:test';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import type { SchemaDirectiveUsageRecord } from '../../TypeSystemValidationIndex.ts';

import {
  UniqueDirectivesPerLocationASTVisitor,
  UniqueDirectivesPerLocationTypeSystemValidation,
} from '../UniqueDirectivesPerLocationRule.ts';

import {
  expectSchemaErrors,
  expectSDLRuleErrors,
  schemaWithQuery,
} from './harness.ts';

describe('Validate: UniqueDirectivesPerLocationRule', () => {
  it('validates SDL directives per location', () => {
    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        directive @schemaTag on SCHEMA

        schema @schemaTag @schemaTag {
          query: Query
        }

        type Query {
          field: String @deprecated @deprecated
        }
      `,
    ).toDeepEqual([
      {
        message:
          'The directive "@schemaTag" can only be used once at this location.',
      },
      {
        message:
          'The directive "@deprecated" can only be used once at this location.',
      },
    ]);
  });

  it('ignores unknown and repeatable SDL directives', () => {
    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        directive @repeatable repeatable on OBJECT

        type Local @unknown @unknown @repeatable @repeatable {
          field: String
        }
      `,
    ).toDeepEqual([]);
  });

  it('uses later SDL directive definitions when checking repeatability', () => {
    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        type Query @tag @tag {
          field: String
        }

        directive @tag on OBJECT
      `,
    ).toDeepEqual([
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
    ]);
  });

  it('validates executable directives per location', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
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
        }),
      ],
    });

    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        query Test($value: String @tag @tag) @tag @tag {
          field @tag @tag
          field
          ...Frag @tag @tag
          ... on Query @tag @tag {
            field
          }
        }

        fragment Frag on Query @tag @tag {
          field
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
      {
        message: 'The directive "@tag" can only be used once at this location.',
      },
    ]);
  });

  it('uses specified directives from an existing schema', () => {
    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      'extend type Query { field: String @deprecated @deprecated }',
      schemaWithQuery(),
    ).toDeepEqual([
      {
        message:
          'The directive "@deprecated" can only be used once at this location.',
      },
    ]);
  });

  it('uses intrinsic specified directives from existing schema elements', () => {
    const Url = new GraphQLScalarType({
      name: 'Url',
      specifiedByURL: 'https://example.com/url',
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      isOneOf: true,
      fields: {
        value: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      types: [Url, Input],
    });

    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        extend scalar Url @specifiedBy(url: "https://example.com/other")
        extend input Input @oneOf
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'The directive "@specifiedBy" can only be used once at this location.',
      },
      {
        message:
          'The directive "@oneOf" can only be used once at this location.',
      },
    ]);
  });

  it('counts specified property directives and custom directives by name', () => {
    const Url = new GraphQLScalarType({
      name: 'Url',
      specifiedByURL: 'https://example.com/url',
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      types: [Url],
      directives: [
        new GraphQLDirective({
          name: 'specifiedBy',
          locations: [DirectiveLocation.SCALAR],
          isRepeatable: true,
        }),
      ],
    });

    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      'extend scalar Url @specifiedBy',
      schema,
    ).toDeepEqual([
      {
        message:
          'The directive "@specifiedBy" can only be used once at this location.',
      },
    ]);
  });

  it('counts intrinsic specified directives from existing directive definitions', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'tag',
          locations: [DirectiveLocation.FIELD_DEFINITION],
          deprecationReason: 'Use @label.',
        }),
      ],
    });

    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      'extend directive @tag @deprecated',
      schema,
    ).toDeepEqual([
      {
        message:
          'The directive "@deprecated" can only be used once at this location.',
      },
    ]);
  });

  it('tracks directives on SDL directive definitions without a schema', () => {
    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        directive @nonRepeatable on DIRECTIVE_DEFINITION
        directive @target @nonRepeatable on FIELD_DEFINITION
        extend directive @target @nonRepeatable
      `,
    ).toDeepEqual([
      {
        message:
          'The directive "@nonRepeatable" can only be used once at this location.',
      },
    ]);
  });

  it('reuses seen directive maps for repeated type and directive extensions', () => {
    const Url = new GraphQLScalarType({
      name: 'Url',
      specifiedByURL: 'https://example.com/url',
    });
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      types: [Url],
      directives: [
        new GraphQLDirective({
          name: 'tag',
          locations: [DirectiveLocation.FIELD_DEFINITION],
          deprecationReason: 'Use @label.',
        }),
      ],
    });

    expectSDLRuleErrors(
      UniqueDirectivesPerLocationASTVisitor,
      `
        extend scalar Url @specifiedBy(url: "https://example.com/one")
        extend scalar Url @specifiedBy(url: "https://example.com/two")
        extend directive @tag @deprecated
        extend directive @tag @deprecated
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'The directive "@specifiedBy" can only be used once at this location.',
      },
      {
        message:
          'The directive "@specifiedBy" can only be used once at this location.',
      },
      {
        message:
          'The directive "@deprecated" can only be used once at this location.',
      },
      {
        message:
          'The directive "@deprecated" can only be used once at this location.',
      },
    ]);
  });

  it('validates duplicate schema object directive usages', () => {
    const schema = new GraphQLSchema({
      query: schemaWithQuery().getQueryType(),
      directives: [
        new GraphQLDirective({
          name: 'old',
          locations: [DirectiveLocation.FIELD],
          deprecationReason: 'Use @new.',
        }),
      ],
    });

    expectSchemaErrors(schema, (context) => {
      const directiveUsages = context.getSchemaValidationElements()
        .directiveUsages as Array<SchemaDirectiveUsageRecord>;
      const firstUsage = directiveUsages[0];
      directiveUsages.push(
        firstUsage,
        { ...firstUsage, name: 'specifiedBy' },
        { ...firstUsage, name: 'oneOf' },
        { ...firstUsage, name: 'specifiedBy' },
      );
      // eslint-disable-next-line new-cap
      UniqueDirectivesPerLocationTypeSystemValidation(context);
    }).toDeepEqual([
      {
        message:
          'The directive "@deprecated" can only be used once at this location.',
      },
      {
        message:
          'The directive "@specifiedBy" can only be used once at this location.',
      },
    ]);
  });
});
