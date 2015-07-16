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
import { execute } from '../executor';
import { formatError } from '../../error';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLString,
} from '../../type';

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

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
      c() { return ['Contrived', undefined, 'Confusing']; },
      deeper() { return [data, null, data]; }
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

    return expect(await execute(schema, data, ast, 'Example', { size: 100 }))
                  .to.deep.equal(expected);
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

    return expect(
      await execute(schema, null, ast)
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

    var gotHere = false;

    var data = {
      contextThing: 'thing',
    };

    var ast = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: {
            type: GraphQLString,
            resolve(context) {
              expect(context.contextThing).to.equal('thing');
              gotHere = true;
            }
          }
        }
      })
    });

    execute(schema, data, ast, 'Example', {});

    expect(gotHere).to.equal(true);
  });

  it('correctly threads arguments', async () => {
    var doc = `
      query Example {
        b(numArg: 123, stringArg: "foo")
      }
    `;

    var gotHere = false;

    let docAst = parse(doc);
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
              expect(args.numArg).to.equal(123);
              expect(args.stringArg).to.equal('foo');
              gotHere = true;
            }
          }
        }
      })
    });
    execute(schema, null, docAst, 'Example', {});
    expect(gotHere).to.equal(true);
  });

  it('nulls out error subtrees', async () => {
    var doc = `{
      sync,
      syncError,
      async,
      asyncReject,
      asyncError
    }`;

    var data = {
      sync() {
        return 'sync';
      },
      syncError() {
        throw new Error('Error getting syncError');
      },
      async () {
        return new Promise(resolve => resolve('async'));
      },
      asyncReject() {
        return new Promise((_, reject) =>
          reject(new Error('Error getting asyncReject'))
        );
      },
      asyncError() {
        return new Promise(() => {
          throw new Error('Error getting asyncError');
        });
      }
    };

    let docAst = parse(doc);
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          sync: { type: GraphQLString },
          syncError: { type: GraphQLString },
          async: { type: GraphQLString },
          asyncReject: { type: GraphQLString },
          asyncError: { type: GraphQLString },
        }
      })
    });

    return execute(schema, data, docAst).then(result => {

      expect(result.data).to.deep.equal({
        sync: 'sync',
        syncError: null,
        async: 'async',
        asyncReject: null,
        asyncError: null,
      });

      expect(result.errors && result.errors.map(formatError)).to.deep.equal([
        { message: 'Error getting syncError',
          locations: [ { line: 3, column: 7 } ] },
        { message: 'Error getting asyncReject',
          locations: [ { line: 5, column: 7 } ] },
        { message: 'Error getting asyncError',
          locations: [ { line: 6, column: 7 } ] },
      ]);

    });
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
    var ex = execute(schema, data, ast);

    return expect(await ex).to.deep.equal({data: {a: 'b'}});
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
    var result = await execute(schema, data, ast);
    return expect(result).to.deep.equal({data: {a: 'b'}});
  });

  it('throws if no operation is provided with multiple operations', async () => {
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

    expect(() => execute(schema, data, ast)).to.throw(
      'Must provide operation name if query contains multiple operations.'
    );
  });

  it('uses the query schema for queries', async () => {
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
    var queryResult = await execute(schema, data, ast, 'Q');
    return expect(queryResult).to.deep.equal({data: {a: 'b'}});
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
    var mutationResult = await execute(schema, data, ast, 'M');
    return expect(mutationResult).to.deep.equal({data: {c: 'd'}});
  });

  it('responds with correct field ordering in presence of promises', async () => {
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

    var docAst = parse(doc);
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
    return execute(schema, data, docAst).then(
      result => {
        expect(result).to.deep.equal({
          data: {
            a: 'a',
            b: 'b',
            c: 'c',
            d: 'd',
            e: 'e',
          }
        });
        expect(Object.keys(result.data)).to.deep.equal(['a','b','c','d','e']);
      }
    );
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
    var queryResult = await execute(schema, data, ast, 'Q');
    return expect(queryResult).to.deep.equal({data: {a: 'b'}});
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
    var mutationResult = await execute(schema, null, ast);
    return expect(mutationResult).to.deep.equal({
      data: {
      }
    });
  });
});
