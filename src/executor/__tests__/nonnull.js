/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../executor';
import { GraphQLError } from '../../error';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull
} from '../../type';

var syncError = new GraphQLError('sync');
var nonNullSyncError = new GraphQLError('nonNullSync');
var promiseError = new GraphQLError('promise');
var nonNullPromiseError = new GraphQLError('nonNullPromise');

var throwingData = {
  sync() { throw syncError; },
  nonNullSync() { throw nonNullSyncError; },
  promise() {
    return new Promise(
      () => {
        throw promiseError;
      }
    );
  },
  nonNullPromise() {
    return new Promise(
      () => {
        throw nonNullPromiseError;
      }
    );
  },
  nest() {
    return throwingData;
  },
  nonNullNest() {
    return throwingData;
  },
  promiseNest() {
    return new Promise(
      (resolve) => {
        resolve(throwingData);
      }
    );
  },
  nonNullPromiseNest() {
    return new Promise(
      (resolve) => {
        resolve(throwingData);
      }
    );
  },
};

var nullingData = {
  sync() { return null; },
  nonNullSync() { return null; },
  promise() {
    return new Promise(
      (resolve) => {
        resolve(null);
      }
    );
  },
  nonNullPromise() {
    return new Promise(
      (resolve) => {
        resolve(null);
      }
    );
  },
  nest() {
    return nullingData;
  },
  nonNullNest() {
    return nullingData;
  },
  promiseNest() {
    return new Promise(
      (resolve) => {
        resolve(nullingData);
      }
    );
  },
  nonNullPromiseNest() {
    return new Promise(
      (resolve) => {
        resolve(nullingData);
      }
    );
  },
};

var dataType = new GraphQLObjectType({
  name: 'DataType',
  fields: () => ({
    sync: { type: GraphQLString },
    nonNullSync: { type: new GraphQLNonNull(GraphQLString) },
    promise: { type: GraphQLString },
    nonNullPromise: { type: new GraphQLNonNull(GraphQLString) },
    nest: { type: dataType },
    nonNullNest: { type: new GraphQLNonNull(dataType) },
    promiseNest: { type: dataType },
    nonNullPromiseNest: { type: new GraphQLNonNull(dataType) },
  })
});
var schema = new GraphQLSchema({
  query: dataType
});

