import { describe, it } from 'node:test';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import type { GraphQLErrorBehavior } from '../ErrorBehavior.ts';
import { execute } from '../execute.ts';

const schema = buildSchema(`
  type Query {
    syncFoo: Int!
    asyncFoo: Int!
    bar: Int!
  }
`);

const syncError = new Error('bar');

const rootValue = {
  syncFoo() {
    throw syncError;
  },
  asyncFoo() {
    return Promise.reject(syncError);
  },
  bar: 42,
};

function executeQuery(query: string, onError?: GraphQLErrorBehavior) {
  return execute({ schema, document: parse(query), rootValue, onError });
}

describe('Execute: onError', () => {
  it('defaults to "PROPAGATE" when omitted', async () => {
    const result = await executeQuery(`{ syncFoo bar }`);
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'bar',
          path: ['syncFoo'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('"PROPAGATE" propagates a non-null error to the parent position', async () => {
    const result = await executeQuery(`{ syncFoo bar }`, 'PROPAGATE');
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'bar',
          path: ['syncFoo'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('"NULL" resolves the non-null position to null without propagating', async () => {
    const result = await executeQuery(`{ syncFoo bar }`, 'NULL');
    expectJSON(result).toDeepEqual({
      data: { syncFoo: null, bar: 42 },
      errors: [
        {
          message: 'bar',
          path: ['syncFoo'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('"NULL" works for asynchronous errors too', async () => {
    const result = await executeQuery(`{ asyncFoo bar }`, 'NULL');
    expectJSON(result).toDeepEqual({
      data: { asyncFoo: null, bar: 42 },
      errors: [
        {
          message: 'bar',
          path: ['asyncFoo'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('"HALT" stops execution and reports only the halting error', async () => {
    const result = await executeQuery(`{ syncFoo bar }`, 'HALT');
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'bar',
          path: ['syncFoo'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('"HALT" reports only the first error when multiple positions error', async () => {
    const result = await executeQuery(`{ a: syncFoo b: syncFoo bar }`, 'HALT');
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        { message: 'bar', path: ['a'], locations: [{ line: 1, column: 3 }] },
      ],
    });
  });

  it('takes precedence over `@experimental_disableErrorPropagation`', async () => {
    const schemaWithDirective = buildSchema(`
      type Query {
        syncFoo: Int!
      }

      directive @experimental_disableErrorPropagation on QUERY | MUTATION | SUBSCRIPTION
    `);
    const result = await execute({
      schema: schemaWithDirective,
      document: parse(
        `query getFoo @experimental_disableErrorPropagation { syncFoo }`,
      ),
      rootValue,
      onError: 'PROPAGATE',
    });
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'bar',
          path: ['syncFoo'],
          locations: [{ line: 1, column: 54 }],
        },
      ],
    });
  });

  it('rejects an invalid onError value as a request error', async () => {
    const result = await executeQuery(
      `{ bar }`,
      'boom' as unknown as GraphQLErrorBehavior,
    );
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            '"onError" must be one of "NULL", "PROPAGATE", or "HALT", but got: "boom".',
        },
      ],
    });
  });
});
