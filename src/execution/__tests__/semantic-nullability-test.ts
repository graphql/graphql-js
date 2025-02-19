import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLError } from '../../error/GraphQLError';

import type { ExecutableDefinitionNode, FieldNode } from '../../language/ast';
import { parse } from '../../language/parser';

import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSemanticNonNull,
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
      a: { type: GraphQLString },
      b: { type: new GraphQLSemanticNonNull(GraphQLString) },
      c: { type: new GraphQLNonNull(GraphQLString) },
      d: { type: new GraphQLSemanticNonNull(DeepDataType) },
    }),
  });

  it('SemanticNonNull throws error on null without error', async () => {
    const data = {
      b: () => null,
    };

    const document = parse(`
        query {
          b
        }
      `);

    const result = await execute({
      schema: new GraphQLSchema({ query: DataType }),
      document,
      rootValue: data,
    });

    const executable = document.definitions[0] as ExecutableDefinitionNode;
    const selectionSet = executable.selectionSet.selections[0];

    expect(result).to.deep.equal({
      data: {
        b: null,
      },
      errors: [
        new GraphQLError(
          'Cannot return null for semantic-non-nullable field DataType.b.',
          {
            nodes: selectionSet,
            path: ['b'],
          },
        ),
      ],
    });
  });

  it('SemanticNonNull succeeds on null with error', async () => {
    const data = {
      b: () => {
        throw new Error('Something went wrong');
      },
    };

    const document = parse(`
        query {
          b
        }
      `);

    const executable = document.definitions[0] as ExecutableDefinitionNode;
    const selectionSet = executable.selectionSet.selections[0];

    const result = await execute({
      schema: new GraphQLSchema({ query: DataType }),
      document,
      rootValue: data,
    });

    expect(result).to.deep.equal({
      data: {
        b: null,
      },
      errors: [
        new GraphQLError('Something went wrong', {
          nodes: selectionSet,
          path: ['b'],
        }),
      ],
    });
  });

  it('SemanticNonNull halts null propagation', async () => {
    const deepData = {
      f: () => null,
    };

    const data = {
      d: () => deepData,
    };

    const document = parse(`
        query {
          d {
            f
          }
        }
      `);

    const result = await execute({
      schema: new GraphQLSchema({ query: DataType }),
      document,
      rootValue: data,
    });

    const executable = document.definitions[0] as ExecutableDefinitionNode;
    const dSelectionSet = executable.selectionSet.selections[0] as FieldNode;
    const fSelectionSet = dSelectionSet.selectionSet?.selections[0];

    expect(result).to.deep.equal({
      data: {
        d: null,
      },
      errors: [
        new GraphQLError(
          'Cannot return null for non-nullable field DeepDataType.f.',
          {
            nodes: fSelectionSet,
            path: ['d', 'f'],
          },
        ),
      ],
    });
  });

  it('SemanticNullable allows non-null values', async () => {
    const data = {
      a: () => 'Apple',
    };

    const document = parse(`
        query {
          a
        }
      `);

    const result = await execute({
      schema: new GraphQLSchema({ query: DataType }),
      document,
      rootValue: data,
    });

    expect(result).to.deep.equal({
      data: {
        a: 'Apple',
      },
    });
  });
});
