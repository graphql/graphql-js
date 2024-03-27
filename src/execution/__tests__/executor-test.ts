import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import type { IAbortSignal, IEvent } from '../../jsutils/AbortController.js';
import { inspect } from '../../jsutils/inspect.js';

import { Kind } from '../../language/kinds.js';
import { parse } from '../../language/parser.js';

import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../../type/definition.js';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.js';
import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { execute, executeSync } from '../execute.js';

describe('Execute: Handles basic execution tasks', () => {
  it('executes arbitrary code', async () => {
    const data = {
      a: () => 'Apple',
      b: () => 'Banana',
      c: () => 'Cookie',
      d: () => 'Donut',
      e: () => 'Egg',
      f: 'Fish',
      // Called only by DataType::pic static resolver
      pic: (size: number) => 'Pic of size: ' + size,
      deep: () => deepData,
      promise: promiseData,
    };

    const deepData = {
      a: () => 'Already Been Done',
      b: () => 'Boring',
      c: () => ['Contrived', undefined, 'Confusing'],
      deeper: () => [data, null, data],
    };

    function promiseData() {
      return Promise.resolve(data);
    }

    const DataType: GraphQLObjectType = new GraphQLObjectType({
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
        c: { type: new GraphQLList(GraphQLString) },
        deeper: { type: new GraphQLList(DataType) },
      },
    });

    const document = parse(`
      query ($size: Int) {
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
    `);

    const result = await execute({
      schema: new GraphQLSchema({ query: DataType }),
      document,
      rootValue: data,
      variableValues: { size: 100 },
    });

    expect(result).to.deep.equal({
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
    });
  });

  it('merges parallel fragments', () => {
    const Type: GraphQLObjectType = new GraphQLObjectType({
      name: 'Type',
      fields: () => ({
        a: { type: GraphQLString, resolve: () => 'Apple' },
        b: { type: GraphQLString, resolve: () => 'Banana' },
        c: { type: GraphQLString, resolve: () => 'Cherry' },
        deep: { type: Type, resolve: () => ({}) },
      }),
    });
    const schema = new GraphQLSchema({ query: Type });

    const document = parse(`
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

    const result = executeSync({ schema, document });
    expect(result).to.deep.equal({
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
    let resolvedInfo;
    const testType = new GraphQLObjectType({
      name: 'Test',
      fields: {
        test: {
          type: GraphQLString,
          resolve(_val, _args, _ctx, info) {
            resolvedInfo = info;
          },
        },
      },
    });
    const schema = new GraphQLSchema({ query: testType });

    const document = parse('query ($var: String) { result: test }');
    const rootValue = { root: 'val' };
    const variableValues = { var: 'abc' };

    executeSync({ schema, document, rootValue, variableValues });

    expect(resolvedInfo).to.have.all.keys(
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
      'signal',
    );

    const operation = document.definitions[0];
    assert(operation.kind === Kind.OPERATION_DEFINITION);

    expect(resolvedInfo).to.include({
      fieldName: 'test',
      returnType: GraphQLString,
      parentType: testType,
      schema,
      rootValue,
      operation,
    });

    const field = operation.selectionSet.selections[0];
    expect(resolvedInfo).to.deep.include({
      fieldNodes: [field],
      path: { prev: undefined, key: 'result', typename: 'Test' },
      variableValues: { var: 'abc' },
    });
  });

  it('populates path correctly with complex types', () => {
    let path;
    const someObject = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        test: {
          type: GraphQLString,
          resolve(_val, _args, _ctx, info) {
            path = info.path;
          },
        },
      },
    });
    const someUnion = new GraphQLUnionType({
      name: 'SomeUnion',
      types: [someObject],
      resolveType() {
        return 'SomeObject';
      },
    });
    const testType = new GraphQLObjectType({
      name: 'SomeQuery',
      fields: {
        test: {
          type: new GraphQLNonNull(
            new GraphQLList(new GraphQLNonNull(someUnion)),
          ),
        },
      },
    });
    const schema = new GraphQLSchema({ query: testType });
    const rootValue = { test: [{}] };
    const document = parse(`
      query {
        l1: test {
          ... on SomeObject {
            l2: test
          }
        }
      }
    `);

    executeSync({ schema, document, rootValue });

    expect(path).to.deep.equal({
      key: 'l2',
      typename: 'SomeObject',
      prev: {
        key: 0,
        typename: undefined,
        prev: {
          key: 'l1',
          typename: 'SomeQuery',
          prev: undefined,
        },
      },
    });
  });

  it('threads root value context correctly', () => {
    let resolvedRootValue;
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: {
            type: GraphQLString,
            resolve(rootValueArg) {
              resolvedRootValue = rootValueArg;
            },
          },
        },
      }),
    });

    const document = parse('query Example { a }');
    const rootValue = { contextThing: 'thing' };

    executeSync({ schema, document, rootValue });
    expect(resolvedRootValue).to.equal(rootValue);
  });

  it('correctly threads arguments', () => {
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

    const document = parse(`
      query Example {
        b(numArg: 123, stringArg: "foo")
      }
    `);

    executeSync({ schema, document });
    expect(resolvedArgs).to.deep.equal({ numArg: 123, stringArg: 'foo' });
  });

  it('nulls out error subtrees', async () => {
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

    const document = parse(`
      {
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
      }
    `);

    const rootValue = {
      sync() {
        return 'sync';
      },
      syncError() {
        throw new Error('Error getting syncError');
      },
      syncRawError() {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
        return new Promise((resolve) => resolve('async'));
      },
      asyncReject() {
        return new Promise((_, reject) =>
          reject(new Error('Error getting asyncReject')),
        );
      },
      asyncRawReject() {
        // eslint-disable-next-line prefer-promise-reject-errors
        return Promise.reject('Error getting asyncRawReject');
      },
      asyncEmptyReject() {
        // eslint-disable-next-line prefer-promise-reject-errors
        return Promise.reject();
      },
      asyncError() {
        return new Promise(() => {
          throw new Error('Error getting asyncError');
        });
      },
      asyncRawError() {
        return new Promise(() => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw 'Error getting asyncRawError';
        });
      },
      asyncReturnError() {
        return Promise.resolve(new Error('Error getting asyncReturnError'));
      },
      asyncReturnErrorWithExtensions() {
        const error = new Error('Error getting asyncReturnErrorWithExtensions');
        // @ts-expect-error
        error.extensions = { foo: 'bar' };

        return Promise.resolve(error);
      },
    };

    const result = await execute({ schema, document, rootValue });
    expectJSON(result).toDeepEqual({
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
          locations: [{ line: 4, column: 9 }],
          path: ['syncError'],
        },
        {
          message: 'Unexpected error value: "Error getting syncRawError"',
          locations: [{ line: 5, column: 9 }],
          path: ['syncRawError'],
        },
        {
          message: 'Error getting syncReturnError',
          locations: [{ line: 6, column: 9 }],
          path: ['syncReturnError'],
        },
        {
          message: 'Error getting syncReturnErrorList1',
          locations: [{ line: 7, column: 9 }],
          path: ['syncReturnErrorList', 1],
        },
        {
          message: 'Error getting syncReturnErrorList3',
          locations: [{ line: 7, column: 9 }],
          path: ['syncReturnErrorList', 3],
        },
        {
          message: 'Error getting asyncReject',
          locations: [{ line: 9, column: 9 }],
          path: ['asyncReject'],
        },
        {
          message: 'Unexpected error value: "Error getting asyncRawReject"',
          locations: [{ line: 10, column: 9 }],
          path: ['asyncRawReject'],
        },
        {
          message: 'Unexpected error value: undefined',
          locations: [{ line: 11, column: 9 }],
          path: ['asyncEmptyReject'],
        },
        {
          message: 'Error getting asyncError',
          locations: [{ line: 12, column: 9 }],
          path: ['asyncError'],
        },
        {
          message: 'Unexpected error value: "Error getting asyncRawError"',
          locations: [{ line: 13, column: 9 }],
          path: ['asyncRawError'],
        },
        {
          message: 'Error getting asyncReturnError',
          locations: [{ line: 14, column: 9 }],
          path: ['asyncReturnError'],
        },
        {
          message: 'Error getting asyncReturnErrorWithExtensions',
          locations: [{ line: 15, column: 9 }],
          path: ['asyncReturnErrorWithExtensions'],
          extensions: { foo: 'bar' },
        },
      ],
    });
  });

  it('nulls error subtree for promise rejection #1071', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foods: {
            type: new GraphQLList(
              new GraphQLObjectType({
                name: 'Food',
                fields: {
                  name: { type: GraphQLString },
                },
              }),
            ),
            resolve() {
              return Promise.reject(new Error('Oops'));
            },
          },
        },
      }),
    });

    const document = parse(`
      query {
        foods {
          name
        }
      }
    `);

    const result = await execute({ schema, document });

    expectJSON(result).toDeepEqual({
      data: { foods: null },
      errors: [
        {
          locations: [{ column: 9, line: 3 }],
          message: 'Oops',
          path: ['foods'],
        },
      ],
    });
  });

  it('handles sync errors combined with rejections', async () => {
    let isAsyncResolverFinished = false;

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          syncNullError: {
            type: new GraphQLNonNull(GraphQLString),
            resolve: () => null,
          },
          asyncNullError: {
            type: new GraphQLNonNull(GraphQLString),
            async resolve() {
              await resolveOnNextTick();
              await resolveOnNextTick();
              await resolveOnNextTick();
              isAsyncResolverFinished = true;
              return null;
            },
          },
        },
      }),
    });

    // Order is important here, as the promise has to be created before the synchronous error is thrown
    const document = parse(`
      {
        asyncNullError
        syncNullError
      }
    `);

    const result = execute({ schema, document });

    expect(isAsyncResolverFinished).to.equal(false);
    expectJSON(await result).toDeepEqual({
      data: null,
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Query.syncNullError.',
          locations: [{ line: 4, column: 9 }],
          path: ['syncNullError'],
        },
      ],
    });
    expect(isAsyncResolverFinished).to.equal(true);
  });

  it('Full response path is included for non-nullable fields', () => {
    const A: GraphQLObjectType = new GraphQLObjectType({
      name: 'A',
      fields: () => ({
        nullableA: {
          type: A,
          resolve: () => ({}),
        },
        nonNullA: {
          type: new GraphQLNonNull(A),
          resolve: () => ({}),
        },
        throws: {
          type: new GraphQLNonNull(GraphQLString),
          resolve: () => {
            throw new Error('Catch me if you can');
          },
        },
      }),
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'query',
        fields: () => ({
          nullableA: {
            type: A,
            resolve: () => ({}),
          },
        }),
      }),
    });

    const document = parse(`
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
    `);

    const result = executeSync({ schema, document });
    expectJSON(result).toDeepEqual({
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
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse('{ a }');
    const rootValue = { a: 'b' };

    const result = executeSync({ schema, document, rootValue });
    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the only operation if no operation name is provided', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse('query Example { a }');
    const rootValue = { a: 'b' };

    const result = executeSync({ schema, document, rootValue });
    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the named operation if operation name is provided', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });

    const document = parse(`
      query Example { first: a }
      query OtherExample { second: a }
    `);
    const rootValue = { a: 'b' };
    const operationName = 'OtherExample';

    const result = executeSync({ schema, document, rootValue, operationName });
    expect(result).to.deep.equal({ data: { second: 'b' } });
  });

  it('provides error if no operation is provided', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse('fragment Example on Type { a }');
    const rootValue = { a: 'b' };

    const result = executeSync({ schema, document, rootValue });
    expectJSON(result).toDeepEqual({
      errors: [{ message: 'Must provide an operation.' }],
    });
  });

  it('errors if no op name is provided with multiple operations', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse(`
      query Example { a }
      query OtherExample { a }
    `);

    const result = executeSync({ schema, document });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Must provide operation name if query contains multiple operations.',
        },
      ],
    });
  });

  it('errors if unknown operation name is provided', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse(`
      query Example { a }
      query OtherExample { a }
    `);
    const operationName = 'UnknownExample';

    const result = executeSync({ schema, document, operationName });
    expectJSON(result).toDeepEqual({
      errors: [{ message: 'Unknown operation named "UnknownExample".' }],
    });
  });

  it('errors if empty string is provided as operation name', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse('{ a }');
    const operationName = '';

    const result = executeSync({ schema, document, operationName });
    expectJSON(result).toDeepEqual({
      errors: [{ message: 'Unknown operation named "".' }],
    });
  });

  it('uses the query schema for queries', () => {
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
    const document = parse(`
      query Q { a }
      mutation M { c }
      subscription S { a }
    `);
    const rootValue = { a: 'b', c: 'd' };
    const operationName = 'Q';

    const result = executeSync({ schema, document, rootValue, operationName });
    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('uses the mutation schema for mutations', () => {
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
    const document = parse(`
      query Q { a }
      mutation M { c }
    `);
    const rootValue = { a: 'b', c: 'd' };
    const operationName = 'M';

    const result = executeSync({ schema, document, rootValue, operationName });
    expect(result).to.deep.equal({ data: { c: 'd' } });
  });

  it('uses the subscription schema for subscriptions', () => {
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
    const document = parse(`
      query Q { a }
      subscription S { a }
    `);
    const rootValue = { a: 'b', c: 'd' };
    const operationName = 'S';

    const result = executeSync({ schema, document, rootValue, operationName });
    expect(result).to.deep.equal({ data: { a: 'b' } });
  });

  it('errors when using original execute with schemas including experimental @defer directive', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      directives: [GraphQLDeferDirective],
    });
    const document = parse('query Q { a }');

    expect(() => execute({ schema, document })).to.throw(
      'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.',
    );
  });

  it('errors when using original execute with schemas including experimental @stream directive', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      directives: [GraphQLStreamDirective],
    });
    const document = parse('query Q { a }');

    expect(() => execute({ schema, document })).to.throw(
      'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.',
    );
  });

  it('resolves to an error if schema does not support operation', () => {
    const schema = new GraphQLSchema({ assumeValid: true });

    const document = parse(`
      query Q { __typename }
      mutation M { __typename }
      subscription S { __typename }
    `);

    expectJSON(
      executeSync({ schema, document, operationName: 'Q' }),
    ).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Schema is not configured to execute query operation.',
          locations: [{ line: 2, column: 7 }],
        },
      ],
    });

    expectJSON(
      executeSync({ schema, document, operationName: 'M' }),
    ).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Schema is not configured to execute mutation operation.',
          locations: [{ line: 3, column: 7 }],
        },
      ],
    });

    expectJSON(
      executeSync({ schema, document, operationName: 'S' }),
    ).toDeepEqual({
      data: null,
      errors: [
        {
          message:
            'Schema is not configured to execute subscription operation.',
          locations: [{ line: 4, column: 7 }],
        },
      ],
    });
  });

  it('correct field ordering despite execution order', async () => {
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
    const document = parse('{ a, b, c, d, e }');
    const rootValue = {
      a: () => 'a',
      b: () => new Promise((resolve) => resolve('b')),
      c: () => 'c',
      d: () => new Promise((resolve) => resolve('d')),
      e: () => 'e',
    };

    const result = await execute({ schema, document, rootValue });
    expect(result).to.deep.equal({
      data: { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' },
    });
  });

  it('Avoids recursion', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse(`
      {
        a
        ...Frag
        ...Frag
      }

      fragment Frag on Type {
        a,
        ...Frag
      }
    `);
    const rootValue = { a: 'b' };

    const result = executeSync({ schema, document, rootValue });
    expect(result).to.deep.equal({
      data: { a: 'b' },
    });
  });

  it('ignores missing sub selections on fields', () => {
    const someType = new GraphQLObjectType({
      name: 'SomeType',
      fields: {
        b: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          a: { type: someType },
        },
      }),
    });
    const document = parse('{ a }');
    const rootValue = { a: { b: 'c' } };

    const result = executeSync({ schema, document, rootValue });
    expect(result).to.deep.equal({
      data: { a: {} },
    });
  });

  it('does not include illegal fields in output', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
    });
    const document = parse('{ thisIsIllegalDoNotIncludeMe }');

    const result = executeSync({ schema, document });
    expect(result).to.deep.equal({
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
            resolve: (_source, args) => inspect(args),
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
    const document = parse('{ field(a: true, c: false, e: 0) }');

    const result = executeSync({ schema, document });
    expect(result).to.deep.equal({
      data: {
        field: '{ a: true, c: false, e: 0 }',
      },
    });
  });

  it('fails when an isTypeOf check is not met', async () => {
    class Special {
      value: string;

      constructor(value: string) {
        this.value = value;
      }
    }

    class NotSpecial {
      value: string;

      constructor(value: string) {
        this.value = value;
      }
    }

    const SpecialType = new GraphQLObjectType<Special, { async: boolean }>({
      name: 'SpecialType',
      isTypeOf(obj, context) {
        const result = obj instanceof Special;
        return context.async ? Promise.resolve(result) : result;
      },
      fields: { value: { type: GraphQLString } },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          specials: { type: new GraphQLList(SpecialType) },
        },
      }),
    });

    const document = parse('{ specials { value } }');
    const rootValue = {
      specials: [new Special('foo'), new NotSpecial('bar')],
    };

    const result = executeSync({
      schema,
      document,
      rootValue,
      contextValue: { async: false },
    });
    expectJSON(result).toDeepEqual({
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

    const asyncResult = await execute({
      schema,
      document,
      rootValue,
      contextValue: { async: true },
    });
    expect(asyncResult).to.deep.equal(result);
  });

  it('fails when serialize of custom scalar does not return a value', () => {
    const customScalar = new GraphQLScalarType({
      name: 'CustomScalar',
      serialize() {
        /* returns nothing */
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          customScalar: {
            type: customScalar,
            resolve: () => 'CUSTOM_VALUE',
          },
        },
      }),
    });

    const result = executeSync({ schema, document: parse('{ customScalar }') });
    expectJSON(result).toDeepEqual({
      data: { customScalar: null },
      errors: [
        {
          message:
            'Expected `CustomScalar.serialize("CUSTOM_VALUE")` to return non-nullable value, returned: undefined',
          locations: [{ line: 1, column: 3 }],
          path: ['customScalar'],
        },
      ],
    });
  });

  it('executes ignoring invalid non-executable definitions', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    const document = parse(`
      { foo }

      type Query { bar: String }
    `);

    const result = executeSync({ schema, document });
    expect(result).to.deep.equal({ data: { foo: null } });
  });

  it('uses a custom field resolver', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });
    const document = parse('{ foo }');

    const result = executeSync({
      schema,
      document,
      fieldResolver(_source, _args, _context, info) {
        // For the purposes of test, just return the name of the field!
        return info.fieldName;
      },
    });

    expect(result).to.deep.equal({ data: { foo: 'foo' } });
  });

  it('uses a custom type resolver', () => {
    const document = parse('{ foo { bar } }');

    const fooInterface = new GraphQLInterfaceType({
      name: 'FooInterface',
      fields: {
        bar: { type: GraphQLString },
      },
    });

    const fooObject = new GraphQLObjectType({
      name: 'FooObject',
      interfaces: [fooInterface],
      fields: {
        bar: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: { type: fooInterface },
        },
      }),
      types: [fooObject],
    });

    const rootValue = { foo: { bar: 'bar' } };

    let possibleTypes;
    const result = executeSync({
      schema,
      document,
      rootValue,
      typeResolver(_source, _context, info, abstractType) {
        // Resolver should be able to figure out all possible types on its own
        possibleTypes = info.schema.getPossibleTypes(abstractType);

        return 'FooObject';
      },
    });

    expect(result).to.deep.equal({ data: { foo: { bar: 'bar' } } });
    expect(possibleTypes).to.deep.equal([fooObject]);
  });

  /* c8 ignore start */
  if (typeof AbortController !== 'undefined') {
    it('stops execution and throws an error when signal is aborted', async () => {
      // TODO: use real Event once we can finally drop node14 support
      class MockAbortEvent implements IEvent {
        cancelable = false;
        bubbles = false;
        composed = false;
        currentTarget = null;
        cancelBubble = false;
        defaultPrevented = false;
        isTrusted = true;
        returnValue = false;
        srcElement = null;
        type = 'abort';
        eventPhase = 0;
        timeStamp = 0;
        AT_TARGET = 0;
        BUBBLING_PHASE = 0;
        CAPTURING_PHASE = 0;
        NONE = 0;

        target: IAbortSignal;

        constructor(abortSignal: IAbortSignal) {
          this.target = abortSignal;
        }

        composedPath = () => {
          throw new Error('Not mocked!');
        };

        initEvent = () => {
          throw new Error('Not mocked!');
        };

        preventDefault = () => {
          throw new Error('');
        };

        stopImmediatePropagation = () => {
          throw new Error('');
        };

        stopPropagation = () => {
          throw new Error('');
        };
      }

      class MockAbortSignal implements IAbortSignal {
        aborted: boolean = false;
        onabort: ((ev: IEvent) => any) | null = null;
        reason: unknown;

        throwIfAborted() {
          if (this.aborted) {
            throw this.reason;
          }
        }

        addEventListener(type: string, cb: unknown) {
          expect(type).to.equal('abort');
          expect(this.onabort).to.equal(null);
          expect(cb).to.be.a('function');
          this.onabort = cb as any;
        }

        removeEventListener(type: string, cb: unknown) {
          expect(type).to.equal('abort');
          expect(cb).to.be.a('function');
          this.onabort = null;
        }

        dispatchEvent(event: IEvent): boolean {
          expect(this.onabort).to.be.a('function');
          this.onabort?.(event);
          return true;
        }

        dispatchMockAbortEvent(reason?: unknown) {
          this.reason = reason;
          mockAbortSignal.dispatchEvent(new MockAbortEvent(this));
        }
      }

      const mockAbortSignal = new MockAbortSignal();

      const TestType: GraphQLObjectType = new GraphQLObjectType({
        name: 'TestType',
        fields: () => ({
          resolveOnNextTick: {
            type: TestType,
            resolve: () => resolveOnNextTick({}),
          },
          string: {
            type: GraphQLString,
            args: {
              value: { type: new GraphQLNonNull(GraphQLString) },
            },
            resolve: (_, { value }) => value,
          },
          abortExecution: {
            type: GraphQLString,
            resolve: () => {
              const abortError = new Error('Custom abort error');
              mockAbortSignal.dispatchMockAbortEvent(abortError);
              return 'aborted';
            },
          },
          shouldNotBeResolved: {
            type: GraphQLString,
            /* c8 ignore next */
            resolve: () => 'This should not be executed!',
          },
        }),
      });

      const schema = new GraphQLSchema({
        query: TestType,
      });

      const document = parse(`
      query {
        value1: string(value: "1")
        resolveOnNextTick {
          value2: string(value: "2")
          resolveOnNextTick {
            resolveOnNextTick {
              shouldNotBeResolved
            }
            abortExecution
          }
        }
        alternativeBranch: resolveOnNextTick {
          value3: string(value: "3")
          resolveOnNextTick {
            shouldNotBeResolved
          }
        }
      }
    `);

      const result = await execute({
        schema,
        document,
        signal: mockAbortSignal,
      });

      expectJSON(result).toDeepEqual({
        data: {
          value1: '1',
          resolveOnNextTick: {
            value2: '2',
            resolveOnNextTick: {
              resolveOnNextTick: {
                shouldNotBeResolved: null,
              },
              abortExecution: 'aborted',
            },
          },
          alternativeBranch: {
            value3: '3',
            resolveOnNextTick: {
              shouldNotBeResolved: null,
            },
          },
        },
        errors: [
          {
            message: 'Custom abort error',
            path: [
              'alternativeBranch',
              'resolveOnNextTick',
              'shouldNotBeResolved',
            ],
            locations: [{ line: 16, column: 13 }],
          },
          {
            message: 'Custom abort error',
            path: [
              'resolveOnNextTick',
              'resolveOnNextTick',
              'resolveOnNextTick',
              'shouldNotBeResolved',
            ],
            locations: [{ line: 8, column: 15 }],
          },
        ],
      });
    });
  }
  /* c8 ignore stop */
});
