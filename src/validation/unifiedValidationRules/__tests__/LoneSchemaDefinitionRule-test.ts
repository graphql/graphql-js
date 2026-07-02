import { describe, it } from 'node:test';

import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { LoneSchemaDefinitionTypeSystemValidation } from '../LoneSchemaDefinitionRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: LoneSchemaDefinitionRule', () => {
  it('validates SDL schema definitions', () => {
    expectSDLRuleErrors(
      LoneSchemaDefinitionTypeSystemValidation,
      `
        schema { query: Query }
        schema { query: Query }
        type Query { field: String }
      `,
    ).toDeepEqual([{ message: 'Must provide only one schema definition.' }]);
  });

  it('rejects schema definitions when a schema already exists', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
    });

    expectSDLRuleErrors(
      LoneSchemaDefinitionTypeSystemValidation,
      'schema { query: Query }',
      schema,
    ).toDeepEqual([
      { message: 'Cannot define a new schema within a schema extension.' },
    ]);
  });

  it('recognizes existing schemas by ast node and non-query roots', () => {
    const schemaDefinition = parse('schema { query: Query }').definitions[0];
    const schemaWithAstNode = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      astNode: schemaDefinition as never,
    });
    const Mutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Subscription = new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        field: { type: GraphQLString },
      },
    });

    for (const schema of [
      schemaWithAstNode,
      new GraphQLSchema({ mutation: Mutation }),
      new GraphQLSchema({ subscription: Subscription }),
    ]) {
      expectSDLRuleErrors(
        LoneSchemaDefinitionTypeSystemValidation,
        'schema { query: Query }',
        schema,
      ).toDeepEqual([
        { message: 'Cannot define a new schema within a schema extension.' },
      ]);
    }
  });
});
