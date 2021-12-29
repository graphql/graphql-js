import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { parse } from '../../language/parser';

import { GraphQLNonNull, GraphQLObjectType } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import type { ExecutionResult } from '../execute';
import { execute, executeSync } from '../execute';

const syncError = new Error('sync');
const syncNonNullError = new Error('syncNonNull');
const promiseError = new Error('promise');
const promiseNonNullError = new Error('promiseNonNull');

const throwingData = {
  sync() {
    throw syncError;
  },
  syncNonNull() {
    throw syncNonNullError;
  },
  promise() {
    return new Promise(() => {
      throw promiseError;
    });
  },
  promiseNonNull() {
    return new Promise(() => {
      throw promiseNonNullError;
    });
  },
  syncNest() {
    return throwingData;
  },
  syncNonNullNest() {
    return throwingData;
  },
  promiseNest() {
    return new Promise((resolve) => {
      resolve(throwingData);
    });
  },
  promiseNonNullNest() {
    return new Promise((resolve) => {
      resolve(throwingData);
    });
  },
};

const nullingData = {
  sync() {
    return null;
  },
  syncNonNull() {
    return null;
  },
  promise() {
    return new Promise((resolve) => {
      resolve(null);
    });
  },
  promiseNonNull() {
    return new Promise((resolve) => {
      resolve(null);
    });
  },
  syncNest() {
    return nullingData;
  },
  syncNonNullNest() {
    return nullingData;
  },
  promiseNest() {
    return new Promise((resolve) => {
      resolve(nullingData);
    });
  },
  promiseNonNullNest() {
    return new Promise((resolve) => {
      resolve(nullingData);
    });
  },
};

const schema = buildSchema(`
  type DataType {
    sync: String
    syncNonNull: String!
    promise: String
    promiseNonNull: String!
    syncNest: DataType
    syncNonNullNest: DataType!
    promiseNest: DataType
    promiseNonNullNest: DataType!
  }

  schema {
    query: DataType
  }
`);

function executeQuery(
  query: string,
  rootValue: unknown,
): ExecutionResult | Promise<ExecutionResult> {
  return execute({ schema, document: parse(query), rootValue });
}

function patch(str: string): string {
  return str
    .replace(/\bsync\b/g, 'promise')
    .replace(/\bsyncNonNull\b/g, 'promiseNonNull');
}

// avoids also doing any nests
function patchData(data: ExecutionResult): ExecutionResult {
  return JSON.parse(patch(JSON.stringify(data)));
}

async function executeSyncAndAsync(query: string, rootValue: unknown) {
  const syncResult = executeSync({ schema, document: parse(query), rootValue });
  const asyncResult = await execute({
    schema,
    document: parse(patch(query)),
    rootValue,
  });

  expectJSON(asyncResult).toDeepEqual(patchData(syncResult));
  return syncResult;
}

