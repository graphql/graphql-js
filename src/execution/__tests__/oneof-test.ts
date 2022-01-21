import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';

import type { ExecutionResult } from '../execute';
import { execute } from '../execute';

const schema = buildSchema(`
  type Query {
    test(input: TestInputObject!): TestObject
  }

  input TestInputObject @oneOf {
    a: String
    b: Int
  }

  type TestObject @oneOf {
    a: String
    b: Int
  }

  schema {
    query: Query
  }
`);

function executeQuery(
  query: string,
  rootValue: unknown,
  variableValues?: { [variable: string]: unknown },
): ExecutionResult | Promise<ExecutionResult> {
  return execute({ schema, document: parse(query), rootValue, variableValues });
}

async function executeQueryAsync(
  query: string,
  rootValue: unknown,
  variableValues?: { [variable: string]: unknown },
): Promise<ExecutionResult> {
  const result = await execute({
    schema,
    document: parse(query),
    rootValue,
    variableValues,
  });
  return result;
}

describe('Execute: Handles OneOf Input Objects and OneOf Objects', () => {
  describe('OneOf Input Objects', () => {
    const rootValue = {
      test({ input }: { input: { a?: string; b?: number } }) {
        return input;
      },
    };

    it('accepts a good default value', () => {
      const query = `
        query ($input: TestInputObject! = {a: "abc"}) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: 'abc',
            b: null,
          },
        },
      });
    });

    it('rejects a bad default value', () => {
      const query = `
        query ($input: TestInputObject! = {a: "abc", b: 123}) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            locations: [{ column: 23, line: 3 }],
            message:
              'Argument "input" of non-null type "TestInputObject!" must not be null.',
            path: ['test'],
          },
        ],
      });
    });

    it('accepts a good variable', () => {
      const query = `
        query ($input: TestInputObject!) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { input: { a: 'abc' } });

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: 'abc',
            b: null,
          },
        },
      });
    });

    it('rejects a bad variable', () => {
      const query = `
        query ($input: TestInputObject!) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, {
        input: { a: 'abc', b: 123 },
      });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            locations: [{ column: 16, line: 2 }],
            message:
              'Variable "$input" got invalid value { a: "abc", b: 123 }; Exactly one key must be specified.',
          },
        ],
      });
    });
  });

  describe('OneOf Objects', () => {
    const query = `
        query ($input: TestInputObject! = {a: "abc"}) {
          test(input: $input) {
            a
            b
          }
        }
      `;

    it('works with a single, non-null value', () => {
      const rootValue = {
        test: {
          a: null,
          b: 123,
        },
      };
      const result = executeQuery(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: null,
            b: 123,
          },
        },
      });
    });

    it('works with a single, non-null, async value', async () => {
      const rootValue = {
        test() {
          return {
            a: null,
            b: () => new Promise((resolve) => resolve(123)),
          };
        },
      };
      const result = await executeQueryAsync(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: null,
            b: 123,
          },
        },
      });
    });

    it('errors when there are no non-null values', () => {
      const rootValue = {
        test: {
          a: null,
          b: null,
        },
      };
      const result = executeQuery(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: { test: null },
        errors: [
          {
            locations: [{ column: 11, line: 3 }],
            message:
              'OneOf Object "TestObject" must have exactly one non-null field but got 0.',
            path: ['test'],
          },
        ],
      });
    });

    it('errors when there are multiple non-null values', () => {
      const rootValue = {
        test: {
          a: 'abc',
          b: 456,
        },
      };
      const result = executeQuery(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: { test: null },
        errors: [
          {
            locations: [{ column: 11, line: 3 }],
            message:
              'OneOf Object "TestObject" must have exactly one non-null field but got 2.',
            path: ['test'],
          },
        ],
      });
    });

    it('errors when there are multiple non-null, async values', async () => {
      const rootValue = {
        test() {
          return {
            a: 'abc',
            b: () => new Promise((resolve) => resolve(123)),
          };
        },
      };
      const result = await executeQueryAsync(query, rootValue);

      expectJSON(result).toDeepEqual({
        data: { test: null },
        errors: [
          {
            locations: [{ column: 11, line: 3 }],
            message:
              'OneOf Object "TestObject" must have exactly one non-null field but got 2.',
            path: ['test'],
          },
        ],
      });
    });
  });
});
