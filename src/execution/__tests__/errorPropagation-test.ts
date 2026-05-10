import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { execute } from '../execute.ts';
import type { ExecutionResult } from '../Executor.ts';

const syncError = new Error('bar');

const throwingData = {
  foo() {
    throw syncError;
  },
};

const schema = buildSchema(`
  type Query {
    foo : Int!
  }

  directive @experimental_disableErrorPropagation on QUERY | MUTATION | SUBSCRIPTION
`);

function executeQuery(
  query: string,
  rootValue: unknown,
): PromiseOrValue<ExecutionResult> {
  return execute({ schema, document: parse(query), rootValue });
}

describe('Execute: handles errors', () => {
  it('with `@experimental_disableErrorPropagation returns null', async () => {
    const query = `
      query getFoo @experimental_disableErrorPropagation {
        foo
      }
    `;
    const result = await executeQuery(query, throwingData);
    expectJSON(result).toDeepEqual({
      data: { foo: null },
      errors: [
        {
          message: 'bar',
          path: ['foo'],
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });
  it('without `experimental_disableErrorPropagation` propagates the error', async () => {
    const query = `
      query getFoo {
        foo
      }
    `;
    const result = await executeQuery(query, throwingData);
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'bar',
          path: ['foo'],
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });
});