describe('Execute: handles non-nullable types', () => {
  describe('nulls a nullable field', () => {
    const query = `
      {
        sync
      }
    `;

    it('that returns null', async () => {
      const result = await executeSyncAndAsync(query, nullingData);
      expect(result).to.deep.equal({
        data: { sync: null },
      });
    });

    it('that throws', async () => {
      const result = await executeSyncAndAsync(query, throwingData);
      expectJSON(result).toDeepEqual({
        data: { sync: null },
        errors: [
          {
            message: syncError.message,
            path: ['sync'],
            locations: [{ line: 3, column: 9 }],
          },
        ],
      });
    });
  });

  describe('nulls a returned object that contains a non-nullable field', () => {
    const query = `
      {
        syncNest {
          syncNonNull,
        }
      }
    `;

    it('that returns null', async () => {
      const result = await executeSyncAndAsync(query, nullingData);
      expectJSON(result).toDeepEqual({
        data: { syncNest: null },
        errors: [
          {
            message:
              'Cannot return null for non-nullable field DataType.syncNonNull.',
            path: ['syncNest', 'syncNonNull'],
            locations: [{ line: 4, column: 11 }],
          },
        ],
      });
    });

    it('that throws', async () => {
      const result = await executeSyncAndAsync(query, throwingData);
      expectJSON(result).toDeepEqual({
        data: { syncNest: null },
        errors: [
          {
            message: syncNonNullError.message,
            path: ['syncNest', 'syncNonNull'],
            locations: [{ line: 4, column: 11 }],
          },
        ],
      });
    });
  });

  describe('nulls a complex tree of nullable fields, each', () => {
    const query = `
      {
        syncNest {
          sync
          promise
          syncNest { sync promise }
          promiseNest { sync promise }
        }
        promiseNest {
          sync
          promise
          syncNest { sync promise }
          promiseNest { sync promise }
        }
      }
    `;
    const data = {
      syncNest: {
        sync: null,
        promise: null,
        syncNest: { sync: null, promise: null },
        promiseNest: { sync: null, promise: null },
      },
      promiseNest: {
        sync: null,
        promise: null,
        syncNest: { sync: null, promise: null },
        promiseNest: { sync: null, promise: null },
      },
    };

    it('that returns null', async () => {
      const result = await executeQuery(query, nullingData);
      expect(result).to.deep.equal({ data });
    });

    it('that throws', async () => {
      const result = await executeQuery(query, throwingData);
      expectJSON(result).toDeepEqual({
        data,
        errors: [
          {
            message: syncError.message,
            path: ['syncNest', 'sync'],
            locations: [{ line: 4, column: 11 }],
          },
          {
            message: syncError.message,
            path: ['syncNest', 'syncNest', 'sync'],
            locations: [{ line: 6, column: 22 }],
          },
          {
            message: syncError.message,
            path: ['syncNest', 'promiseNest', 'sync'],
            locations: [{ line: 7, column: 25 }],
          },
          {
            message: syncError.message,
            path: ['promiseNest', 'sync'],
            locations: [{ line: 10, column: 11 }],
          },
          {
            message: syncError.message,
            path: ['promiseNest', 'syncNest', 'sync'],
            locations: [{ line: 12, column: 22 }],
          },
          {
            message: promiseError.message,
            path: ['syncNest', 'promise'],
            locations: [{ line: 5, column: 11 }],
          },
          {
            message: promiseError.message,
            path: ['syncNest', 'syncNest', 'promise'],
            locations: [{ line: 6, column: 27 }],
          },
          {
            message: syncError.message,
            path: ['promiseNest', 'promiseNest', 'sync'],
            locations: [{ line: 13, column: 25 }],
          },
          {
            message: promiseError.message,
            path: ['syncNest', 'promiseNest', 'promise'],
            locations: [{ line: 7, column: 30 }],
          },
          {
            message: promiseError.message,
            path: ['promiseNest', 'promise'],
            locations: [{ line: 11, column: 11 }],
          },
          {
            message: promiseError.message,
            path: ['promiseNest', 'syncNest', 'promise'],
            locations: [{ line: 12, column: 27 }],
          },
          {
            message: promiseError.message,
            path: ['promiseNest', 'promiseNest', 'promise'],
            locations: [{ line: 13, column: 30 }],
          },
        ],
      });
    });
  });

  describe('nulls the first nullable object after a field in a long chain of non-null fields', () => {
    const query = `
      {
        syncNest {
          syncNonNullNest {
            promiseNonNullNest {
              syncNonNullNest {
                promiseNonNullNest {
                  syncNonNull
                }
              }
            }
          }
        }
        promiseNest {
          syncNonNullNest {
            promiseNonNullNest {
              syncNonNullNest {
                promiseNonNullNest {
                  syncNonNull
                }
              }
            }
          }
        }
        anotherNest: syncNest {
          syncNonNullNest {
            promiseNonNullNest {
              syncNonNullNest {
                promiseNonNullNest {
                  promiseNonNull
                }
              }
            }
          }
        }
        anotherPromiseNest: promiseNest {
          syncNonNullNest {
            promiseNonNullNest {
              syncNonNullNest {
                promiseNonNullNest {
                  promiseNonNull
                }
              }
            }
          }
        }
      }
    `;
    const data = {
      syncNest: null,
      promiseNest: null,
      anotherNest: null,
      anotherPromiseNest: null,
    };

    it('that returns null', async () => {
      const result = await executeQuery(query, nullingData);
      expectJSON(result).toDeepEqual({
        data,
        errors: [
          {
            message:
              'Cannot return null for non-nullable field DataType.syncNonNull.',
            path: [
              'syncNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNull',
            ],
            locations: [{ line: 8, column: 19 }],
          },
          {
            message:
              'Cannot return null for non-nullable field DataType.syncNonNull.',
            path: [
              'promiseNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNull',
            ],
            locations: [{ line: 19, column: 19 }],
          },
          {
            message:
              'Cannot return null for non-nullable field DataType.promiseNonNull.',
            path: [
              'anotherNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'promiseNonNull',
            ],
            locations: [{ line: 30, column: 19 }],
          },
          {
            message:
              'Cannot return null for non-nullable field DataType.promiseNonNull.',
            path: [
              'anotherPromiseNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'promiseNonNull',
            ],
            locations: [{ line: 41, column: 19 }],
          },
        ],
      });
    });

    it('that throws', async () => {
      const result = await executeQuery(query, throwingData);
      expectJSON(result).toDeepEqual({
        data,
        errors: [
          {
            message: syncNonNullError.message,
            path: [
              'syncNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNull',
            ],
            locations: [{ line: 8, column: 19 }],
          },
          {
            message: syncNonNullError.message,
            path: [
              'promiseNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNull',
            ],
            locations: [{ line: 19, column: 19 }],
          },
          {
            message: promiseNonNullError.message,
            path: [
              'anotherNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'promiseNonNull',
            ],
            locations: [{ line: 30, column: 19 }],
          },
          {
            message: promiseNonNullError.message,
            path: [
              'anotherPromiseNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'syncNonNullNest',
              'promiseNonNullNest',
              'promiseNonNull',
            ],
            locations: [{ line: 41, column: 19 }],
          },
        ],
      });
    });
  });

  describe('nulls the top level if non-nullable field', () => {
    const query = `
      {
        syncNonNull
      }
    `;

    it('that returns null', async () => {
      const result = await executeSyncAndAsync(query, nullingData);
      expectJSON(result).toDeepEqual({
        data: null,
        errors: [
          {
            message:
              'Cannot return null for non-nullable field DataType.syncNonNull.',
            path: ['syncNonNull'],
            locations: [{ line: 3, column: 9 }],
          },
        ],
      });
    });

    it('that throws', async () => {
      const result = await executeSyncAndAsync(query, throwingData);
      expectJSON(result).toDeepEqual({
        data: null,
        errors: [
          {
            message: syncNonNullError.message,
            path: ['syncNonNull'],
            locations: [{ line: 3, column: 9 }],
          },
        ],
      });
    });
  });

  describe('Handles non-null argument', () => {
    const schemaWithNonNullArg = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          withNonNullArg: {
            type: GraphQLString,
            args: {
              cannotBeNull: {
                type: new GraphQLNonNull(GraphQLString),
              },
            },
            resolve: (_, args) => 'Passed: ' + String(args.cannotBeNull),
          },
        },
      }),
    });

    it('succeeds when passed non-null literal value', () => {
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query {
            withNonNullArg (cannotBeNull: "literal value")
          }
        `),
      });

      expect(result).to.deep.equal({
        data: {
          withNonNullArg: 'Passed: literal value',
        },
      });
    });

    it('succeeds when passed non-null variable value', () => {
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query ($testVar: String!) {
            withNonNullArg (cannotBeNull: $testVar)
          }
        `),
        variableValues: {
          testVar: 'variable value',
        },
      });

      expect(result).to.deep.equal({
        data: {
          withNonNullArg: 'Passed: variable value',
        },
      });
    });

    it('succeeds when missing variable has default value', () => {
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query ($testVar: String = "default value") {
            withNonNullArg (cannotBeNull: $testVar)
          }
        `),
        variableValues: {
          // Intentionally missing variable
        },
      });

      expect(result).to.deep.equal({
        data: {
          withNonNullArg: 'Passed: default value',
        },
      });
    });

    it('field error when missing non-null arg', () => {
      // Note: validation should identify this issue first (missing args rule)
      // however execution should still protect against this.
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query {
            withNonNullArg
          }
        `),
      });

      expectJSON(result).toDeepEqual({
        data: {
          withNonNullArg: null,
        },
        errors: [
          {
            message:
              'Argument "cannotBeNull" of required type "String!" was not provided.',
            locations: [{ line: 3, column: 13 }],
            path: ['withNonNullArg'],
          },
        ],
      });
    });

    it('field error when non-null arg provided null', () => {
      // Note: validation should identify this issue first (values of correct
      // type rule) however execution should still protect against this.
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query {
            withNonNullArg(cannotBeNull: null)
          }
        `),
      });

      expectJSON(result).toDeepEqual({
        data: {
          withNonNullArg: null,
        },
        errors: [
          {
            message:
              'Argument "cannotBeNull" of non-null type "String!" must not be null.',
            locations: [{ line: 3, column: 42 }],
            path: ['withNonNullArg'],
          },
        ],
      });
    });

    it('field error when non-null arg not provided variable value', () => {
      // Note: validation should identify this issue first (variables in allowed
      // position rule) however execution should still protect against this.
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query ($testVar: String) {
            withNonNullArg(cannotBeNull: $testVar)
          }
        `),
        variableValues: {
          // Intentionally missing variable
        },
      });

      expectJSON(result).toDeepEqual({
        data: {
          withNonNullArg: null,
        },
        errors: [
          {
            message:
              'Argument "cannotBeNull" of required type "String!" was provided the variable "$testVar" which was not provided a runtime value.',
            locations: [{ line: 3, column: 42 }],
            path: ['withNonNullArg'],
          },
        ],
      });
    });

    it('field error when non-null arg provided variable with explicit null value', () => {
      const result = executeSync({
        schema: schemaWithNonNullArg,
        document: parse(`
          query ($testVar: String = "default value") {
            withNonNullArg (cannotBeNull: $testVar)
          }
        `),
        variableValues: {
          testVar: null,
        },
      });

      expectJSON(result).toDeepEqual({
        data: {
          withNonNullArg: null,
        },
        errors: [
          {
            message:
              'Argument "cannotBeNull" of non-null type "String!" must not be null.',
            locations: [{ line: 3, column: 43 }],
            path: ['withNonNullArg'],
          },
        ],
      });
    });
  });
});
