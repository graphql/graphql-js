import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { parse } from '../../language/parser.js';

import type { ExecutionResult } from '../../execution/types.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { executeSync } from './execute.js';

const schema = buildSchema(`
  type Query {
    test(input: TestInputObject!): TestObject
  }

  input TestInputObject @oneOf {
    a: String
    b: Int
  }

  type TestObject {
    a: String
    b: Int
  }
`);

function executeQuery(
  query: string,
  rootValue: unknown,
  variableValues?: { [variable: string]: unknown },
): ExecutionResult {
  return executeSync({
    schema,
    document: parse(query, { experimentalFragmentArguments: true }),
    rootValue,
    variableValues,
  });
}

describe('Execute: Handles OneOf Input Objects', () => {
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
              // This type of error would be caught at validation-time
              // hence the vague error message here.
              'Argument "Query.test(input:)" has invalid value: Expected variable "$input" provided to type "TestInputObject!" to provide a runtime value.',
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

    it('accepts a good variable with an undefined key', () => {
      const query = `
        query ($input: TestInputObject!) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, {
        input: { a: 'abc', b: undefined },
      });

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: 'abc',
            b: null,
          },
        },
      });
    });

    it('rejects a variable with a nulled key', () => {
      const query = `
        query ($input: TestInputObject!) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { input: { a: null } });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            message:
              'Variable "$input" has invalid value: Field "a" for OneOf type "TestInputObject" must be non-null.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('rejects a variable with multiple non-null keys', () => {
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
              'Variable "$input" has invalid value: Exactly one key must be specified for OneOf type "TestInputObject".',
          },
        ],
      });
    });

    it('rejects a variable with multiple nullable keys', () => {
      const query = `
        query ($input: TestInputObject!) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, {
        input: { a: 'abc', b: null },
      });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            locations: [{ column: 16, line: 2 }],
            message:
              'Variable "$input" has invalid value: Exactly one key must be specified for OneOf type "TestInputObject".',
          },
        ],
      });
    });

    it('errors with nulled variable for field', () => {
      const query = `
        query ($a: String) {
          test(input: { a: $a }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: null });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "Query.test(input:)" has invalid value: Expected variable "$a" provided to field "a" for OneOf Input Object type "TestInputObject" not to be null.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('errors with missing variable for field', () => {
      const query = `
        query ($a: String) {
          test(input: { a: $a }) {
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
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "Query.test(input:)" has invalid value: Expected variable "$a" provided to field "a" for OneOf Input Object type "TestInputObject" to provide a runtime value.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('errors with nulled fragment variable for field', () => {
      const query = `
        query {
          ...TestFragment(a: null)
        }
        fragment TestFragment($a: String) on Query {
          test(input: { a: $a }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: null });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "Query.test(input:)" has invalid value: Expected variable "$a" provided to field "a" for OneOf Input Object type "TestInputObject" not to be null.',
            locations: [{ line: 6, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('errors with missing fragment variable for field', () => {
      const query = `
        query {
          ...TestFragment
        }
        fragment TestFragment($a: String) on Query {
          test(input: { a: $a }) {
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
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "Query.test(input:)" has invalid value: Expected variable "$a" provided to field "a" for OneOf Input Object type "TestInputObject" to provide a runtime value.',
            locations: [{ line: 6, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });
  });
});
