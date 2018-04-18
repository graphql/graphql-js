/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../execute';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
} from '../../type';

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
    return new Promise(resolve => {
      resolve(throwingData);
    });
  },
  promiseNonNullNest() {
    return new Promise(resolve => {
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
    return new Promise(resolve => {
      resolve(null);
    });
  },
  promiseNonNull() {
    return new Promise(resolve => {
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
    return new Promise(resolve => {
      resolve(nullingData);
    });
  },
  promiseNonNullNest() {
    return new Promise(resolve => {
      resolve(nullingData);
    });
  },
};

const dataType = new GraphQLObjectType({
  name: 'DataType',
  fields: () => ({
    sync: { type: GraphQLString },
    syncNonNull: { type: GraphQLNonNull(GraphQLString) },
    promise: { type: GraphQLString },
    promiseNonNull: { type: GraphQLNonNull(GraphQLString) },
    syncNest: { type: dataType },
    syncNonNullNest: { type: GraphQLNonNull(dataType) },
    promiseNest: { type: dataType },
    promiseNonNullNest: { type: GraphQLNonNull(dataType) },
  }),
});
const schema = new GraphQLSchema({
  query: dataType,
});

// avoids also doing any nests
function patch(data) {
  return JSON.parse(
    JSON.stringify(data)
      .replace(/\bsync\b/g, 'promise')
      .replace(/\bsyncNonNull\b/g, 'promiseNonNull'),
  );
}

function check(description, syncOnly, doc, expectedReturn, expectedThrow) {
  const descs = [
    [
      {
        doc,
        words: 'returns null',
        data: nullingData,
        expected: expectedReturn,
        sync: 'synchronously',
      },
      {
        doc,
        words: 'throws',
        data: throwingData,
        expected: { data: expectedReturn.data, ...expectedThrow },
        sync: 'synchronously',
      },
    ],
  ];
  if (!syncOnly) {
    descs.push(
      descs[0].map(d => ({
        ...d,
        doc: patch(d.doc),
        expected: patch(d.expected),
        sync: 'in a promise',
      })),
    );
  }
  descs.forEach(desc =>
    desc.forEach(desc2 =>
      it(description + ' that ' + desc2.words + ' ' + desc2.sync, async () =>
        expect(
          await execute(schema, parse(desc2.doc), desc2.data),
        ).to.containSubset(desc2.expected),
      ),
    ),
  );
}

describe('Execute: handles non-nullable types', () => {
  check(
    'nulls a nullable field',
    false,
    `
      query Q {
        sync
      }
    `,
    {
      data: {
        sync: null,
      },
    },
    {
      errors: [
        {
          message: syncError.message,
          locations: [{ line: 3, column: 9 }],
        },
      ],
    },
  );

  check(
    'nulls a synchronously returned object that contains a non-nullable field',
    false,
    `
      query Q {
        syncNest {
          syncNonNull,
        }
      }
    `,
    {
      data: {
        syncNest: null,
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.syncNonNull.',
          locations: [{ line: 4, column: 11 }],
        },
      ],
    },
    {
      errors: [
        {
          message: syncNonNullError.message,
          locations: [{ line: 4, column: 11 }],
        },
      ],
    },
  );

  check(
    'nulls an object returned in a promise that contains a non-nullable field',
    false,
    `
      query Q {
        promiseNest {
          syncNonNull,
        }
      }
    `,
    {
      data: {
        promiseNest: null,
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.syncNonNull.',
          locations: [{ line: 4, column: 11 }],
        },
      ],
    },
    {
      errors: [
        {
          message: syncNonNullError.message,
          locations: [{ line: 4, column: 11 }],
        },
      ],
    },
  );

  check(
    'nulls a complex tree of nullable fields, each',
    true,
    `
      query Q {
        syncNest {
          sync
          promise
          syncNest {
            sync
            promise
          }
          promiseNest {
            sync
            promise
          }
        }
        promiseNest {
          sync
          promise
          syncNest {
            sync
            promise
          }
          promiseNest {
            sync
            promise
          }
        }
      }
    `,
    {
      data: {
        syncNest: {
          sync: null,
          promise: null,
          syncNest: {
            sync: null,
            promise: null,
          },
          promiseNest: {
            sync: null,
            promise: null,
          },
        },
        promiseNest: {
          sync: null,
          promise: null,
          syncNest: {
            sync: null,
            promise: null,
          },
          promiseNest: {
            sync: null,
            promise: null,
          },
        },
      },
    },
    {
      errors: [
        {
          message: syncError.message,
          locations: [{ line: 4, column: 11 }],
        },
        {
          message: syncError.message,
          locations: [{ line: 7, column: 13 }],
        },
        {
          message: syncError.message,
          locations: [{ line: 11, column: 13 }],
        },
        {
          message: syncError.message,
          locations: [{ line: 16, column: 11 }],
        },
        {
          message: syncError.message,
          locations: [{ line: 19, column: 13 }],
        },
        {
          message: syncError.message,
          locations: [{ line: 23, column: 13 }],
        },
        {
          message: promiseError.message,
          locations: [{ line: 5, column: 11 }],
        },
        {
          message: promiseError.message,
          locations: [{ line: 8, column: 13 }],
        },
        {
          message: promiseError.message,
          locations: [{ line: 12, column: 13 }],
        },
        {
          message: promiseError.message,
          locations: [{ line: 17, column: 11 }],
        },
        {
          message: promiseError.message,
          locations: [{ line: 20, column: 13 }],
        },
        {
          message: promiseError.message,
          locations: [{ line: 24, column: 13 }],
        },
      ],
    },
  );

  check(
    'nulls the first nullable object after a field in a long chain of non-null fields',
    true,
    `
      query Q {
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
    `,
    {
      data: {
        syncNest: null,
        promiseNest: null,
        anotherNest: null,
        anotherPromiseNest: null,
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.syncNonNull.',
          locations: [{ line: 8, column: 19 }],
        },
        {
          message:
            'Cannot return null for non-nullable field DataType.syncNonNull.',
          locations: [{ line: 19, column: 19 }],
        },
        {
          message:
            'Cannot return null for non-nullable field DataType.promiseNonNull.',
          locations: [{ line: 30, column: 19 }],
        },
        {
          message:
            'Cannot return null for non-nullable field DataType.promiseNonNull.',
          locations: [{ line: 41, column: 19 }],
        },
      ],
    },
    {
      errors: [
        {
          message: syncNonNullError.message,
          locations: [{ line: 8, column: 19 }],
        },
        {
          message: syncNonNullError.message,
          locations: [{ line: 19, column: 19 }],
        },
        {
          message: promiseNonNullError.message,
          locations: [{ line: 30, column: 19 }],
        },
        {
          message: promiseNonNullError.message,
          locations: [{ line: 41, column: 19 }],
        },
      ],
    },
  );

  check(
    'nulls the top level if non-nullable field',
    false,
    `
      query Q { syncNonNull }
    `,
    {
      data: null,
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.syncNonNull.',
          locations: [{ line: 2, column: 17 }],
        },
      ],
    },
    {
      errors: [
        {
          message: syncNonNullError.message,
          locations: [{ line: 2, column: 17 }],
        },
      ],
    },
  );

  describe('Handles non-null argument', () => {
    const schemaWithNonNullArg = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          withNonNullArg: {
            type: GraphQLString,
            args: {
              cannotBeNull: {
                type: GraphQLNonNull(GraphQLString),
              },
            },
            resolve: async (_, args) => {
              if (typeof args.cannotBeNull === 'string') {
                return 'Passed: ' + args.cannotBeNull;
              }
            },
          },
        },
      }),
    });

    it('succeeds when passed non-null literal value', async () => {
      const result = await execute({
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

    it('succeeds when passed non-null variable value', async () => {
      const result = await execute({
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

    it('succeeds when missing variable has default value', async () => {
      const result = await execute({
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

    it('field error when missing non-null arg', async () => {
      // Note: validation should identify this issue first (missing args rule)
      // however execution should still protect against this.
      const result = await execute({
        schema: schemaWithNonNullArg,
        document: parse(`
          query {
            withNonNullArg
          }
        `),
      });

      expect(result).to.deep.equal({
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

    it('field error when non-null arg provided null', async () => {
      // Note: validation should identify this issue first (values of correct
      // type rule) however execution should still protect against this.
      const result = await execute({
        schema: schemaWithNonNullArg,
        document: parse(`
          query {
            withNonNullArg(cannotBeNull: null)
          }
        `),
      });

      expect(result).to.deep.equal({
        data: {
          withNonNullArg: null,
        },
        errors: [
          {
            message:
              'Argument "cannotBeNull" of non-null type "String!" must ' +
              'not be null.',
            locations: [{ line: 3, column: 42 }],
            path: ['withNonNullArg'],
          },
        ],
      });
    });

    it('field error when non-null arg not provided variable value', async () => {
      // Note: validation should identify this issue first (variables in allowed
      // position rule) however execution should still protect against this.
      const result = await execute({
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

      expect(result).to.deep.equal({
        data: {
          withNonNullArg: null,
        },
        errors: [
          {
            message:
              'Argument "cannotBeNull" of required type "String!" was ' +
              'provided the variable "$testVar" which was not provided a ' +
              'runtime value.',
            locations: [{ line: 3, column: 42 }],
            path: ['withNonNullArg'],
          },
        ],
      });
    });

    it('field error when non-null arg provided variable with explicit null value', async () => {
      const result = await execute({
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

      expect(result).to.deep.equal({
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
