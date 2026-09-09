import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { UnionMembersAreObjectTypesTypeSystemValidation } from '../UnionMembersAreObjectTypesRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [UnionMembersAreObjectTypesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: UnionMembersAreObjectTypesRule', () => {
  it('rejects SDL union members that are not object types', () => {
    expectSDLErrors(`
      input Input {
        field: String
      }

      union Search = Input
    `).toDeepEqual([
      {
        message:
          'Union type Search can only include Object types, it cannot include Input.',
        locations: [{ line: 6, column: 22 }],
      },
    ]);
  });

  it('accepts SDL object members and ignores unknown member types', () => {
    expectSDLErrors(`
      type Object {
        field: String
      }

      union Search = Object | Missing
      union Empty
    `).toDeepEqual([]);
  });

  it('rejects schema union members that are not object types', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: { field: { type: GraphQLString } },
    });

    for (const memberType of [
      GraphQLString,
      new GraphQLNonNull(Query),
      new GraphQLList(Query),
    ]) {
      const schema = new GraphQLSchema({
        query: Query,
        types: [
          new GraphQLUnionType({
            name: 'Search',
            // @ts-expect-error Testing defensive validation of invalid config.
            types: [memberType],
          }),
        ],
      });

      expectJSON(
        validateWithRules({
          schema,
          typeSystemRules: [UnionMembersAreObjectTypesTypeSystemValidation],
        }),
      ).toDeepEqual([
        {
          message:
            'Union type Search can only include Object types, ' +
            `it cannot include ${memberType}.`,
        },
      ]);
    }
  });

  it('reports schema union member type nodes when available', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: new GraphQLUnionType({
              name: 'Search',
              // @ts-expect-error Testing defensive validation of invalid config.
              types: [GraphQLString],
              astNode: parse('union Search = String')
                .definitions[0] as UnionTypeDefinitionNode,
            }),
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [UnionMembersAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Union type Search can only include Object types, it cannot include String.',
        locations: [{ line: 1, column: 16 }],
      },
    ]);
  });

  it('reports schema union member type nodes from extensions', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: new GraphQLUnionType({
              name: 'Search',
              // @ts-expect-error Testing defensive validation of invalid config.
              types: [GraphQLString],
              extensionASTNodes: [
                parse('extend union Search @deprecated')
                  .definitions[0] as UnionTypeExtensionNode,
                parse('extend union Search = String')
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
        typeSystemRules: [UnionMembersAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Union type Search can only include Object types, it cannot include String.',
        locations: [{ line: 1, column: 23 }],
      },
    ]);
  });

  it('reports schema union member errors without malformed AST member nodes', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: new GraphQLUnionType({
              name: 'Search',
              // @ts-expect-error Testing defensive validation of invalid config.
              types: [GraphQLString],
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
        typeSystemRules: [UnionMembersAreObjectTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Union type Search can only include Object types, it cannot include String.',
      },
    ]);
  });
});
