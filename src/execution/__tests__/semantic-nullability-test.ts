import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import type { ObjMap } from '../../jsutils/ObjMap';

import { parse } from '../../language/parser';

import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSemanticNullable,
} from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { execute } from '../execute';

describe('Execute: Handles Semantic Nullability', () => {
  const DeepDataType = new GraphQLObjectType({
    name: 'DeepDataType',
    fields: {
      f: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const DataType: GraphQLObjectType = new GraphQLObjectType({
    name: 'DataType',
    fields: () => ({
      a: { type: new GraphQLSemanticNullable(GraphQLString) },
      b: { type: GraphQLString },
      c: { type: new GraphQLNonNull(GraphQLString) },
      d: { type: DeepDataType },
    }),
  });

  const schema = new GraphQLSchema({
    useSemanticNullability: true,
    query: DataType,
  });

  function executeWithSemanticNullability(
    query: string,
    rootValue: ObjMap<unknown>,
  ) {
    return execute({
      schema,
      document: parse(query),
      rootValue,
    });
  }

  it('SemanticNonNull throws error on null without error', async () => {
    const data = {
      b: () => null,
    };

    const query = `
      query {
        b
      }
    `;

    const result = await executeWithSemanticNullability(query, data);

    expectJSON(result).toDeepEqual({
      data: {
        b: null,
      },
      errors: [
        {
          message:
            'Cannot return null for semantic-non-nullable field DataType.b.',
          path: ['b'],
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });

  it('SemanticNonNull succeeds on null with error', async () => {
    const data = {
      b: () => {
        throw new Error('Something went wrong');
      },
    };

    const query = `
      query {
        b
      }
    `;

    const result = await executeWithSemanticNullability(query, data);

    expectJSON(result).toDeepEqual({
      data: {
        b: null,
      },
      errors: [
        {
          message: 'Something went wrong',
          path: ['b'],
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });

  it('SemanticNonNull halts null propagation', async () => {
    const data = {
      d: () => ({
        f: () => null,
      }),
    };

    const query = `
      query {
        d {
          f
        }
      }
    `;

    const result = await executeWithSemanticNullability(query, data);

    expectJSON(result).toDeepEqual({
      data: {
        d: null,
      },
      errors: [
        {
          message: 'Cannot return null for non-nullable field DeepDataType.f.',
          path: ['d', 'f'],
          locations: [{ line: 4, column: 11 }],
        },
      ],
    });
  });

  it('SemanticNullable allows null values', async () => {
    const data = {
      a: () => null,
    };

    const query = `
      query {
        a
      }
    `;

    const result = await executeWithSemanticNullability(query, data);

    expectJSON(result).toDeepEqual({
      data: {
        a: null,
      },
    });
  });

  it('SemanticNullable allows non-null values', async () => {
    const data = {
      a: () => 'Apple',
    };

    const query = `
      query {
        a
      }
    `;

    const result = await executeWithSemanticNullability(query, data);

    expectJSON(result).toDeepEqual({
      data: {
        a: 'Apple',
      },
    });
  });
});
