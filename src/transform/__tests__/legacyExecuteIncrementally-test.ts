import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { invariant } from '../../jsutils/invariant.js';
import { isPromise } from '../../jsutils/isPromise.js';
import type { ObjMap } from '../../jsutils/ObjMap.js';

import type { DocumentNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import { parse } from '../../language/parser.js';

import { GraphQLNonNull, GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { legacyExecuteIncrementally } from '../legacyExecuteIncrementally.js';
import type {
  LegacyInitialIncrementalExecutionResult,
  LegacySubsequentIncrementalExecutionResult,
} from '../transformResult.js';

const someObjectType = new GraphQLObjectType({
  name: 'SomeObject',
  fields: {
    someField: { type: GraphQLString },
    anotherField: { type: GraphQLString },
    nonNullableField: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      someField: { type: new GraphQLNonNull(GraphQLString) },
      someObjectField: { type: someObjectType },
    },
  }),
});

async function complete(document: DocumentNode, rootValue: ObjMap<unknown>) {
  const result = legacyExecuteIncrementally({
    schema,
    document,
    rootValue,
  });

  invariant(!isPromise(result));

  if ('initialResult' in result) {
    const results: Array<
      | LegacyInitialIncrementalExecutionResult
      | LegacySubsequentIncrementalExecutionResult
    > = [result.initialResult];
    for await (const patch of result.subsequentResults) {
      results.push(patch);
    }
    return results;
  }
  return result;
}

describe('legacyExecuteIncrementally', () => {
  it('handles invalid document', () => {
    const result = legacyExecuteIncrementally({
      schema,
      document: { kind: Kind.DOCUMENT, definitions: [] },
    });

    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'Must provide an operation.',
        },
      ],
    });
  });

  it('handles non-nullable root field', () => {
    const result = legacyExecuteIncrementally({
      schema,
      document: parse('{ someField }'),
      rootValue: { someField: null },
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field Query.someField.',
          locations: [{ line: 1, column: 3 }],
          path: ['someField'],
        },
      ],
    });
  });

  it('handles null-bubbling from latest format', async () => {
    const document = parse(`
      query {
        someObjectField {
          ... @defer { someField anotherField }
          ... @defer { someField nonNullableField }
        }
      }
    `);
    const result = await complete(document, {
      someObjectField: {
        someField: 'someField',
        anotherField: 'anotherField',
        nonNullableField: null,
      },
    });
    expectJSON(result).toDeepEqual([
      {
        data: { someObjectField: {} },
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { someField: 'someField', anotherField: 'anotherField' },
            path: ['someObjectField'],
          },
          {
            data: null,
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field SomeObject.nonNullableField.',
                locations: [{ line: 5, column: 34 }],
                path: ['someObjectField', 'nonNullableField'],
              },
            ],
            path: ['someObjectField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
});