describe('Execute: handles non-nullable types', () => {

  it('nulls a nullable field that throws synchronously', () => {
    var doc = `
      query Q {
        sync
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        sync: null,
      },
      errors: [
        { message: syncError.message,
          locations: [ { line: 3, column: 9 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a nullable field that throws in a promise', () => {
    var doc = `
      query Q {
        promise
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        promise: null,
      },
      errors: [
        { message: promiseError.message,
          locations: [ { line: 3, column: 9 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a synchronously returned object that contains a non-nullable field that throws synchronously', () => {
    var doc = `
      query Q {
        nest {
          nonNullSync,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null
      },
      errors: [
        { message: nonNullSyncError.message,
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a synchronously returned object that contains a non-nullable field that throws in a promise', () => {
    var doc = `
      query Q {
        nest {
          nonNullPromise,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null
      },
      errors: [
        { message: nonNullPromiseError.message,
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls an object returned in a promise that contains a non-nullable field that throws synchronously', () => {
    var doc = `
      query Q {
        promiseNest {
          nonNullSync,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        promiseNest: null
      },
      errors: [
        { message: nonNullSyncError.message,
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls an object returned in a promise that contains a non-nullable field that throws in a promise', () => {
    var doc = `
      query Q {
        promiseNest {
          nonNullPromise,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        promiseNest: null
      },
      errors: [
        { message: nonNullPromiseError.message,
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a complex tree of nullable fields that throw', () => {
    var doc = `
      query Q {
        nest {
          sync
          promise
          nest {
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
          nest {
            sync
            promise
          }
          promiseNest {
            sync
            promise
          }
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          sync: null,
          promise: null,
          nest: {
            sync: null,
            promise: null,
          },
          promiseNest: {
            sync: null,
            promise: null,
          }
        },
        promiseNest: {
          sync: null,
          promise: null,
          nest: {
            sync: null,
            promise: null,
          },
          promiseNest: {
            sync: null,
            promise: null,
          }
        }
      },
      errors: [
        { message: syncError.message,
          locations: [ { line: 4, column: 11 } ] },
        { message: syncError.message,
          locations: [ { line: 7, column: 13 } ] },
        { message: syncError.message,
          locations: [ { line: 11, column: 13 } ] },
        { message: syncError.message,
          locations: [ { line: 16, column: 11 } ] },
        { message: syncError.message,
          locations: [ { line: 19, column: 13 } ] },
        { message: syncError.message,
          locations: [ { line: 23, column: 13 } ] },
        { message: promiseError.message,
          locations: [ { line: 5, column: 11 } ] },
        { message: promiseError.message,
          locations: [ { line: 8, column: 13 } ] },
        { message: promiseError.message,
          locations: [ { line: 12, column: 13 } ] },
        { message: promiseError.message,
          locations: [ { line: 17, column: 11 } ] },
        { message: promiseError.message,
          locations: [ { line: 20, column: 13 } ] },
        { message: promiseError.message,
          locations: [ { line: 24, column: 13 } ] },
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls the first nullable object after a field throws in a long chain of fields that are non-null', () => {
    var doc = `
      query Q {
        nest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullSync
                }
              }
            }
          }
        }
        promiseNest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullSync
                }
              }
            }
          }
        }
        anotherNest: nest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullPromise
                }
              }
            }
          }
        }
        anotherPromiseNest: promiseNest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullPromise
                }
              }
            }
          }
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null,
        promiseNest: null,
        anotherNest: null,
        anotherPromiseNest: null
      },
      errors: [
        { message: nonNullSyncError.message,
          locations: [ { line: 8, column: 19 } ] },
        { message: nonNullSyncError.message,
          locations: [ { line: 19, column: 19 } ] },
        { message: nonNullPromiseError.message,
          locations: [ { line: 30, column: 19 } ] },
        { message: nonNullPromiseError.message,
          locations: [ { line: 41, column: 19 } ] }
      ]
    };

    return expect(execute(schema, throwingData, ast, 'Q', {}))
                  .to.become(expected);
  });


  it('nulls a nullable field that synchronously returns null', () => {
    var doc = `
      query Q {
        sync
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        sync: null,
      }
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a nullable field that returns null in a promise', () => {
    var doc = `
      query Q {
        promise
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        promise: null,
      }
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a synchronously returned object that contains a non-nullable field that returns null synchronously', () => {
    var doc = `
      query Q {
        nest {
          nonNullSync,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a synchronously returned object that contains a non-nullable field that returns null in a promise', () => {
    var doc = `
      query Q {
        nest {
          nonNullPromise,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls an object returned in a promise that contains a non-nullable field that returns null synchronously', () => {
    var doc = `
      query Q {
        promiseNest {
          nonNullSync,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        promiseNest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls an object returned in a promise that contains a non-nullable field that returns null ina a promise', () => {
    var doc = `
      query Q {
        promiseNest {
          nonNullPromise,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        promiseNest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls a complex tree of nullable fields that return null', () => {
    var doc = `
      query Q {
        nest {
          sync
          promise
          nest {
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
          nest {
            sync
            promise
          }
          promiseNest {
            sync
            promise
          }
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          sync: null,
          promise: null,
          nest: {
            sync: null,
            promise: null,
          },
          promiseNest: {
            sync: null,
            promise: null,
          }
        },
        promiseNest: {
          sync: null,
          promise: null,
          nest: {
            sync: null,
            promise: null,
          },
          promiseNest: {
            sync: null,
            promise: null,
          }
        }
      }
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls the first nullable object after a field returns null in a long chain of fields that are non-null', () => {
    var doc = `
      query Q {
        nest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullSync
                }
              }
            }
          }
        }
        promiseNest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullSync
                }
              }
            }
          }
        }
        anotherNest: nest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullPromise
                }
              }
            }
          }
        }
        anotherPromiseNest: promiseNest {
          nonNullNest {
            nonNullPromiseNest {
              nonNullNest {
                nonNullPromiseNest {
                  nonNullPromise
                }
              }
            }
          }
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null,
        promiseNest: null,
        anotherNest: null,
        anotherPromiseNest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 8, column: 19 } ] },
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 19, column: 19 } ] },
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 30, column: 19 } ] },
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 41, column: 19 } ] }
      ]
    };

    return expect(execute(schema, nullingData, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('nulls the top level if sync non-nullable field throws', () => {
    var doc = `
      query Q { nonNullSync }
    `;

    var expected = {
      data: null,
      errors: [
        { message: nonNullSyncError.message,
          locations: [ { line: 2, column: 17 } ] }
      ]
    };

    return expect(execute(schema, throwingData, parse(doc)))
                  .to.become(expected);
  });

  it('nulls the top level if async non-nullable field errors', () => {
    var doc = `
      query Q { nonNullPromise }
    `;

    var expected = {
      data: null,
      errors: [
        { message: nonNullPromiseError.message,
          locations: [ { line: 2, column: 17 } ] }
      ]
    };

    return expect(execute(schema, throwingData, parse(doc)))
                  .to.become(expected);
  });

  it('nulls the top level if sync non-nullable field returns null', () => {
    var doc = `
      query Q { nonNullSync }
    `;

    var expected = {
      data: null,
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 2, column: 17 } ] }
      ]
    };

    return expect(execute(schema, nullingData, parse(doc)))
                  .to.become(expected);
  });

  it('nulls the top level if async non-nullable field resolves null', () => {
    var doc = `
      query Q { nonNullPromise }
    `;

    var expected = {
      data: null,
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 2, column: 17 } ] }
      ]
    };

    return expect(execute(schema, nullingData, parse(doc)))
                  .to.become(expected);
  });
});
