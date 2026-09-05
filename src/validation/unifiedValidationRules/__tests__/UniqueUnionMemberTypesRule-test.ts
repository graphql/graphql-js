import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { UniqueUnionMemberTypesTypeSystemValidation } from '../UniqueUnionMemberTypesRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [UniqueUnionMemberTypesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: UniqueUnionMemberTypesRule', () => {
  it('rejects duplicate SDL union members', () => {
    expectSDLErrors(`
      type Object {
        field: String
      }

      union Search = Object | Object
    `).toDeepEqual([
      {
        message: 'Union type Search can only include type Object once.',
        locations: [
          { line: 6, column: 22 },
          { line: 6, column: 31 },
        ],
      },
    ]);
  });

  it('uses existing schema union members when validating SDL extensions', () => {
    const ObjectType = new GraphQLObjectType({
      name: 'Object',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const Search = new GraphQLUnionType({
      name: 'Search',
      types: [ObjectType],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          search: { type: Search },
        },
      }),
    });

    expectSDLErrors('extend union Search = Object', schema).toDeepEqual([
      {
        message: 'Union type Search can only include type Object once.',
        locations: [{ line: 1, column: 23 }],
      },
    ]);
  });

  it('accepts unique SDL members and ignores existing schema types that are not unions', () => {
    const Search = new GraphQLObjectType({
      name: 'Search',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const ObjectType = new GraphQLObjectType({
      name: 'Object',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: Search,
      types: [ObjectType],
    });

    expectSDLErrors('union Search = Object', schema).toDeepEqual([]);
    expectSDLErrors(
      'union Search = Object\nextend union Search = Other',
    ).toDeepEqual([]);
    expectSDLErrors('union Empty').toDeepEqual([]);
  });

  it('rejects duplicate schema union members', () => {
    const ObjectType = new GraphQLObjectType({
      name: 'Object',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          search: {
            type: new GraphQLUnionType({
              name: 'Search',
              types: [ObjectType, ObjectType],
              astNode: parse('union Search = Object | Object')
                .definitions[0] as UnionTypeDefinitionNode,
            }),
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [UniqueUnionMemberTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Union type Search can only include type Object once.',
        locations: [
          { line: 1, column: 16 },
          { line: 1, column: 25 },
        ],
      },
    ]);
  });

  it('reports schema union member type nodes from extensions', () => {
    const ObjectType = new GraphQLObjectType({
      name: 'Object',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          search: {
            type: new GraphQLUnionType({
              name: 'Search',
              types: [ObjectType, ObjectType],
              extensionASTNodes: [
                parse('extend union Search @deprecated')
                  .definitions[0] as UnionTypeExtensionNode,
                parse('extend union Search = Object | Object')
                  .definitions[0] as UnionTypeExtensionNode,
              ],
            }),
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [UniqueUnionMemberTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Union type Search can only include type Object once.',
        locations: [
          { line: 1, column: 23 },
          { line: 1, column: 32 },
        ],
      },
    ]);
  });

  it('rejects duplicate schema union members with malformed AST', () => {
    const ObjectType = new GraphQLObjectType({
      name: 'Object',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          search: {
            type: new GraphQLUnionType({
              name: 'Search',
              types: [ObjectType, ObjectType],
              astNode: parse('union Search')
                .definitions[0] as UnionTypeDefinitionNode,
            }),
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [UniqueUnionMemberTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Union type Search can only include type Object once.',
      },
    ]);
  });

  it('ignores schema union members that are not named types', () => {
    const ObjectType = new GraphQLObjectType({
      name: 'Object',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          search: {
            type: new GraphQLUnionType({
              name: 'Search',
              // @ts-expect-error Testing defensive validation of invalid config.
              types: [new GraphQLList(ObjectType), ObjectType],
            }),
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [UniqueUnionMemberTypesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });
});
