import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.ts';

import { Kind } from '../../language/kinds.ts';
import { parse } from '../../language/parser.ts';

import type {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
} from '../../type/definition.ts';
import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../type/definition.ts';
import { GraphQLInt, GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { execute, executeSync } from '../execute.ts';

function testSchema(testField: GraphQLFieldConfig<any, any>) {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        test: testField,
      },
    }),
  });
}

/**
 * Helper that executes a query and returns the GraphQLResolveInfo captured
 * from the resolver of the target field (default: `test`).
 */
function expectResolveInfo(options: {
  schema: GraphQLSchema;
  source: string;
  rootValue?: unknown;
  variableValues?: { readonly [variable: string]: unknown };
}): GraphQLResolveInfo {
  const document = parse(options.source);
  executeSync({
    schema: options.schema,
    document,
    rootValue: options.rootValue,
    variableValues: options.variableValues,
  });

  // The schema must have been constructed with a resolver that sets `captured`.
  const info = captured;
  captured = undefined;
  assert(info !== undefined, 'Expected resolve info to be captured');
  return info;
}

// Shared mutable slot used by `expectResolveInfo` and `captureInfo`.
let captured: GraphQLResolveInfo | undefined;

/** A resolver that captures its `info` argument for later assertions. */
function captureInfo(
  _source: unknown,
  _args: unknown,
  _ctx: unknown,
  info: GraphQLResolveInfo,
) {
  captured = info;
}

