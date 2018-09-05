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
  GraphQLList,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
} from '../../type';

describe('Execute: Handles basic execution tasks', () => {
  it('throws if no document is provided', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    expect(() => execute(schema, null)).to.throw('Must provide document');
  });

  it('throws if no schema is provided', () => {
    expect(() =>
      execute({
        document: parse('{ field }'),
      }),
    ).to.throw('Expected undefined to be a GraphQL schema.');
  });

  it('accepts an object with named properties as arguments', () => {
    const doc = 'query Example { a }';

    const data = 'rootValue';

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: {
            type: GraphQLString,
            resolve(rootValue) {
              return rootValue;
            },
          },
        },
      }),
    });

    const result = execute({
      schema,
      document: parse(doc),
      rootValue: data,
    });

    expect(result).to.deep.equal({
      data: { a: 'rootValue' },
    });
  });

  it('executes arbitrary code', async () => {
    const data = {
      a() {
        return 'Apple';
      },
      b() {
        return 'Banana';
      },
      c() {
        return 'Cookie';
      },
      d() {
        return 'Donut';
      },
      e() {
        return 'Egg';
      },
      f: 'Fish',
      pic(size) {
        return 'Pic of size: ' + (size || 50);
      },
      deep() {
        return deepData;
      },
      promise() {
        return promiseData();
      },
    };

    const deepData = {
      a() {
        return 'Already Been Done';
      },
      b() {
        return 'Boring';
      },
      c() {
        return ['Contrived', undefined, 'Confusing'];
      },
      deeper() {
        return [data, null, data];
      },
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
          c: ['Contrived', null, 'Confusing'],
          deeper: [
            { a: 'Apple', b: 'Banana' },
            null,
            { a: 'Apple', b: 'Banana' },
          ],
        },
      },
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
          resolve: (obj, { size }) => obj.pic(size),
        },
        deep: { type: DeepDataType },
        promise: { type: DataType },
      }),
    });

    const DeepDataType = new GraphQLObjectType({
      name: 'DeepDataType',
      fields: {
        a: { type: GraphQLString },
        b: { type: GraphQLString },
        c: { type: GraphQLList(GraphQLString) },
        deeper: { type: GraphQLList(DataType) },
      },
    });

    const schema = new GraphQLSchema({
      query: DataType,
    });

    expect(
      await execute(schema, ast, data, null, { size: 100 }, 'Example'),
    ).to.deep.equal(expected);
  });

  it('merges parallel fragments', () => {
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
      }),
    });
    const schema = new GraphQLSchema({ query: Type });

    expect(execute(schema, ast)).to.deep.equal({
      data: {
        a: 'Apple',
        b: 'Banana',
        c: 'Cherry',
        deep: {
          b: 'Banana',
          c: 'Cherry',
          deeper: {
            b: 'Banana',
            c: 'Cherry',
          },
        },
      },
    });
  });

  it('provides info about current execution state', () => {
    const ast = parse('query ($var: String) { result: test }');

    let info;

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Test',
        fields: {
          test: {
            type: GraphQLString,
            resolve(val, args, ctx, _info) {
              info = _info;
            },
          },
        },
      }),
    });

    const rootValue = { root: 'val' };

    execute(schema, ast, rootValue, null, { var: 'abc' });

    expect(Object.keys(info)).to.deep.equal([
      'fieldName',
      'fieldNodes',
      'returnType',
      'parentType',
      'path',
      'schema',
      'fragments',
      'rootValue',
      'operation',
      'variableValues',
    ]);
    expect(info.fieldName).to.equal('test');
    expect(info.fieldNodes).to.have.lengthOf(1);
    expect(info.fieldNodes[0]).to.equal(
      ast.definitions[0].selectionSet.selections[0],
    );
    expect(info.returnType).to.equal(GraphQLString);
    expect(info.parentType).to.equal(schema.getQueryType());
    expect(info.path).to.deep.equal({ prev: undefined, key: 'result' });
    expect(info.schema).to.equal(schema);
    expect(info.rootValue).to.equal(rootValue);
    expect(info.operation).to.equal(ast.definitions[0]);
    expect(info.variableValues).to.deep.equal({ var: 'abc' });
  });

  it('threads root value context correctly', () => {
    const doc = 'query Example { a }';

    const data = {
      contextThing: 'thing',
    };

    let resolvedRootValue;

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: {
            type: GraphQLString,
            resolve(rootValue) {
              resolvedRootValue = rootValue;
            },
          },
        },
      }),
    });

    execute(schema, parse(doc), data);

    expect(resolvedRootValue.contextThing).to.equal('thing');
  });

  it('correctly threads arguments', () => {
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
              stringArg: { type: GraphQLString },
            },
            type: GraphQLString,
            resolve(_, args) {
              resolvedArgs = args;
            },
          },
        },
      }),
    });

    execute(schema, parse(doc));

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
      asyncReturnErrorWithExtensions
    }`;

    const data = {
      sync() {
        return 'sync';
      },
      syncError() {
        throw new Error('Error getting syncError');
      },
      syncRawError() {
        // eslint-disable-next-line no-throw-literal
        throw 'Error getting syncRawError';
      },
      syncReturnError() {
        return new Error('Error getting syncReturnError');
      },
      syncReturnErrorList() {
        return [
          'sync0',
          new Error('Error getting syncReturnErrorList1'),
          'sync2',
          new Error('Error getting syncReturnErrorList3'),
        ];
      },
      async() {
        return new Promise(resolve => resolve('async'));
      },
      asyncReject() {
        return new Promise((_, reject) =>
          reject(new Error('Error getting asyncReject')),
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
          // eslint-disable-next-line no-throw-literal
          throw 'Error getting asyncRawError';
        });
      },
      asyncReturnError() {
        return Promise.resolve(new Error('Error getting asyncReturnError'));
      },
      asyncReturnErrorWithExtensions() {
        const error = new Error('Error getting asyncReturnErrorWithExtensions');
        error.extensions = { foo: 'bar' };

        return Promise.resolve(error);
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
          syncReturnErrorList: { type: GraphQLList(GraphQLString) },
          async: { type: GraphQLString },
          asyncReject: { type: GraphQLString },
          asyncRejectWithExtensions: { type: GraphQLString },
          asyncRawReject: { type: GraphQLString },
          asyncEmptyReject: { type: GraphQLString },
          asyncError: { type: GraphQLString },
          asyncRawError: { type: GraphQLString },
          asyncReturnError: { type: GraphQLString },
          asyncReturnErrorWithExtensions: { type: GraphQLString },
        },
      }),
    });

    const result = await execute(schema, ast, data);

    expect(result).to.deep.equal({
      data: {
        sync: 'sync',
        syncError: null,
        syncRawError: null,
        syncReturnError: null,
        syncReturnErrorList: ['sync0', null, 'sync2', null],
        async: 'async',
        asyncReject: null,
        asyncRawReject: null,
        asyncEmptyReject: null,
        asyncError: null,
        asyncRawError: null,
        asyncReturnError: null,
        asyncReturnErrorWithExtensions: null,
      },
      errors: [
        {
          message: 'Error getting syncError',
          locations: [{ line: 3, column: 7 }],
          path: ['syncError'],
        },
        {
          message: 'Error getting syncRawError',
          locations: [{ line: 4, column: 7 }],
          path: ['syncRawError'],
        },
        {
          message: 'Error getting syncReturnError',
          locations: [{ line: 5, column: 7 }],
          path: ['syncReturnError'],
        },
        {
          message: 'Error getting syncReturnErrorList1',
          locations: [{ line: 6, column: 7 }],
          path: ['syncReturnErrorList', 1],
        },
        {
          message: 'Error getting syncReturnErrorList3',
          locations: [{ line: 6, column: 7 }],
          path: ['syncReturnErrorList', 3],
        },
        {
          message: 'Error getting asyncReject',
          locations: [{ line: 8, column: 7 }],
          path: ['asyncReject'],
        },
        {
          message: 'Error getting asyncRawReject',
          locations: [{ line: 9, column: 7 }],
          path: ['asyncRawReject'],
        },
        {
          message: '',
          locations: [{ line: 10, column: 7 }],
          path: ['asyncEmptyReject'],
        },
        {
          message: 'Error getting asyncError',
          locations: [{ line: 11, column: 7 }],
          path: ['asyncError'],
        },
        {
          message: 'Error getting asyncRawError',
          locations: [{ line: 12, column: 7 }],
          path: ['asyncRawError'],
        },
        {
          message: 'Error getting asyncReturnError',
          locations: [{ line: 13, column: 7 }],
          path: ['asyncReturnError'],
        },
        {
          message: 'Error getting asyncReturnErrorWithExtensions',
          locations: [{ line: 14, column: 7 }],
          path: ['asyncReturnErrorWithExtensions'],
          extensions: { foo: 'bar' },
        },
      ],
    });
  });

  it('nulls error subtree for promise rejection #1071', async () => {
    const query = `
      query {
        foods {
          name
        }
      }
    `;

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foods: {
            type: GraphQLList(
              new GraphQLObjectType({
                name: 'Food',
                fields: {
                  name: { type: GraphQLString },
                },
              }),
            ),
            resolve() {
              return Promise.reject(new Error('Dangit'));
            },
          },
        },
      }),
    });

    const ast = parse(query);
    const result = await execute(schema, ast);

    expect(result).to.deep.equal({
      data: {
        foods: null,
      },
      errors: [
        {
          locations: [
            {
              column: 9,
              line: 3,
            },
          ],
          message: 'Dangit',
          path: ['foods'],
        },
      ],
    });
  });

  it('Full response path is included for non-nullable fields', () => {
    const A = new GraphQLObjectType({
      name: 'A',
      fields: () => ({
        nullableA: {
          type: A,
          resolve: () => ({}),
        },
        nonNullA: {
          type: GraphQLNonNull(A),
          resolve: () => ({}),
        },
        throws: {
          type: GraphQLNonNull(GraphQLString),
          resolve: () => {
            throw new Error('Catch me if you can');
          },
        },
      }),
    });
    const queryType = new GraphQLObjectType({
      name: 'query',
      fields: () => ({
        nullableA: {
          type: A,
          resolve: () => ({}),
        },
      }),
    });
    const schema = new GraphQLSchema({
      query: queryType,
    });

    const query = `
      query {
        nullableA {
          aliasedA: nullableA {
            nonNullA {
              anotherA: nonNullA {
                throws
              }
            }
          }
        }
      }
    `;

    const result = execute(schema, parse(query));
    expect(result).to.deep.equal({
      data: {
        nullableA: {
          aliasedA: null,
        },
      },
      errors: [
        {
          message: 'Catch me if you can',
          locations: [{ line: 7, column: 17 }],
          path: ['nullableA', 'aliasedA', 'nonNullA', 'anotherA', 'throws'],
        },
      ],
    });
  });

  it('uses the inline operation if no operation name is provided', () => {
    const doc = '{ a }';
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const result = execute(schema, ast, data);

    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the only operation if no operation name is provided', () => {
    const doc = 'query Example { a }';
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const result = execute(schema, ast, data);

    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the named operation if operation name is provided', () => {
    const doc = 'query Example { first: a } query OtherExample { second: a }';
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const result = execute(schema, ast, data, null, null, 'OtherExample');

    expect(result).to.deep.equal({ data: { second: 'b' } });
  });

  it('provides error if no operation is provided', () => {
    const doc = 'fragment Example on Type { a }';
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const result = execute(schema, ast, data);
    expect(result).to.deep.equal({
      errors: [{ message: 'Must provide an operation.' }],
    });
  });

  it('errors if no op name is provided with multiple operations', () => {
    const doc = 'query Example { a } query OtherExample { a }';
    const data = { a: 'b' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const result = execute(schema, ast, data);
    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Must provide operation name if query contains multiple operations.',
        },
      ],
    });
  });

  it('errors if unknown operation name is provided', () => {
    const doc = 'query Example { a } query OtherExample { a }';
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const result = execute({
      schema,
      document: ast,
      operationName: 'UnknownExample',
    });
    expect(result).to.deep.equal({
      errors: [{ message: 'Unknown operation named "UnknownExample".' }],
    });
  });

  it('uses the query schema for queries', () => {
    const doc = 'query Q { a } mutation M { c } subscription S { a }';
    const data = { a: 'b', c: 'd' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'M',
        fields: {
          c: { type: GraphQLString },
        },
      }),
      subscription: new GraphQLObjectType({
        name: 'S',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const queryResult = execute(schema, ast, data, null, {}, 'Q');

    expect(queryResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the mutation schema for mutations', () => {
    const doc = 'query Q { a } mutation M { c }';
    const data = { a: 'b', c: 'd' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'M',
        fields: {
          c: { type: GraphQLString },
        },
      }),
    });

    const mutationResult = execute(schema, ast, data, null, {}, 'M');

    expect(mutationResult).to.deep.equal({ data: { c: 'd' } });
  });

  it('uses the subscription schema for subscriptions', () => {
    const doc = 'query Q { a } subscription S { a }';
    const data = { a: 'b', c: 'd' };
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      subscription: new GraphQLObjectType({
        name: 'S',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const subscriptionResult = execute(schema, ast, data, null, {}, 'S');

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
        },
      }),
    });

    const result = await execute(schema, ast, data);

    expect(result).to.deep.equal({
      data: {
        a: 'a',
        b: 'b',
        c: 'c',
        d: 'd',
        e: 'e',
      },
    });

    expect(Object.keys(result.data)).to.deep.equal(['a', 'b', 'c', 'd', 'e']);
  });

  it('Avoids recursion', () => {
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
        },
      }),
    });

    const queryResult = execute(schema, ast, data, null, {}, 'Q');

    expect(queryResult).to.deep.equal({ data: { a: 'b' } });
  });

  it('does not include illegal fields in output', () => {
    const doc = `mutation M {
      thisIsIllegalDoNotIncludeMe
    }`;
    const ast = parse(doc);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'M',
        fields: {
          c: { type: GraphQLString },
        },
      }),
    });

    const mutationResult = execute(schema, ast);

    expect(mutationResult).to.deep.equal({
      data: {},
    });
  });

  it('does not include arguments that were not set', () => {
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
          },
        },
      }),
    });

    const query = parse('{ field(a: true, c: false, e: 0) }');
    const result = execute(schema, query);

    expect(result).to.deep.equal({
      data: {
        field: '{"a":true,"c":false,"e":0}',
      },
    });
  });

  it('fails when an isTypeOf check is not met', () => {
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
        value: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          specials: {
            type: GraphQLList(SpecialType),
            resolve: rootValue => rootValue.specials,
          },
        },
      }),
    });

    const query = parse('{ specials { value } }');
    const value = {
      specials: [new Special('foo'), new NotSpecial('bar')],
    };
    const result = execute(schema, query, value);

    expect(result).to.deep.equal({
      data: {
        specials: [{ value: 'foo' }, null],
      },
      errors: [
        {
          message:
            'Expected value of type "SpecialType" but got: { value: "bar" }.',
          locations: [{ line: 1, column: 3 }],
          path: ['specials', 1],
        },
      ],
    });
  });

  it('executes ignoring invalid non-executable definitions', () => {
    const query = parse(`
      { foo }

      type Query { bar: String }
    `);

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    const result = execute(schema, query);
    expect(result).to.deep.equal({
      data: {
        foo: null,
      },
    });
  });

  it('uses a custom field resolver', () => {
    const document = parse('{ foo }');

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    // For the purposes of test, just return the name of the field!
    function customResolver(source, args, context, info) {
      return info.fieldName;
    }

    const result = execute({ schema, document, fieldResolver: customResolver });

    expect(result).to.deep.equal({ data: { foo: 'foo' } });
  });
});
