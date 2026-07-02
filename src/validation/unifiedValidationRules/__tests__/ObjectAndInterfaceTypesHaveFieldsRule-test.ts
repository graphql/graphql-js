import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  GraphQLInterfaceType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { ObjectAndInterfaceTypesHaveFieldsTypeSystemValidation } from '../ObjectAndInterfaceTypesHaveFieldsRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [ObjectAndInterfaceTypesHaveFieldsTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: ObjectAndInterfaceTypesHaveFieldsRule', () => {
  it('validates SDL field counts after extensions are known', () => {
    expectSDLErrors(`
      type Query
      extend type Query {
        field: String
      }

      interface Node
      extend interface Node {
        id: String
      }
    `).toDeepEqual([]);
  });

  it('uses existing schema field counts when validating SDL', () => {
    const ExistingInterface = new GraphQLInterfaceType({
      name: 'ExistingInterface',
      fields: { id: { type: GraphQLString } },
    });
    const ExistingObject = new GraphQLObjectType({
      name: 'ExistingObject',
      fields: { field: { type: GraphQLString } },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          object: { type: ExistingObject },
          iface: { type: ExistingInterface },
        },
      }),
    });

    expectSDLErrors(
      `
        directive @tag on OBJECT | INTERFACE

        extend type ExistingObject @tag

        extend interface ExistingInterface @tag
      `,
      schema,
    ).toDeepEqual([]);
  });

  it('accepts SDL extensions that add fields to existing empty types', () => {
    const EmptyInterface = new GraphQLInterfaceType({
      name: 'EmptyInterface',
      fields: {},
    });
    const EmptyObject = new GraphQLObjectType({
      name: 'EmptyObject',
      fields: {},
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      types: [EmptyInterface, EmptyObject],
    });

    expectSDLErrors(
      `
        extend type EmptyObject {
          field: String
        }

        extend interface EmptyInterface {
          field: String
        }
      `,
      schema,
    ).toDeepEqual([]);
  });

  it('rejects SDL object and interface types without fields', () => {
    expectSDLErrors(`
      type Query {
        field: String
      }

      type EmptyObject
      interface EmptyInterface
    `).toDeepEqual([
      {
        message: 'Type EmptyObject must define one or more fields.',
        locations: [{ line: 6, column: 7 }],
      },
      {
        message: 'Type EmptyInterface must define one or more fields.',
        locations: [{ line: 7, column: 7 }],
      },
    ]);
  });

  it('rejects schema object and interface types without fields', () => {
    const EmptyInterface = new GraphQLInterfaceType({
      name: 'EmptyInterface',
      fields: {},
    });

    const EmptyObject = new GraphQLObjectType({
      name: 'EmptyObject',
      fields: {},
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
          node: { type: EmptyInterface },
        },
      }),
      types: [EmptyObject],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [
          ObjectAndInterfaceTypesHaveFieldsTypeSystemValidation,
        ],
      }),
    ).toDeepEqual([
      { message: 'Type EmptyObject must define one or more fields.' },
      { message: 'Type EmptyInterface must define one or more fields.' },
    ]);
  });
});