describe('Execute: GraphQLResolveInfo', () => {
  it('provides info about current execution state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise, resolve } = promiseWithResolvers<void>();
    let resolvedInfo: GraphQLResolveInfo | undefined;
    const testType = new GraphQLObjectType({
      name: 'Test',
      fields: {
        test: {
          type: GraphQLString,
          resolve(_val, _args, _ctx, info) {
            resolvedInfo = info;
            return promise;
          },
        },
      },
    });
    const schema = new GraphQLSchema({ query: testType });

    const document = parse('query ($var: String) { result: test }');
    const rootValue = { root: 'val' };
    const variableValues = { var: 'abc' };

    const result = execute({ schema, document, rootValue, variableValues });

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
      'getAbortSignal',
      'getAsyncHelpers',
    );
    const asyncHelpers = resolvedInfo?.getAsyncHelpers();
    expect(asyncHelpers).to.have.all.keys('promiseAll', 'track');

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
      variableValues: {
        sources: {
          var: {
            signature: {
              name: 'var',
              type: GraphQLString,
              default: undefined,
            },
            value: 'abc',
          },
        },
        coerced: { var: 'abc' },
      },
    });

    const abortSignal = resolvedInfo?.getAbortSignal();
    expect(abortSignal).to.be.instanceOf(AbortSignal);
    expect(resolvedInfo?.getAbortSignal()).to.equal(abortSignal);

    expect(resolvedInfo?.getAsyncHelpers()).to.equal(asyncHelpers);

    const promiseAll = asyncHelpers?.promiseAll;
    expect(promiseAll).to.be.a('function');
    expect(resolvedInfo?.getAsyncHelpers().promiseAll).to.equal(promiseAll);

    const track = asyncHelpers?.track;
    expect(track).to.be.a('function');
    expect(resolvedInfo?.getAsyncHelpers().track).to.equal(track);
    track?.([Promise.resolve()]);

    resolve();

    await result;

    const lateAbortSignal = resolvedInfo?.getAbortSignal();
    expect(lateAbortSignal).to.be.instanceOf(AbortSignal);
    expect(lateAbortSignal?.aborted).to.equal(true);
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

  it('provides correct resolve info for nested fields', () => {
    let outerInfo: GraphQLResolveInfo | undefined;
    let innerInfo: GraphQLResolveInfo | undefined;

    const InnerType: GraphQLObjectType = new GraphQLObjectType({
      name: 'Inner',
      fields: {
        value: {
          type: GraphQLString,
          resolve(_source, _args, _context, info) {
            innerInfo = info;
            return 'inner value';
          },
        },
      },
    });

    const OuterType = new GraphQLObjectType({
      name: 'Outer',
      fields: {
        inner: {
          type: InnerType,
          resolve(_source, _args, _context, info) {
            outerInfo = info;
            return {};
          },
        },
      },
    });

    const schema = new GraphQLSchema({ query: OuterType });
    const document = parse('{ inner { value } }');
    const rootValue = {};

    executeSync({ schema, document, rootValue });

    expect(outerInfo).to.include({
      fieldName: 'inner',
      returnType: InnerType,
      parentType: OuterType,
    });

    expect(innerInfo).to.include({
      fieldName: 'value',
      returnType: GraphQLString,
      parentType: InnerType,
    });
  });

  it('provides correct returnType for NonNull and List wrappers', () => {
    let nonNullInfo: GraphQLResolveInfo | undefined;
    let listInfo: GraphQLResolveInfo | undefined;
    let nonNullListInfo: GraphQLResolveInfo | undefined;

    const nonNullType = new GraphQLNonNull(GraphQLString);
    const listType = new GraphQLList(GraphQLString);
    const nonNullListType = new GraphQLNonNull(
      new GraphQLList(new GraphQLNonNull(GraphQLString)),
    );

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          nonNullField: {
            type: nonNullType,
            resolve(_source, _args, _context, info) {
              nonNullInfo = info;
              return 'value';
            },
          },
          listField: {
            type: listType,
            resolve(_source, _args, _context, info) {
              listInfo = info;
              return ['a', 'b'];
            },
          },
          nonNullListField: {
            type: nonNullListType,
            resolve(_source, _args, _context, info) {
              nonNullListInfo = info;
              return ['x', 'y'];
            },
          },
        },
      }),
    });

    const document = parse('{ nonNullField listField nonNullListField }');
    executeSync({ schema, document });

    expect(nonNullInfo?.returnType).to.equal(nonNullType);
    expect(listInfo?.returnType).to.equal(listType);
    expect(nonNullListInfo?.returnType).to.equal(nonNullListType);
  });

  it('provides correct fieldNodes including aliases and arguments', () => {
    const info = expectResolveInfo({
      schema: testSchema({
        type: GraphQLString,
        args: { id: { type: GraphQLInt } },
        resolve: captureInfo,
      }),
      source: '{ aliased: test(id: 42) }',
    });

    expect(info.fieldNodes).to.have.length(1);
    const fieldNode = info.fieldNodes[0];
    expect(fieldNode.kind).to.equal(Kind.FIELD);
    expect(fieldNode.alias?.value).to.equal('aliased');
    expect(fieldNode.name.value).to.equal('test');
    expect(fieldNode.arguments).to.have.length(1);
    expect(fieldNode.arguments?.[0].name.value).to.equal('id');
  });

  it('provides fragments in resolve info', () => {
    const PersonType = new GraphQLObjectType({
      name: 'Person',
      fields: {
        name: {
          type: GraphQLString,
          resolve: captureInfo,
        },
        age: { type: GraphQLInt },
      },
    });

    const info = expectResolveInfo({
      schema: new GraphQLSchema({ query: PersonType }),
      source: `
        query {
          ...PersonFields
        }
        fragment PersonFields on Person {
          name
        }
      `,
      rootValue: {},
    });

    expect(info.fragments).to.have.key('PersonFields');
    expect(info.fragments.PersonFields.kind).to.equal(Kind.FRAGMENT_DEFINITION);
    expect(info.fragments.PersonFields.name.value).to.equal('PersonFields');
  });

  it('provides correct info to resolveType on interface fields', () => {
    let resolveTypeInfo: GraphQLResolveInfo | undefined;

    const AnimalType = new GraphQLInterfaceType({
      name: 'Animal',
      fields: {
        name: { type: GraphQLString },
      },
      resolveType(_source, _context, info) {
        resolveTypeInfo = info;
        return 'Dog';
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [AnimalType],
      fields: {
        name: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          animal: {
            type: AnimalType,
            resolve() {
              return { name: 'Odie' };
            },
          },
        },
      }),
      types: [DogType],
    });

    const document = parse('{ animal { name } }');
    executeSync({ schema, document });

    expect(resolveTypeInfo).to.include({
      fieldName: 'animal',
      parentType: schema.getQueryType(),
      returnType: AnimalType,
    });
    expect(resolveTypeInfo?.fieldNodes).to.have.length(1);
    expect(resolveTypeInfo?.fieldNodes[0].name.value).to.equal('animal');
  });

  it('provides correct info to resolveType on union fields', () => {
    let resolveTypeInfo: GraphQLResolveInfo | undefined;

    const CatType = new GraphQLObjectType({
      name: 'Cat',
      fields: { name: { type: GraphQLString } },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      fields: { name: { type: GraphQLString } },
    });

    const PetType = new GraphQLUnionType({
      name: 'Pet',
      types: [CatType, DogType],
      resolveType(_source, _context, info) {
        resolveTypeInfo = info;
        return 'Cat';
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          pet: {
            type: PetType,
            resolve() {
              return { name: 'Garfield' };
            },
          },
        },
      }),
    });

    const document = parse('{ pet { ... on Cat { name } } }');
    executeSync({ schema, document });

    expect(resolveTypeInfo).to.include({
      fieldName: 'pet',
      returnType: PetType,
    });
    expect(resolveTypeInfo?.fieldNodes).to.have.length(1);
    expect(resolveTypeInfo?.fieldNodes[0].name.value).to.equal('pet');
  });

  it('provides correct info to isTypeOf', () => {
    let isTypeOfInfo: GraphQLResolveInfo | undefined;

    const AnimalType = new GraphQLInterfaceType({
      name: 'Animal',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const DogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [AnimalType],
      fields: {
        name: { type: GraphQLString },
      },
      isTypeOf(_source, _context, info) {
        isTypeOfInfo = info;
        return true;
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          animal: {
            type: AnimalType,
            resolve() {
              return { name: 'Lassie' };
            },
          },
        },
      }),
      types: [DogType],
    });

    const document = parse('{ animal { name } }');
    executeSync({ schema, document });

    expect(isTypeOfInfo).to.include({
      fieldName: 'animal',
      parentType: schema.getQueryType(),
      returnType: AnimalType,
    });
    expect(isTypeOfInfo?.fieldNodes).to.have.length(1);
    expect(isTypeOfInfo?.fieldNodes[0].name.value).to.equal('animal');
  });

  it('provides correct path for deeply nested fields', () => {
    let leafInfo: GraphQLResolveInfo | undefined;

    const LevelTwo = new GraphQLObjectType({
      name: 'LevelTwo',
      fields: {
        value: {
          type: GraphQLString,
          resolve(_source, _args, _context, info) {
            leafInfo = info;
            return 'deep';
          },
        },
      },
    });

    const LevelOne = new GraphQLObjectType({
      name: 'LevelOne',
      fields: {
        child: {
          type: LevelTwo,
          resolve() {
            return {};
          },
        },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          parent: {
            type: LevelOne,
            resolve() {
              return {};
            },
          },
        },
      }),
    });

    const document = parse('{ parent { child { value } } }');
    executeSync({ schema, document });

    expect(leafInfo).to.include({
      fieldName: 'value',
      returnType: GraphQLString,
      parentType: LevelTwo,
    });
    expect(leafInfo?.path).to.deep.equal({
      prev: {
        prev: { prev: undefined, key: 'parent', typename: 'Query' },
        key: 'child',
        typename: 'LevelOne',
      },
      key: 'value',
      typename: 'LevelTwo',
    });
  });

  it('provides variableValues in resolve info', () => {
    const info = expectResolveInfo({
      schema: testSchema({
        type: GraphQLString,
        args: { greeting: { type: GraphQLString } },
        resolve: captureInfo,
      }),
      source: `
        query TestQuery($greeting: String) {
          test(greeting: $greeting)
        }
      `,
      variableValues: { greeting: 'bonjour' },
    });

    expect(info.variableValues).to.deep.equal({
      sources: {
        greeting: {
          signature: {
            name: 'greeting',
            type: GraphQLString,
            default: undefined,
          },
          value: 'bonjour',
        },
      },
      coerced: { greeting: 'bonjour' },
    });
    expect(info.operation.kind).to.equal(Kind.OPERATION_DEFINITION);
    expect(info.operation.name?.value).to.equal('TestQuery');
  });
});
