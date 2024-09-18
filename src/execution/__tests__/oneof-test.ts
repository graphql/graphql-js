import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { parse } from '../../language/parser.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { execute } from '../execute.js';
import type { ExecutionResult } from '../types.js';

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
): ExecutionResult | Promise<ExecutionResult> {
  return execute({
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
              'Variable "$input" got invalid value { a: "abc", b: 123 }; Exactly one key must be specified for OneOf type "TestInputObject".',
          },
        ],
      });
    });

    it('rejects a variable with multiple keys, some set to null', () => {
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
              'Variable "$input" got invalid value { a: "abc", b: null }; Exactly one key must be specified for OneOf type "TestInputObject".',
          },
          {
            message:
              'Variable "$input" got invalid value null at "input.b"; Field "b" of OneOf type "TestInputObject" must be non-null.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('rejects a variable with multiple null keys', () => {
      const query = `
        query ($input: TestInputObject!) {
          test(input: $input) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, {
        input: { a: null, b: null },
      });

      expectJSON(result).toDeepEqual({
        errors: [
          {
            locations: [{ column: 16, line: 2 }],
            message:
              'Variable "$input" got invalid value { a: null, b: null }; Exactly one key must be specified for OneOf type "TestInputObject".',
          },
          {
            message:
              'Variable "$input" got invalid value null at "input.a"; Field "a" of OneOf type "TestInputObject" must be non-null.',
            locations: [{ line: 2, column: 16 }],
          },
          {
            message:
              'Variable "$input" got invalid value null at "input.b"; Field "b" of OneOf type "TestInputObject" must be non-null.',
            locations: [{ line: 2, column: 16 }],
          },
        ],
      });
    });

    it('accepts a valid variable for field', () => {
      const query = `
        query ($a: String!) {
          test(input: { a: $a }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: 'abc' });

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: 'abc',
            b: null,
          },
        },
      });
    });

    it('rejects multiple variables for fields', () => {
      const query = `
        query ($a: String!, $b: Int!) {
          test(input: { a: $a, b: $b }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: 'abc', b: 123 });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a, b: $b }.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects variable for field explicitly set to undefined', () => {
      const query = `
        query ($a: String) {
          test(input: { a: $a }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: undefined });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a }.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects nulled variable for field', () => {
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
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a }.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects missing variable for field', () => {
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
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a }.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects missing second variable for field', () => {
      const query = `
        query ($a: String, $b: String) {
          test(input: { a: $a, b: $b }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: '123' });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a, b: $b }.',
            locations: [{ line: 3, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('accepts a valid fragment variable for field', () => {
      const query = `
        query {
          ...TestFragment(a: "abc")
        }
        fragment TestFragment($a: String) on Query {
          test(input: { a: $a }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: 'abc' });

      expectJSON(result).toDeepEqual({
        data: {
          test: {
            a: 'abc',
            b: null,
          },
        },
      });
    });

    it('rejects multiple fragment variables for fields', () => {
      const query = `
        query {
          ...TestFragment(a: "abc", b: 123)
        }
        fragment TestFragment($a: String, $b: Int) on Query {
          test(input: { a: $a, b: $b }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: 'abc', b: 123 });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a, b: $b }.',
            locations: [{ line: 6, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects nulled fragment variable for field', () => {
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
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a }.',
            locations: [{ line: 6, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects missing fragment variable for field', () => {
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
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a }.',
            locations: [{ line: 6, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });

    it('rejects missing second fragment variable for field', () => {
      const query = `
        query {
          ...TestFragment(a: "123")
        }
        fragment TestFragment($a: String, $b: string) on Query {
          test(input: { a: $a, b: $b }) {
            a
            b
          }
        }
      `;
      const result = executeQuery(query, rootValue, { a: '123' });

      expectJSON(result).toDeepEqual({
        data: {
          test: null,
        },
        errors: [
          {
            // A nullable variable in a oneOf field position would be caught at validation-time
            // hence the vague error message here.
            message:
              'Argument "input" of type "TestInputObject!" has invalid value { a: $a, b: $b }.',
            locations: [{ line: 6, column: 23 }],
            path: ['test'],
          },
        ],
      });
    });
  });
});
