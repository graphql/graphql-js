import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLString } from '../../type/scalars';
import { GraphQLObjectType } from '../../type/definition';

import { printSchema } from '../printSchema';
import { buildClientSchema } from '../buildClientSchema';
import { introspectionFromSchema } from '../introspectionFromSchema';

function introspectionToSDL(introspection) {
  return printSchema(buildClientSchema(introspection));
}

describe('introspectionFromSchema', () => {
  const schema = new GraphQLSchema({
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
