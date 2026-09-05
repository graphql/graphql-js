import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  DirectiveDefinitionNode,
  DocumentNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { DirectiveDefinitionsHaveLocationsTypeSystemValidation } from '../DirectiveDefinitionsHaveLocationsRule.ts';

describe('Validate: DirectiveDefinitionsHaveLocationsRule', () => {
  it('rejects SDL directive definitions without locations', () => {
    const directiveDefinition = parse('directive @empty on FIELD_DEFINITION')
      .definitions[0];

    const doc = {
      kind: Kind.DOCUMENT,
      definitions: [{ ...directiveDefinition, locations: [] }],
    } as DocumentNode;

    expectJSON(
      validateWithRules({
        documentAST: doc,
        typeSystemRules: [
          DirectiveDefinitionsHaveLocationsTypeSystemValidation,
        ],
      }),
    ).toDeepEqual([
      {
        message: 'Directive @empty must include 1 or more locations.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });

  it('accepts documents without directive definitions or empty extensions', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse('type Query { field: String }'),
        typeSystemRules: [
          DirectiveDefinitionsHaveLocationsTypeSystemValidation,
        ],
      }),
    ).toDeepEqual([]);

    expectJSON(
      validateWithRules({
        documentAST: parse(`
          directive @tag on OBJECT
          extend directive @tag @deprecated
        `),
        typeSystemRules: [
          DirectiveDefinitionsHaveLocationsTypeSystemValidation,
        ],
      }),
    ).toDeepEqual([]);
  });

  it('rejects schema directive definitions without locations', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { field: { type: GraphQLString } },
      }),
      directives: [
        new GraphQLDirective({
          name: 'empty',
          locations: [],
          astNode: parse('directive @empty on FIELD_DEFINITION')
            .definitions[0] as DirectiveDefinitionNode,
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [
          DirectiveDefinitionsHaveLocationsTypeSystemValidation,
        ],
      }),
    ).toDeepEqual([
      {
        message: 'Directive @empty must include 1 or more locations.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });
});
