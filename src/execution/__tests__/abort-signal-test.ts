import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import type { DocumentNode } from '../../language/ast.js';
import { parse } from '../../language/parser.js';

import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from '../../type/index.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { execute, experimentalExecuteIncrementally } from '../execute.js';
import type {
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../types.js';

async function complete(
  document: DocumentNode,
  rootValue: unknown,
  abortSignal: AbortSignal,
) {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
    abortSignal,
  });

  if ('initialResult' in result) {
    const results: Array<
      InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
    > = [result.initialResult];
    for await (const patch of result.subsequentResults) {
      results.push(patch);
    }
    return results;
  }
}

const schema = buildSchema(/* GraphQL */ `
  type Todo {
    id: ID!
    text: String!
    completed: Boolean!
    author: User
  }

  type User {
    id: ID!
    name: String!
  }

  type Query {
    todo: Todo
  }

  type Mutation {
    foo: String
    bar: String
  }
`);

describe('Abort Signal', () => {
  it('should stop the execution when aborted in resolver', async () => {
    const abortController = new AbortController();
    const document = parse(/* GraphQL */ `
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);
    const result = await execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo() {
          abortController.abort('Aborted');
          return {
            id: '1',
            text: 'Hello, World!',
            completed: false,
            /* c8 ignore next 3 */
            author: () => {
              expect.fail('Should not be called');
            },
          };
        },
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        todo: null,
      },
      errors: [
        {
          locations: [
            {
              column: 9,
              line: 3,
            },
          ],
          message: 'Aborted',
          path: ['todo'],
        },
      ],
    });
  });

  it('should stop the execution when aborted in deferred resolver', async () => {
    const abortController = new AbortController();
    const document = parse(/* GraphQL */ `
      query {
        todo {
          id
          ... on Todo @defer {
            text
            author {
              ... on Author @defer {
                id
              }
            }
          }
        }
      }
    `);
    const result = complete(
      document,
      {
        todo() {
          return {
            id: '1',
            text: () => {
              abortController.abort('Aborted');
              return 'hello world';
            },
            /* c8 ignore next 3 */
            author: async () => {
              await resolveOnNextTick();
              return { id: '2' };
            },
          };
        },
      },
      abortController.signal,
    );

    expectJSON(await result).toDeepEqual([
      {
        data: {
          todo: {
            id: '1',
          },
        },
        pending: [{ id: '0', path: ['todo'] }],
        hasNext: true,
      },
      {
        completed: [
          {
            errors: [
              {
                message: 'Aborted',
              },
            ],
            id: '0',
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('should stop the for serial mutation execution', async () => {
    const abortController = new AbortController();
    const document = parse(/* GraphQL */ `
      mutation {
        foo
        bar
      }
    `);
    const result = await execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        foo() {
          abortController.abort('Aborted');
          return 'baz';
        },
        /* c8 ignore next 3 */
        bar() {
          expect.fail('Should not be called');
        },
      },
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Aborted',
        },
      ],
    });
  });

  it('should stop the execution when aborted pre-execute', async () => {
    const abortController = new AbortController();
    const document = parse(/* GraphQL */ `
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);
    abortController.abort('Aborted');
    const result = await execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        /* c8 ignore next 3 */
        todo() {
          return {};
        },
      },
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Aborted',
        },
      ],
    });
  });

  it('exits early on abort mid-execution', async () => {
    const asyncObjectType = new GraphQLObjectType({
      name: 'AsyncObject',
      fields: {
        field: {
          type: GraphQLString,
          /* c8 ignore next 3 */
          resolve() {
            expect.fail('Should not be called');
          },
        },
      },
    });

    const newSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          asyncObject: {
            type: asyncObjectType,
            async resolve() {
              await resolveOnNextTick();
              return {};
            },
          },
        },
      }),
    });

    const document = parse(`
      {
        asyncObject {
          field
        }
      }
    `);

    const abortController = new AbortController();

    const result = execute({
      schema: newSchema,
      document,
      abortSignal: abortController.signal,
    });

    abortController.abort('This operation was aborted');

    expectJSON(await result).toDeepEqual({
      data: { asyncObject: null },
      errors: [
        {
          message: 'This operation was aborted',
          locations: [{ line: 3, column: 9 }],
          path: ['asyncObject'],
        },
      ],
    });
  });
});
