import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { UniqueRootOperationTypesTypeSystemValidation } from '../UniqueRootOperationTypesRule.ts';

import { expectSchemaErrors } from './harness.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [UniqueRootOperationTypesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: UniqueRootOperationTypesRule', () => {
  it('accepts distinct schema root operation types', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Mutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        field: { type: GraphQLString },
      },
    });

    expectJSON(
      validateWithRules({
        schema: new GraphQLSchema({ query: Query, mutation: Mutation }),
        typeSystemRules: [UniqueRootOperationTypesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('rejects duplicate schema root operation types', () => {
    const schemaDefinition = parse('schema { query: Root mutation: Root }')
      .definitions[0] as SchemaDefinitionNode;
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        field: { type: GraphQLString },
      },
    });

    expectJSON(
      validateWithRules({
        schema: new GraphQLSchema({
          query: Root,
          mutation: Root,
          astNode: schemaDefinition,
        }),
        typeSystemRules: [UniqueRootOperationTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'All root types must be different, "Root" type is used as query and mutation root types.',
        locations: [
          { line: 1, column: 17 },
          { line: 1, column: 32 },
        ],
      },
    ]);
  });

  it('ignores non-object schema root operation types', () => {
    const schema = new GraphQLSchema({
      // @ts-expect-error Testing rule behavior for invalid schema roots.
      query: GraphQLString,
      // @ts-expect-error Testing rule behavior for invalid schema roots.
      mutation: GraphQLString,
    });
    expectSchemaErrors(
      schema,
      UniqueRootOperationTypesTypeSystemValidation,
    ).toDeepEqual([]);
  });

  it('reports duplicate schema root operation types without nodes', () => {
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        field: { type: GraphQLString },
      },
    });

    expectJSON(
      validateWithRules({
        schema: new GraphQLSchema({ query: Root, mutation: Root }),
        typeSystemRules: [UniqueRootOperationTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'All root types must be different, "Root" type is used as query and mutation root types.',
      },
    ]);
  });

  it('reports duplicate schema root operation type nodes from schema extensions', () => {
    const schemaDefinition = parse('schema { query: Root }')
      .definitions[0] as SchemaDefinitionNode;
    const schemaExtensionWithoutOperationTypes = parse(
      'extend schema @deprecated',
    ).definitions[0] as SchemaExtensionNode;
    const schemaExtension = parse('extend schema { mutation: Root }')
      .definitions[0] as SchemaExtensionNode;
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        field: { type: GraphQLString },
      },
    });

    expectJSON(
      validateWithRules({
        schema: new GraphQLSchema({
          query: Root,
          mutation: Root,
          astNode: schemaDefinition,
          extensionASTNodes: [
            schemaExtensionWithoutOperationTypes,
            schemaExtension,
          ],
        }),
        typeSystemRules: [UniqueRootOperationTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'All root types must be different, "Root" type is used as query and mutation root types.',
        locations: [
          { line: 1, column: 17 },
          { line: 1, column: 27 },
        ],
      },
    ]);
  });

  it('reports duplicate schema root operation types when some schema nodes are absent', () => {
    const schemaDefinition = parse('schema { query: Root }')
      .definitions[0] as SchemaDefinitionNode;
    const schemaExtension = parse('extend schema { mutation: Root }')
      .definitions[0] as SchemaExtensionNode;
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        field: { type: GraphQLString },
      },
    });

    expectJSON(
      validateWithRules({
        schema: new GraphQLSchema({
          query: Root,
          subscription: Root,
          astNode: schemaDefinition,
          extensionASTNodes: [schemaExtension],
        }),
        typeSystemRules: [UniqueRootOperationTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'All root types must be different, "Root" type is used as query and subscription root types.',
        locations: [{ line: 1, column: 17 }],
      },
    ]);
  });

  it('rejects duplicate SDL root operation types', () => {
    expectSDLErrors(`
      schema {
        query: Root
        mutation: Root
        subscription: Root
      }

      type Root {
        field: String
      }
    `).toDeepEqual([
      {
        message:
          'All root types must be different, "Root" type is used as query, mutation, and subscription root types.',
        locations: [
          { line: 3, column: 16 },
          { line: 4, column: 19 },
          { line: 5, column: 23 },
        ],
      },
    ]);
  });

  it('accepts unique SDL root operation types', () => {
    expectSDLErrors(`
      schema {
        query: Query
      }

      type Query {
        field: String
      }
    `).toDeepEqual([]);
  });

  it('skips existing schema root uniqueness checks for unrelated documents', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({ query: Query });

    expectSDLErrors('directive @tag on FIELD_DEFINITION', schema).toDeepEqual(
      [],
    );
  });

  it('uses existing schema root operation types', () => {
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: Root,
      mutation: Root,
    });

    expectSDLErrors(
      `
        directive @tag on SCHEMA
        extend schema @tag
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'All root types must be different, "Root" type is used as query and mutation root types.',
      },
    ]);
  });
});
