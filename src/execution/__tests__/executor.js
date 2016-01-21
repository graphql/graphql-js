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
    const data = {
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

    const deepData = {
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

    const doc = `
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

    const ast = parse(doc);
    const expected = {
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

    const DataType = new GraphQLObjectType({
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

    const DeepDataType = new GraphQLObjectType({
      name: 'DeepDataType',
      fields: {
        a: { type: GraphQLString },
        b: { type: GraphQLString },
        c: { type: new GraphQLList(GraphQLString) },
        deeper: { type: new GraphQLList(DataType) },
      }
    });

    const schema = new GraphQLSchema({
      query: DataType
    });

    expect(
      await execute(schema, ast, data, { size: 100 }, 'Example')
    ).to.deep.equal(expected);
  });

  it('merges parallel fragments', async () => {
    const ast = parse(`
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

    const Type = new GraphQLObjectType({
      name: 'Type',
      fields: () => ({
        a: { type: GraphQLString, resolve: () => 'Apple' },
        b: { type: GraphQLString, resolve: () => 'Banana' },
        c: { type: GraphQLString, resolve: () => 'Cherry' },
        deep: { type: Type, resolve: () => ({}) },
      })
    });
    const schema = new GraphQLSchema({ query: Type });

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
    const doc = `query Example { a }`;

    const data = {
      contextThing: 'thing',
    };

    let resolvedContext;

    const schema = new GraphQLSchema({
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
    const doc = `
      query Example {
        b(numArg: 123, stringArg: "foo")
      }
    `;

    let resolvedArgs;

    const schema = new GraphQLSchema({
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
    const doc = `{
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

    const data = {
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

    const ast = parse(doc);
    const schema = new GraphQLSchema({
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

    const result = await execute(schema, ast, data);

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
    const doc = `{ a }`;
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    const result = await execute(schema, ast, data);

    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the only operation if no operation is provided', async () => {
    const doc = `query Example { a }`;
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    const result = await execute(schema, ast, data);

    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('throws if no operation is provided with multiple operations', () => {
    const doc = `query Example { a } query OtherExample { a }`;
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
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
    const doc = `query Q { a } mutation M { c } subscription S { a }`;
    const data = { a: 'b', c: 'd' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
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

    const queryResult = await execute(schema, ast, data, {}, 'Q');

    expect(queryResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the mutation schema for mutations', async () => {
    const doc = `query Q { a } mutation M { c }`;
    const data = { a: 'b', c: 'd' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
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

    const mutationResult = await execute(schema, ast, data, {}, 'M');

    expect(mutationResult).to.deep.equal({ data: { c: 'd' } });
  });

  it('uses the subscription schema for subscriptions', async () => {
    const doc = `query Q { a } subscription S { a }`;
    const data = { a: 'b', c: 'd' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
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

    const subscriptionResult = await execute(schema, ast, data, {}, 'S');

    expect(subscriptionResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('correct field ordering despite execution order', async () => {
    const doc = `{
      a,
      b,
      c,
      d,
      e
    }`;

    const data = {
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

    const ast = parse(doc);
    const schema = new GraphQLSchema({
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

    const result = await execute(schema, ast, data);

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
    const doc = `
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
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      }),
    });

    const queryResult = await execute(schema, ast, data, {}, 'Q');

    expect(queryResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('does not include illegal fields in output', async () => {
    const doc = `mutation M {
      thisIsIllegalDontIncludeMe
    }`;
    const ast = parse(doc);
    const schema = new GraphQLSchema({
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

    const mutationResult = await execute(schema, ast);

    expect(mutationResult).to.deep.equal({
      data: {
      }
    });
  });

  it('does not include arguments that were not set', async () => {
    const schema = new GraphQLSchema({
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

    const query = parse('{ field(a: true, c: false, e: 0) }');
    const result = await execute(schema, query);

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

    const SpecialType = new GraphQLObjectType({
      name: 'SpecialType',
      isTypeOf(obj) {
        return obj instanceof Special;
      },
      fields: {
        value: { type: GraphQLString }
      }
    });

    const schema = new GraphQLSchema({
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

    const query = parse('{ specials { value } }');
    const value = {
      specials: [ new Special('foo'), new NotSpecial('bar') ]
    };
    const result = await execute(schema, query, value);

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
    const query = parse(`
      { foo }

      type Query { foo: String }
    `);

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: GraphQLString }
        }
      })
    });

    let caughtError;
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
