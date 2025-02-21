import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';

import { parse } from '../../language/parser.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { execute } from '../execute.js';
import type { ExecutionResult } from '../types.js';

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

  enum _ErrorAction { PROPAGATE, NULL }
  directive @onError(action: _ErrorAction) on QUERY | MUTATION | SUBSCRIPTION
`);

function executeQuery(
  query: string,
  rootValue: unknown,
): PromiseOrValue<ExecutionResult> {
  return execute({ schema, document: parse(query), rootValue });
}

describe('Execute: handles errors', () => {
  it('with `@onError(action: NULL) returns null', async () => {
    const query = `
      query getFoo @onError(action: NULL) {
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
  it('with `@onError(action: PROPAGATE) propagates the error', async () => {
    const query = `
      query getFoo @onError(action: PROPAGATE) {
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
  it('by default propagates the error', async () => {
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
