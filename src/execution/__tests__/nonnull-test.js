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

function check(description, syncOnly, doc, expectedThrow, expectedReturn) {
  // const syncPromise = syncOnly ? [true] : [true, false];
  [
    { words: 'throws', data: throwingData, expected: expectedThrow },
    { words: 'returns null', data: nullingData, expected: expectedReturn },
  ].forEach(desc =>
    it(description + ' that ' + desc.words + ' synchronously', async () => {
      return expect(
        await execute(schema, parse(doc), desc.data),
      ).to.containSubset(desc.expected);
    }),
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
      errors: [
        {
          message: syncError.message,
          locations: [{ line: 3, column: 9 }],
        },
      ],
    },
    {
      data: {
        sync: null,
      },
    },
  );

  it('nulls a nullable field that throws in a promise', async () => {
    const doc = `
      query Q {
        promise
      }
    `;

    const ast = parse(doc);

    const expected = {
      data: {
        promise: null,
      },
      errors: [
        {
          message: promiseError.message,
          locations: [{ line: 3, column: 9 }],
        },
      ],
    };

    return expect(await execute(schema, ast, throwingData)).to.containSubset(
      expected,
    );
  });

  it('nulls a nullable field that returns null in a promise', async () => {
    const doc = `
      query Q {
        promise
      }
    `;

    const ast = parse(doc);

    const expected = {
      data: {
        promise: null,
      },
    };

    return expect(await execute(schema, ast, nullingData)).to.containSubset(
      expected,
    );
  });

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
          message: syncNonNullError.message,
          locations: [{ line: 4, column: 11 }],
        },
      ],
    },
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
  );

  it('nulls a synchronously returned object that contains a non-nullable field that throws in a promise', async () => {
    const doc = `
      query Q {
        syncNest {
          promiseNonNull,
        }
      }
    `;

    const ast = parse(doc);

    const expected = {
      data: {
        syncNest: null,
      },
      errors: [
        {
          message: promiseNonNullError.message,
          locations: [{ line: 4, column: 11 }],
        },
      ],
    };

    return expect(await execute(schema, ast, throwingData)).to.containSubset(
      expected,
    );
  });

  it('nulls a synchronously returned object that contains a non-nullable field that returns null in a promise', async () => {
    const doc = `
      query Q {
        syncNest {
          promiseNonNull,
        }
      }
    `;

    const ast = parse(doc);

    const expected = {
      data: {
        syncNest: null,
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.promiseNonNull.',
          locations: [{ line: 4, column: 11 }],
        },
      ],
    };

    return expect(await execute(schema, ast, nullingData)).to.containSubset(
      expected,
    );
  });

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
          message: syncNonNullError.message,
          locations: [{ line: 4, column: 11 }],
        },
      ],
    },
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
  );

  it('nulls an object returned in a promise that contains a non-nullable field that throws in a promise', async () => {
    const doc = `
      query Q {
        promiseNest {
          promiseNonNull,
        }
      }
    `;

    const ast = parse(doc);

    const expected = {
      data: {
        promiseNest: null,
      },
      errors: [
        {
          message: promiseNonNullError.message,
          locations: [{ line: 4, column: 11 }],
        },
      ],
    };

    return expect(await execute(schema, ast, throwingData)).to.containSubset(
      expected,
    );
  });

  it('nulls an object returned in a promise that contains a non-nullable field that returns null in a promise', async () => {
    const doc = `
      query Q {
        promiseNest {
          promiseNonNull,
        }
      }
    `;

    const ast = parse(doc);

    const expected = {
      data: {
        promiseNest: null,
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.promiseNonNull.',
          locations: [{ line: 4, column: 11 }],
        },
      ],
    };

    return expect(await execute(schema, ast, nullingData)).to.containSubset(
      expected,
    );
  });

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
          message: syncNonNullError.message,
          locations: [{ line: 2, column: 17 }],
        },
      ],
    },
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
  );

  it('nulls the top level if non-nullable field throws in a promise', async () => {
    const doc = `
      query Q { promiseNonNull }
    `;

    const expected = {
      data: null,
      errors: [
        {
          message: promiseNonNullError.message,
          locations: [{ line: 2, column: 17 }],
        },
      ],
    };

    return expect(
      await execute(schema, parse(doc), throwingData),
    ).to.containSubset(expected);
  });

  it('nulls the top level if non-nullable field returns null in a promise', async () => {
    const doc = `
      query Q { promiseNonNull }
    `;

    const expected = {
      data: null,
      errors: [
        {
          message:
            'Cannot return null for non-nullable field DataType.promiseNonNull.',
          locations: [{ line: 2, column: 17 }],
        },
      ],
    };

    return expect(
      await execute(schema, parse(doc), nullingData),
    ).to.containSubset(expected);
  });
});
