import { describe, it } from 'node:test';

import { expect } from 'chai';

import { dedent } from '../../__testUtils__/dedent.ts';

import { DirectiveLocation } from '../../language/directiveLocation.ts';

import { GraphQLObjectType } from '../../type/definition.ts';
import { GraphQLDirective } from '../../type/directives.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildClientSchema } from '../buildClientSchema.ts';
import type { IntrospectionQuery } from '../getIntrospectionQuery.ts';
import { introspectionFromSchema } from '../introspectionFromSchema.ts';
import { printSchema } from '../printSchema.ts';

function introspectionToSDL(introspection: IntrospectionQuery): string {
  return printSchema(buildClientSchema(introspection));
}

describe('introspectionFromSchema', () => {
  const schema = new GraphQLSchema({
    description: 'This is a simple schema',
    query: new GraphQLObjectType({
      name: 'Simple',
      description: 'This is a simple type',
      fields: {
        string: {
          type: GraphQLString,
          description: 'This is a string field',
        },
      },
    }),
  });

  it('converts a simple schema', () => {
    const introspection = introspectionFromSchema(schema);

    expect(introspectionToSDL(introspection)).to.deep.equal(dedent`
      """This is a simple schema"""
      schema {
        query: Simple
      }

      """This is a simple type"""
      type Simple {
        """This is a string field"""
        string: String
      }
    `);
  });

  it('converts a simple schema without descriptions', () => {
    const introspection = introspectionFromSchema(schema, {
      descriptions: false,
    });

    expect(introspectionToSDL(introspection)).to.deep.equal(dedent`
      schema {
        query: Simple
      }

      type Simple {
        string: String
      }
    `);
  });

  it('includes deprecated directives', () => {
    const schemaWithDeprecatedDirective = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          string: {
            type: GraphQLString,
          },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'deprecatedDirective',
          locations: [DirectiveLocation.QUERY],
          deprecationReason: 'Use another directive',
        }),
      ],
    });
    const introspection = introspectionFromSchema(
      schemaWithDeprecatedDirective,
    );
    const deprecatedDirective = introspection.__schema.directives.find(
      ({ name }) => name === 'deprecatedDirective',
    );

    expect(deprecatedDirective).to.deep.include({
      name: 'deprecatedDirective',
      isDeprecated: true,
      deprecationReason: 'Use another directive',
    });
  });
});
