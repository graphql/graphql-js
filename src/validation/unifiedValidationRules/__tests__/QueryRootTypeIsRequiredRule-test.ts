import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { SchemaExtensionNode } from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { QueryRootTypeIsRequiredTypeSystemValidation } from '../QueryRootTypeIsRequiredRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [QueryRootTypeIsRequiredTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithLocations(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [QueryRootTypeIsRequiredTypeSystemValidation],
  });
  return expectJSON(errors);
}

describe('Validate: QueryRootTypeIsRequiredRule', () => {
  it('rejects SDL schemas without query root types', () => {
    expectSDLErrors(`
      schema {
        mutation: Mutation
      }

      type Mutation {
        field: String
      }
    `).toDeepEqual([{ message: 'Query root type must be provided.' }]);
  });

  it('reports missing SDL query root types on explicit schema definitions', () => {
    expectSDLErrorsWithLocations(`
      schema {
        mutation: Mutation
      }

      type Mutation {
        field: String
      }
    `).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('reports missing SDL query root types on schema extensions', () => {
    expectSDLErrorsWithLocations(`
      extend schema {
        mutation: Mutation
      }

      type Mutation {
        field: String
      }
    `).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('reports missing implicit SDL query root types on the document', () => {
    expectSDLErrorsWithLocations(`
      type Mutation {
        field: String
      }
    `).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });

  it('reports missing mixed-document query root types once', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          type Mutation {
            field: String
          }

          query {
            field
          }
        `),
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 1, column: 1 }],
      },
      {
        message: 'The query operation is not supported by the schema.',
        locations: [{ line: 6, column: 11 }],
      },
    ]);
  });

  it('keeps checking executable documents without a schema', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse('{ field }'),
        typeSystemRules: [QueryRootTypeIsRequiredTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });

  it('accepts SDL extensions that provide an existing schema query root', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: { field: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({ types: [Query] });

    expectSDLErrors('extend schema { query: Query }', schema).toDeepEqual([]);
  });

  it('skips existing schema query checks for unrelated documents', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: { field: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({ query: Query });

    expectSDLErrors('directive @tag on FIELD_DEFINITION', schema).toDeepEqual(
      [],
    );
  });

  it('rejects schemas without a query root type', () => {
    expectJSON(
      validateWithRules({
        schema: new GraphQLSchema({}),
        typeSystemRules: [QueryRootTypeIsRequiredTypeSystemValidation],
      }),
    ).toDeepEqual([{ message: 'Query root type must be provided.' }]);
  });

  it('reports missing schema query root types on existing schema nodes', () => {
    const schemaDocument = parse(`
      schema {
        mutation: Mutation
      }
    `);
    const schemaNode = schemaDocument.definitions[0];
    if (schemaNode.kind !== Kind.SCHEMA_DEFINITION) {
      throw new Error('Expected schema definition.');
    }

    const Mutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: { field: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({
      mutation: Mutation,
      astNode: schemaNode,
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [QueryRootTypeIsRequiredTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('reports missing schema query root types on existing schema extension nodes', () => {
    const schemaNode = parse('schema { mutation: Mutation }').definitions[0];
    const extensionNode = parse('extend schema @deprecated')
      .definitions[0] as SchemaExtensionNode;
    if (schemaNode.kind !== Kind.SCHEMA_DEFINITION) {
      throw new Error('Expected schema definition.');
    }

    const Mutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: { field: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({
      mutation: Mutation,
      astNode: schemaNode,
      extensionASTNodes: [extensionNode],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [QueryRootTypeIsRequiredTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [
          { line: 1, column: 1 },
          { line: 1, column: 1 },
        ],
      },
    ]);
  });
});
