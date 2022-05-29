import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { GraphQLObjectTypeImpl } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchemaImpl } from '../../type/schema';

import { buildClientSchema } from '../buildClientSchema';
import type { IntrospectionQuery } from '../getIntrospectionQuery';
import { introspectionFromSchema } from '../introspectionFromSchema';
import { printSchema } from '../printSchema';

function introspectionToSDL(introspection: IntrospectionQuery): string {
  return printSchema(buildClientSchema(introspection));
}

describe('introspectionFromSchema', () => {
  const schema = new GraphQLSchemaImpl({
    description: 'This is a simple schema',
    query: new GraphQLObjectTypeImpl({
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
});
