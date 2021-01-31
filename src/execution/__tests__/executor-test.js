import { expect } from 'chai';
import { describe, it } from 'mocha';

import inspect from '../../jsutils/inspect';
import invariant from '../../jsutils/invariant';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLInt, GraphQLBoolean, GraphQLString } from '../../type/scalars';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../type/definition';

import { execute, executeSync } from '../execute';

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

    // $FlowExpectedError[prop-missing]
    expect(() => executeSync({ schema })).to.throw('Must provide document.');
  });

  it('throws if no schema is provided', () => {
    const document = parse('{ field }');

    // $FlowExpectedError[prop-missing]
    expect(() => executeSync({ document })).to.throw(
      'Expected undefined to be a GraphQL schema.',
    );
  });

  it('throws on invalid variables', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          fieldA: {
            type: GraphQLString,
            args: { argA: { type: GraphQLInt } },
          },
        },
      }),
    });
    const document = parse(`
      query ($a: Int) {
        fieldA(argA: $a)
      }
    `);
    const variableValues = '{ "a": 1 }';

    // $FlowExpectedError[incompatible-call]
    expect(() => executeSync({ schema, document, variableValues })).to.throw(
      'Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.',
    );
  });

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
    );

    const operation = document.definitions[0];
    invariant(operation.kind === Kind.OPERATION_DEFINITION);

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
          // eslint-disable-next-line no-throw-literal
          throw 'Error getting asyncRawError';
        });
      },
      asyncReturnError() {
        return Promise.resolve(new Error('Error getting asyncReturnError'));
      },
      asyncReturnErrorWithExtensions() {
        const error = new Error('Error getting asyncReturnErrorWithExtensions');
        (error: any).extensions = { foo: 'bar' };

        return Promise.resolve(error);
      },
    };

    const result = await execute({ schema, document, rootValue });
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

    expect(result).to.deep.equal({
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

  it('Full response path is included for non-nullable fields', () => {
    const A = new GraphQLObjectType({
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
    expect(result).to.deep.equal({
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
    expect(result).to.deep.equal({
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
    expect(result).to.deep.equal({
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

    const SpecialType = new GraphQLObjectType({
      name: 'SpecialType',
      isTypeOf(obj, context) {
        const result = obj instanceof Special;
        return context?.async ? Promise.resolve(result) : result;
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

    const result = executeSync({ schema, document, rootValue });
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

    const contextValue = { async: true };
    const asyncResult = await execute({
      schema,
      document,
      rootValue,
      contextValue,
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
    expect(result).to.deep.equal({
      data: { customScalar: null },
      errors: [
        {
          message:
            'Expected a value of type "CustomScalar" but received: "CUSTOM_VALUE"',
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
});
