import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  InputObjectTypeDefinitionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { RootOperationTypesAreObjectTypesTypeSystemValidation } from '../RootOperationTypesAreObjectTypesRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [RootOperationTypesAreObjectTypesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: RootOperationTypesAreObjectTypesRule', () => {
  it('rejects SDL root operation types that are not object types', () => {
    expectSDLErrors(`
      schema {
        query: Input
        mutation: Input
        subscription: Input
      }

      input Input {
        field: String
      }
    `).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be Input.',
        locations: [{ line: 3, column: 16 }],
      },
      {
        message:
          'Mutation root type must be Object type if provided, it cannot be Input.',
        locations: [{ line: 4, column: 19 }],
      },
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be Input.',
        locations: [{ line: 5, column: 23 }],
      },
    ]);
  });

  it('ignores unknown SDL root operation types', () => {
    expectSDLErrors(`
      schema {
        query: Missing
      }
    `).toDeepEqual([]);
  });

  it('accepts SDL root operation types that are object types', () => {
    expectSDLErrors(`
      schema {
        query: Query
      }

      type Query {
        field: String
      }
    `).toDeepEqual([]);
  });

  it('skips existing schema root type checks for unrelated documents', () => {
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

  it('uses existing schema root operation type nodes when SDL has no node', () => {
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      // @ts-expect-error Testing validation of an invalid constructed schema.
      query: Input,
    });

    expectSDLErrors(
      `
        directive @tag on SCHEMA
        extend schema @tag
      `,
      schema,
    ).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be Input.',
      },
    ]);
  });

  it('rejects schema root operation types that are not object types', () => {
    const schemaDefinition = parse('schema { query: Input }')
      .definitions[0] as SchemaDefinitionNode;
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      // @ts-expect-error Testing validation of an invalid constructed schema.
      query: Input,
      astNode: schemaDefinition,
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [RootOperationTypesAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be Input.',
        locations: [{ line: 1, column: 17 }],
      },
    ]);
  });

  it('reports schema root operation type nodes from schema extensions', () => {
    const schemaDefinition = parse('schema { mutation: Mutation }')
      .definitions[0] as SchemaDefinitionNode;
    const schemaExtensionWithoutOperationTypes = parse(
      'extend schema @deprecated',
    ).definitions[0] as SchemaExtensionNode;
    const schemaExtension = parse('extend schema { query: Input }')
      .definitions[0] as SchemaExtensionNode;
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      // @ts-expect-error Testing validation of an invalid constructed schema.
      query: Input,
      astNode: schemaDefinition,
      extensionASTNodes: [
        schemaExtensionWithoutOperationTypes,
        schemaExtension,
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [RootOperationTypesAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be Input.',
        locations: [{ line: 1, column: 24 }],
      },
    ]);
  });

  it('reports schema root operation type nodes when schema nodes are absent', () => {
    const inputDefinition = parse('input Input { field: String }')
      .definitions[0] as InputObjectTypeDefinitionNode;
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
      astNode: inputDefinition,
    });

    const schema = new GraphQLSchema({
      // @ts-expect-error Testing validation of an invalid constructed schema.
      query: Input,
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [RootOperationTypesAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be Input.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });

  it('reports no nodes for schema root operation types that are not named', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      // @ts-expect-error Testing validation of an invalid constructed schema.
      query: new GraphQLList(Query),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [RootOperationTypesAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be [Query].',
      },
    ]);
  });
});
