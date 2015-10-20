/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../execute';
import { formatError } from '../../error';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLString,
} from '../../type';

describe('Execute: Handles basic execution tasks', () => {
  it('executes arbitrary code', async () => {
    var data = {
      a() { return 'Apple'; },
      b() { return 'Banana'; },
      c() { return 'Cookie'; },
      d() { return 'Donut'; },
      e() { return 'Egg'; },
      f: 'Fish',
      pic(size) {
        return 'Pic of size: ' + (size || 50);
      },
      deep() { return deepData; },
      promise() { return promiseData(); }
    };

    var deepData = {
      a() { return 'Already Been Done'; },
      b() { return 'Boring'; },
      c() { return [ 'Contrived', undefined, 'Confusing' ]; },
      deeper() { return [ data, null, data ]; }
    };

    function promiseData() {
      return new Promise(resolve => {
        process.nextTick(() => {
          resolve(data);
        });
      });
    }

    var doc = `
      query Example($size: Int) {
        a,
        b,
        x: c
        ...c
        f
        ...on DataType {
          pic(size: $size)
          promise {
            a
          }
        }
        deep {
          a
          b
          c
          deeper {
            a
            b
          }
        }
      }

      fragment c on DataType {
        d
        e
      }
    `;

    var ast = parse(doc);
    var expected = {
      data: {
        a: 'Apple',
        b: 'Banana',
        x: 'Cookie',
        d: 'Donut',
        e: 'Egg',
        f: 'Fish',
        pic: 'Pic of size: 100',
        promise: { a: 'Apple' },
        deep: {
          a: 'Already Been Done',
          b: 'Boring',
          c: [ 'Contrived', null, 'Confusing' ],
          deeper: [
            { a: 'Apple', b: 'Banana' },
            null,
            { a: 'Apple', b: 'Banana' } ] } }
    };

    var DataType = new GraphQLObjectType({
      name: 'DataType',
      fields: () => ({
        a: { type: GraphQLString },
        b: { type: GraphQLString },
        c: { type: GraphQLString },
        d: { type: GraphQLString },
        e: { type: GraphQLString },
        f: { type: GraphQLString },
        pic: {
          args: { size: { type: GraphQLInt } },
          type: GraphQLString,
          resolve: (obj, { size }) => obj.pic(size)
        },
        deep: { type: DeepDataType },
        promise: { type: DataType },
      })
    });

    var DeepDataType = new GraphQLObjectType({
      name: 'DeepDataType',
      fields: {
        a: { type: GraphQLString },
        b: { type: GraphQLString },
        c: { type: new GraphQLList(GraphQLString) },
        deeper: { type: new GraphQLList(DataType) },
      }
    });

    var schema = new GraphQLSchema({
      query: DataType
    });

    expect(
      await execute(schema, ast, data, { size: 100 }, 'Example')
    ).to.deep.equal(expected);
  });

  it('merges parallel fragments', async () => {
    var ast = parse(`
      { a, ...FragOne, ...FragTwo }

      fragment FragOne on Type {
        b
        deep { b, deeper: deep { b } }
      }

      fragment FragTwo on Type {
        c
        deep { c, deeper: deep { c } }
      }
    `);

    var Type = new GraphQLObjectType({
      name: 'Type',
      fields: () => ({
        a: { type: GraphQLString, resolve: () => 'Apple' },
        b: { type: GraphQLString, resolve: () => 'Banana' },
        c: { type: GraphQLString, resolve: () => 'Cherry' },
        deep: { type: Type, resolve: () => ({}) },
      })
    });
    var schema = new GraphQLSchema({ query: Type });

    expect(
      await execute(schema, ast)
    ).to.deep.equal({
      data: {
        a: 'Apple',
        b: 'Banana',
        c: 'Cherry',
        deep: {
          b: 'Banana',
          c: 'Cherry',
          deeper: {
            b: 'Banana',
            c: 'Cherry' } } }
    });
  });

  it('threads context correctly', async () => {
    var doc = `query Example { a }`;

    var data = {
      contextThing: 'thing',
    };

    var resolvedContext;

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: {
            type: GraphQLString,
            resolve(context) {
              resolvedContext = context;
            }
          }
        }
      })
    });

    await execute(schema, parse(doc), data);

    expect(resolvedContext.contextThing).to.equal('thing');
  });

  it('correctly threads arguments', async () => {
    var doc = `
      query Example {
        b(numArg: 123, stringArg: "foo")
      }
    `;

    var resolvedArgs;

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          b: {
            args: {
              numArg: { type: GraphQLInt },
              stringArg: { type: GraphQLString }
            },
            type: GraphQLString,
            resolve(_, args) {
              resolvedArgs = args;
            }
          }
        }
      })
    });

    await execute(schema, parse(doc));

    expect(resolvedArgs.numArg).to.equal(123);
    expect(resolvedArgs.stringArg).to.equal('foo');
  });

  it('nulls out error subtrees', async () => {
    var doc = `{
      sync
      syncError
      syncRawError
      syncReturnError
      syncReturnErrorList
      async
      asyncReject
      asyncRawReject
      asyncEmptyReject
      asyncError
      asyncRawError
      asyncReturnError
    }`;

    var data = {
      sync() {
        return 'sync';
      },
      syncError() {
        throw new Error('Error getting syncError');
      },
      syncRawError() {
        /* eslint-disable */
        throw 'Error getting syncRawError';
        /* eslint-enable */
      },
      syncReturnError() {
        return new Error('Error getting syncReturnError');
      },
      syncReturnErrorList() {
        return [
          'sync0',
          new Error('Error getting syncReturnErrorList1'),
          'sync2',
          new Error('Error getting syncReturnErrorList3')
        ];
      },
      async() {
        return new Promise(resolve => resolve('async'));
      },
      asyncReject() {
        return new Promise((_, reject) =>
          reject(new Error('Error getting asyncReject'))
        );
      },
      asyncRawReject() {
        return Promise.reject('Error getting asyncRawReject');
      },
      asyncEmptyReject() {
        return Promise.reject();
      },
      asyncError() {
        return new Promise(() => {
          throw new Error('Error getting asyncError');
        });
      },
      asyncRawError() {
        return new Promise(() => {
          /* eslint-disable */
          throw 'Error getting asyncRawError';
          /* eslint-enable */
        });
      },
      asyncReturnError() {
        return Promise.resolve(new Error('Error getting asyncReturnError'));
      },
    };

    let ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          sync: { type: GraphQLString },
          syncError: { type: GraphQLString },
          syncRawError: { type: GraphQLString },
          syncReturnError: { type: GraphQLString },
          syncReturnErrorList: { type: new GraphQLList(GraphQLString) },
          async: { type: GraphQLString },
          asyncReject: { type: GraphQLString },
          asyncRawReject: { type: GraphQLString },
          asyncEmptyReject: { type: GraphQLString },
          asyncError: { type: GraphQLString },
          asyncRawError: { type: GraphQLString },
          asyncReturnError: { type: GraphQLString },
        }
      })
    });

    var result = await execute(schema, ast, data);

    expect(result.data).to.deep.equal({
      sync: 'sync',
      syncError: null,
      syncRawError: null,
      syncReturnError: null,
      syncReturnErrorList: [ 'sync0', null, 'sync2', null ],
      async: 'async',
      asyncReject: null,
      asyncRawReject: null,
      asyncEmptyReject: null,
      asyncError: null,
      asyncRawError: null,
      asyncReturnError: null,
    });

    expect(result.errors && result.errors.map(formatError)).to.deep.equal([
      { message: 'Error getting syncError',
        locations: [ { line: 3, column: 7 } ] },
      { message: 'Error getting syncRawError',
        locations: [ { line: 4, column: 7 } ] },
      { message: 'Error getting syncReturnError',
        locations: [ { line: 5, column: 7 } ] },
      { message: 'Error getting syncReturnErrorList1',
        locations: [ { line: 6, column: 7 } ] },
      { message: 'Error getting syncReturnErrorList3',
        locations: [ { line: 6, column: 7 } ] },
      { message: 'Error getting asyncReturnError',
        locations: [ { line: 13, column: 7 } ] },
      { message: 'Error getting asyncReject',
        locations: [ { line: 8, column: 7 } ] },
      { message: 'Error getting asyncRawReject',
        locations: [ { line: 9, column: 7 } ] },
      { message: 'An unknown error occurred.',
        locations: [ { line: 10, column: 7 } ] },
      { message: 'Error getting asyncError',
        locations: [ { line: 11, column: 7 } ] },
      { message: 'Error getting asyncRawError',
        locations: [ { line: 12, column: 7 } ] },
    ]);
  });

  it('uses the inline operation if no operation is provided', async () => {
    var doc = `{ a }`;
    var data = { a: 'b' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    var result = await execute(schema, ast, data);

    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the only operation if no operation is provided', async () => {
    var doc = `query Example { a }`;
    var data = { a: 'b' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    var result = await execute(schema, ast, data);

    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('throws if no operation is provided with multiple operations', () => {
    var doc = `query Example { a } query OtherExample { a }`;
    var data = { a: 'b' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    expect(() => execute(schema, ast, data)).to.throw(
      'Must provide operation name if query contains multiple operations.'
    );
  });

  it('uses the query schema for queries', async () => {
    var doc = `query Q { a } mutation M { c } subscription S { a }`;
    var data = { a: 'b', c: 'd' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        }
      }),
      mutation: new GraphQLObjectType({
        name: 'M',
        fields: {
          c: { type: GraphQLString },
        }
      }),
      subscription: new GraphQLObjectType({
        name: 'S',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    var queryResult = await execute(schema, ast, data, {}, 'Q');

    expect(queryResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the mutation schema for mutations', async () => {
    var doc = `query Q { a } mutation M { c }`;
    var data = { a: 'b', c: 'd' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        }
      }),
      mutation: new GraphQLObjectType({
        name: 'M',
        fields: {
          c: { type: GraphQLString },
        }
      })
    });

    var mutationResult = await execute(schema, ast, data, {}, 'M');

    expect(mutationResult).to.deep.equal({ data: { c: 'd' } });
  });

  it('uses the subscription schema for subscriptions', async () => {
    var doc = `query Q { a } subscription S { a }`;
    var data = { a: 'b', c: 'd' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        }
      }),
      subscription: new GraphQLObjectType({
        name: 'S',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    var subscriptionResult = await execute(schema, ast, data, {}, 'S');

    expect(subscriptionResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('correct field ordering despite execution order', async () => {
    var doc = `{
      a,
      b,
      c,
      d,
      e
    }`;

    var data = {
      a() {
        return 'a';
      },
      b() {
        return new Promise(resolve => resolve('b'));
      },
      c() {
        return 'c';
      },
      d() {
        return new Promise(resolve => resolve('d'));
      },
      e() {
        return 'e';
      },
    };

    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
          b: { type: GraphQLString },
          c: { type: GraphQLString },
          d: { type: GraphQLString },
          e: { type: GraphQLString },
        }
      })
    });

    var result = await execute(schema, ast, data);

    expect(result).to.deep.equal({
      data: {
        a: 'a',
        b: 'b',
        c: 'c',
        d: 'd',
        e: 'e',
      }
    });

    expect(Object.keys(result.data)).to.deep.equal([ 'a', 'b', 'c', 'd', 'e' ]);
  });

  it('Avoids recursion', async () => {
    var doc = `
      query Q {
        a
        ...Frag
        ...Frag
      }

      fragment Frag on Type {
        a,
        ...Frag
      }
    `;
    var data = { a: 'b' };
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      }),
    });

    var queryResult = await execute(schema, ast, data, {}, 'Q');

    expect(queryResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('does not include illegal fields in output', async () => {
    var doc = `mutation M {
      thisIsIllegalDontIncludeMe
    }`;
    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        }
      }),
      mutation: new GraphQLObjectType({
        name: 'M',
        fields: {
          c: { type: GraphQLString },
        }
      }),
    });

    var mutationResult = await execute(schema, ast);

    expect(mutationResult).to.deep.equal({
      data: {
      }
    });
  });

  it('does not include arguments that were not set', async () => {
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          field: {
            type: GraphQLString,
            resolve: (data, args) => args && JSON.stringify(args),
            args: {
              a: { type: GraphQLBoolean },
              b: { type: GraphQLBoolean },
              c: { type: GraphQLBoolean },
              d: { type: GraphQLInt },
              e: { type: GraphQLInt },
            },
          }
        }
      })
    });

    var query = parse('{ field(a: true, c: false, e: 0) }');
    var result = await execute(schema, query);

    expect(result).to.deep.equal({
      data: {
        field: '{"a":true,"c":false,"e":0}'
      }
    });
  });

  it('fails when an isTypeOf check is not met', async () => {
    class Special {
      constructor(value) {
        this.value = value;
      }
    }

    class NotSpecial {
      constructor(value) {
        this.value = value;
      }
    }

    var SpecialType = new GraphQLObjectType({
      name: 'SpecialType',
      isTypeOf(obj) {
        return obj instanceof Special;
      },
      fields: {
        value: { type: GraphQLString }
      }
    });

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          specials: {
            type: new GraphQLList(SpecialType),
            resolve: rootValue => rootValue.specials
          }
        }
      })
    });

    var query = parse('{ specials { value } }');
    var value = {
      specials: [ new Special('foo'), new NotSpecial('bar') ]
    };
    var result = await execute(schema, query, value);

    expect(result.data).to.deep.equal({
      specials: [
        { value: 'foo' },
        null
      ]
    });
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors).to.containSubset([
      { message:
          'Expected value of type "SpecialType" but got: [object Object].',
        locations: [ { line: 1, column: 3 } ] }
    ]);
  });

  it('fails to execute a query containing a type definition', async () => {
    var query = parse(`
      { foo }

      type Query { foo: String }
    `);

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: GraphQLString }
        }
      })
    });

    var caughtError;
    try {
      await execute(schema, query);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.deep.equal({
      message:
        'GraphQL cannot execute a request containing a ObjectTypeDefinition.'
    });
  });

});
