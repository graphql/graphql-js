import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { invariant } from '../../../jsutils/invariant.ts';
import { addPath, pathToArray } from '../../../jsutils/Path.ts';

import type { GraphQLError } from '../../../error/GraphQLError.ts';

import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import type { GraphQLBatchedResolveInfo } from '../../../type/definition.ts';
import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import {
  execute as executeWithoutBatchResolvers,
  executeSync as executeSyncWithoutBatchResolvers,
  experimentalExecuteIncrementally as experimentalExecuteIncrementallyWithoutBatchResolvers,
  validateExecutionArgs,
} from '../../execute.ts';
import { Executor } from '../../Executor.ts';
import type {
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../../incremental/IncrementalExecutor.ts';

import { completeFieldBatchGroup } from '../completeFieldBatchGroup.ts';

import type { BatchCall } from './fixtures.ts';
import {
  batchCall,
  batchedField,
  schemaWithBatchedProfileFields,
  schemaWithBatchedUserName,
  schemaWithQueryFields,
  schemaWithUserFields,
} from './fixtures.ts';

function execute(
  args: Parameters<typeof executeWithoutBatchResolvers>[0],
): ReturnType<typeof executeWithoutBatchResolvers> {
  return executeWithoutBatchResolvers({
    ...args,
    enableBatchResolvers: true,
  });
}

function executeSync(
  args: Parameters<typeof executeSyncWithoutBatchResolvers>[0],
): ReturnType<typeof executeSyncWithoutBatchResolvers> {
  return executeSyncWithoutBatchResolvers({
    ...args,
    enableBatchResolvers: true,
  });
}

function experimentalExecuteIncrementally(
  args: Parameters<
    typeof experimentalExecuteIncrementallyWithoutBatchResolvers
  >[0],
): ReturnType<typeof experimentalExecuteIncrementallyWithoutBatchResolvers> {
  return experimentalExecuteIncrementallyWithoutBatchResolvers({
    ...args,
    enableBatchResolvers: true,
  });
}

async function collectIncrementalResults(
  args: Parameters<typeof experimentalExecuteIncrementally>[0],
): Promise<
  Array<
    InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
  >
> {
  const result = await experimentalExecuteIncrementally(args);
  assert('initialResult' in result);

  const results: Array<
    InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
  > = [result.initialResult];
  for await (const patch of result.subsequentResults) {
    results.push(patch);
  }
  return results;
}

describe('Execute: experimental field batch resolvers', () => {
  it('ignores batch resolvers unless explicitly enabled', () => {
    let didBatchResolve = false;
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => {
        didBatchResolve = true;
        return ['batched'];
      }),
    });

    const result = executeWithoutBatchResolvers({
      schema,
      document: parse('{ users { name } }'),
      rootValue: {
        users: [{ name: 'plain' }],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [{ name: 'plain' }],
      },
    });
    expect(didBatchResolve).to.equal(false);
  });

  it('ignores unknown fields while batch resolvers are enabled', () => {
    const QueryType = new GraphQLObjectType({
      name: 'BatchUnknownFieldQuery',
      fields: {
        known: {
          type: GraphQLString,
          resolve: () => 'ok',
        },
      },
    });
    const schema = new GraphQLSchema({ query: QueryType });

    const result = execute({
      schema,
      document: parse('{ unknown known }'),
    });

    expectJSON(result).toDeepEqual({
      data: {
        known: 'ok',
      },
    });
  });

  it('ignores unknown serial fields while batch resolvers are enabled', () => {
    const QueryType = new GraphQLObjectType({
      name: 'BatchUnknownSerialFieldQuery',
      fields: {
        noop: { type: GraphQLString },
      },
    });
    const MutationType = new GraphQLObjectType({
      name: 'BatchUnknownSerialFieldMutation',
      fields: {
        known: {
          type: GraphQLString,
          resolve: () => 'ok',
        },
      },
    });
    const schema = new GraphQLSchema({
      query: QueryType,
      mutation: MutationType,
    });

    const result = execute({
      schema,
      document: parse('mutation { unknown known }'),
    });

    expectJSON(result).toDeepEqual({
      data: {
        known: 'ok',
      },
    });
  });

  it('completes serial async regular fields while batch resolvers are enabled', async () => {
    const MutationType = new GraphQLObjectType({
      name: 'BatchSerialRegularMutation',
      fields: {
        first: {
          type: GraphQLString,
          resolve: async () => {
            await Promise.resolve();
            return 'ok';
          },
        },
      },
    });
    const QueryType = new GraphQLObjectType({
      name: 'BatchSerialRegularQuery',
      fields: {
        noop: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: QueryType,
      mutation: MutationType,
    });

    const result = await execute({
      schema,
      document: parse('mutation { first }'),
    });

    expectJSON(result).toDeepEqual({
      data: {
        first: 'ok',
      },
    });
  });

  it('tracks pending regular field promises when a batch-enabled selection throws', async () => {
    const QueryType = new GraphQLObjectType({
      name: 'BatchRegularThrowQuery',
      fields: {
        slow: {
          type: GraphQLString,
          resolve: async () => {
            await Promise.resolve();
            return 'slow';
          },
        },
        bad: {
          type: new GraphQLNonNull(GraphQLString),
          resolve: () => {
            throw new Error('bad');
          },
        },
      },
    });
    const schema = new GraphQLSchema({ query: QueryType });

    const result = await execute({
      schema,
      document: parse('{ slow bad }'),
    });

    expect(result.data).to.equal(null);
    expect(result.errors?.map((error) => error.message)).to.deep.equal(['bad']);
  });

  it('throws when a batch-enabled serial executor is already aborted', () => {
    const document = parse('mutation { name }');
    const operation = document.definitions[0];
    invariant(operation.kind === Kind.OPERATION_DEFINITION);
    const nameFieldNode = operation.selectionSet.selections[0];
    invariant(nameFieldNode.kind === Kind.FIELD);
    const MutationType = new GraphQLObjectType({
      name: 'BatchAbortedMutation',
      fields: {
        name: { type: GraphQLString },
      },
    });
    const QueryType = new GraphQLObjectType({
      name: 'BatchAbortedQuery',
      fields: {
        noop: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: QueryType,
      mutation: MutationType,
    });
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document,
      enableBatchResolvers: true,
    });
    assert('schema' in validatedExecutionArgs);
    const executor = new Executor(validatedExecutionArgs);

    executor.abort();

    expect(() =>
      executor.executeFieldsSeriallyWithBatchResolvers(
        MutationType,
        {},
        undefined,
        new Map([['name', [{ node: nameFieldNode }]]]),
        undefined,
      ),
    ).to.throw('Aborted!');
  });

  it('batches a field across list items', () => {
    const calls: Array<unknown> = [];

    const schema = schemaWithUserFields({
      id: { type: GraphQLString },
      name: batchedField(
        GraphQLString,
        (sources, args, context, info) => {
          calls.push({
            sources,
            args,
            context,
            paths: info.paths.map(pathToArray),
          });
          return sources.map(
            (source: any) =>
              `${args.prefix}${source.id}${(context as any).suffix}`,
          );
        },
        {
          args: {
            prefix: { type: GraphQLString },
          },
        },
      ),
    });

    const rootValue = {
      users: [{ id: '1' }, { id: '2' }],
    };
    const contextValue = { suffix: '!' };

    const result = executeSync({
      schema,
      document: parse('{ users { id name(prefix: "user-") } }'),
      rootValue,
      contextValue,
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [
          { id: '1', name: 'user-1!' },
          { id: '2', name: 'user-2!' },
        ],
      },
    });
    expect(calls).to.deep.equal([
      {
        sources: rootValue.users,
        args: { prefix: 'user-' },
        context: contextValue,
        paths: [
          ['users', 0, 'name'],
          ['users', 1, 'name'],
        ],
      },
    ]);
  });

  it('provides batched info about current execution state', async () => {
    let resolveBatch!: (value: ReadonlyArray<string>) => void;
    let resolvedInfo: GraphQLBatchedResolveInfo | undefined;

    const testType = new GraphQLObjectType({
      name: 'Test',
      fields: {
        test: {
          ...batchedField(GraphQLString, (_sources, _args, _context, info) => {
            resolvedInfo = info;
            return new Promise<ReadonlyArray<string>>((resolve) => {
              resolveBatch = resolve;
            });
          }),
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
      'paths',
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
      paths: [
        {
          prev: undefined,
          key: 'result',
          typename: 'Test',
        },
      ],
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

    resolveBatch(['ok']);

    await result;

    const lateAbortSignal = resolvedInfo?.getAbortSignal();
    expect(lateAbortSignal).to.be.instanceOf(AbortSignal);
    expect(lateAbortSignal?.aborted).to.equal(true);
  });

  it('runs later batch rounds for subfields produced by a batch', async () => {
    const calls: Array<ReadonlyArray<string>> = [];

    const UserType: GraphQLObjectType = new GraphQLObjectType({
      name: 'User',
      fields: () => ({
        bestFriend: batchedField(UserType, (sources) => {
          calls.push(sources.map((source: any) => source.id));
          return sources.map((source: any) => source.bestFriend);
        }),
        name: batchedField(GraphQLString, (sources) => {
          calls.push(sources.map((source: any) => source.id));
          return Promise.resolve(sources.map((source: any) => source.name));
        }),
      }),
    });

    const schema = schemaWithQueryFields({
      users: { type: new GraphQLList(UserType) },
    });

    const result = await execute({
      schema,
      document: parse('{ users { bestFriend { name } } }'),
      rootValue: {
        users: [
          { id: '1', bestFriend: { id: '2', name: 'Ada' } },
          { id: '3', bestFriend: { id: '4', name: 'Grace' } },
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [
          { bestFriend: { name: 'Ada' } },
          { bestFriend: { name: 'Grace' } },
        ],
      },
    });
    expect(calls).to.deep.equal([
      ['1', '3'],
      ['2', '4'],
    ]);
  });

  it('batches same concrete field positions across discontinuous abstract list paths', () => {
    const calls: Array<BatchCall & { typename: string }> = [];

    const CharacterType = new GraphQLInterfaceType({
      name: 'Character',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const makeCharacterType = (name: string) =>
      new GraphQLObjectType({
        name,
        interfaces: [CharacterType],
        fields: {
          name: batchedField(
            GraphQLString,
            (sources, _args, _context, info) => {
              calls.push({
                ...batchCall(sources, info),
                typename: name,
              });
              return sources.map((source: any) => source.name);
            },
          ),
        },
      });

    const HumanType = makeCharacterType('Human');
    const DroidType = makeCharacterType('Droid');

    const schema = schemaWithQueryFields(
      { characters: { type: new GraphQLList(CharacterType) } },
      [HumanType, DroidType],
    );

    const result = executeSync({
      schema,
      document: parse(`
        {
          characters {
            __typename
            ... on Human { name }
            ... on Droid { name }
          }
        }
      `),
      rootValue: {
        characters: [
          { __typename: 'Human', id: 'h1', name: 'Luke' },
          { __typename: 'Droid', id: 'd1', name: 'R2-D2' },
          { __typename: 'Human', id: 'h2', name: 'Leia' },
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        characters: [
          { __typename: 'Human', name: 'Luke' },
          { __typename: 'Droid', name: 'R2-D2' },
          { __typename: 'Human', name: 'Leia' },
        ],
      },
    });
    expect(calls).to.deep.equal([
      {
        typename: 'Human',
        ids: ['h1', 'h2'],
        paths: [
          ['characters', 0, 'name'],
          ['characters', 2, 'name'],
        ],
      },
      {
        typename: 'Droid',
        ids: ['d1'],
        paths: [['characters', 1, 'name']],
      },
    ]);
  });

  it('batches a field across multidimensional list items', () => {
    const calls: Array<BatchCall> = [];

    const UserType = new GraphQLObjectType({
      name: 'User',
      fields: {
        name: batchedField(GraphQLString, (sources, _args, _context, info) => {
          calls.push(batchCall(sources, info));
          return sources.map((source: any) => source.name);
        }),
      },
    });

    const schema = schemaWithQueryFields({
      userGrid: { type: new GraphQLList(new GraphQLList(UserType)) },
    });

    const result = executeSync({
      schema,
      document: parse('{ userGrid { name } }'),
      rootValue: {
        userGrid: [
          [
            { id: '1', name: 'Ada' },
            { id: '2', name: 'Grace' },
          ],
          [{ id: '3', name: 'Lin' }],
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        userGrid: [[{ name: 'Ada' }, { name: 'Grace' }], [{ name: 'Lin' }]],
      },
    });
    expect(calls).to.deep.equal([
      {
        ids: ['1', '2', '3'],
        paths: [
          ['userGrid', 0, 0, 'name'],
          ['userGrid', 0, 1, 'name'],
          ['userGrid', 1, 0, 'name'],
        ],
      },
    ]);
  });

  it('preserves field ordering when writing batch results', () => {
    const UserType = new GraphQLObjectType({
      name: 'User',
      fields: {
        first: { type: GraphQLString },
        name: batchedField(GraphQLString, (sources) =>
          sources.map((source: any) => source.name),
        ),
        last: { type: GraphQLString },
      },
    });

    const schema = schemaWithQueryFields({
      user: { type: UserType },
    });

    const result = executeSync({
      schema,
      document: parse('{ user { first name last } }'),
      rootValue: {
        user: { first: 'Ada', name: 'Byron', last: 'Lovelace' },
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        user: { first: 'Ada', name: 'Byron', last: 'Lovelace' },
      },
    });
    expect(Object.keys((result.data as any).user)).to.deep.equal([
      'first',
      'name',
      'last',
    ]);
  });

  it('bubbles batch nulls to multidimensional list nullable positions', async () => {
    const calls: Array<BatchCall> = [];

    const UserType = new GraphQLObjectType({
      name: 'User',
      fields: {
        name: batchedField(
          new GraphQLNonNull(GraphQLString),
          (sources, _args, _context, info) => {
            calls.push(batchCall(sources, info));
            return sources.map((source: any) => source.name);
          },
        ),
      },
    });

    const schema = schemaWithQueryFields({
      nullableUsers: {
        type: new GraphQLList(new GraphQLList(UserType)),
      },
      nonNullUsers: {
        type: new GraphQLList(new GraphQLList(new GraphQLNonNull(UserType))),
      },
      nonNullLists: {
        type: new GraphQLList(
          new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
        ),
      },
    });

    const result = await execute({
      schema,
      document: parse(`
        {
          nullableUsers { name }
          nonNullUsers { name }
          nonNullLists { name }
        }
      `),
      rootValue: {
        nullableUsers: [
          [
            { id: 'item-null', name: null },
            { id: 'item-kept', name: 'Ada' },
          ],
        ],
        nonNullUsers: [
          [
            { id: 'list-null', name: null },
            { id: 'list-skipped', name: 'Grace' },
          ],
        ],
        nonNullLists: [
          [
            { id: 'field-null', name: null },
            { id: 'field-skipped', name: 'Lin' },
          ],
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        nullableUsers: [[null, { name: 'Ada' }]],
        nonNullUsers: [null],
        nonNullLists: null,
      },
      errors: [
        {
          message: 'Cannot return null for non-nullable field User.name.',
          path: ['nullableUsers', 0, 0, 'name'],
          locations: [{ line: 3, column: 27 }],
        },
        {
          message: 'Cannot return null for non-nullable field User.name.',
          path: ['nonNullUsers', 0, 0, 'name'],
          locations: [{ line: 4, column: 26 }],
        },
        {
          message: 'Cannot return null for non-nullable field User.name.',
          path: ['nonNullLists', 0, 0, 'name'],
          locations: [{ line: 5, column: 26 }],
        },
      ],
    });
    expect(calls).to.deep.equal([
      {
        ids: ['item-null', 'item-kept'],
        paths: [
          ['nullableUsers', 0, 0, 'name'],
          ['nullableUsers', 0, 1, 'name'],
        ],
      },
      {
        ids: ['list-null', 'list-skipped'],
        paths: [
          ['nonNullUsers', 0, 0, 'name'],
          ['nonNullUsers', 0, 1, 'name'],
        ],
      },
      {
        ids: ['field-null', 'field-skipped'],
        paths: [
          ['nonNullLists', 0, 0, 'name'],
          ['nonNullLists', 0, 1, 'name'],
        ],
      },
    ]);
  });

  it('bubbles batch nulls above multidimensional lists to the root', async () => {
    const UserType = new GraphQLObjectType({
      name: 'User',
      fields: {
        name: batchedField(new GraphQLNonNull(GraphQLString), (sources) =>
          sources.map((source: any) => source.name),
        ),
      },
    });

    const schema = schemaWithQueryFields({
      nonNullGrid: {
        type: new GraphQLNonNull(
          new GraphQLList(
            new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
          ),
        ),
      },
    });

    const result = await execute({
      schema,
      document: parse('{ nonNullGrid { name } }'),
      rootValue: {
        nonNullGrid: [
          [
            { id: 'root-null', name: null },
            { id: 'after-root-null', name: 'Grace' },
          ],
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field User.name.',
          path: ['nonNullGrid', 0, 0, 'name'],
          locations: [{ line: 1, column: 17 }],
        },
      ],
    });
  });

  it('bubbles async batch nulls to the root', async () => {
    const schema = schemaWithQueryFields({
      name: batchedField(new GraphQLNonNull(GraphQLString), () =>
        Promise.resolve([null]),
      ),
    });

    const result = await execute({
      schema,
      document: parse('{ name }'),
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field Query.name.',
          path: ['name'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('filters batch records below a nulled path', async () => {
    const nicknameSources: Array<string> = [];

    const schema = schemaWithUserFields({
      name: batchedField(new GraphQLNonNull(GraphQLString), () => [
        null,
        'Bob',
      ]),
      nickname: batchedField(GraphQLString, (sources) => {
        nicknameSources.push(...sources.map((source: any) => source.id));
        return sources.map((source: any) => `n-${source.id}`);
      }),
    });

    const result = await execute({
      schema,
      document: parse('{ users { name nickname } }'),
      rootValue: {
        users: [{ id: '1' }, { id: '2' }],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [null, { name: 'Bob', nickname: 'n-2' }],
      },
      errors: [
        {
          message: 'Cannot return null for non-nullable field User.name.',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(nicknameSources).to.deep.equal(['2']);
  });

  it('skips sibling batch records after every entry is nulled', async () => {
    let nicknameCalls = 0;
    const schema = schemaWithUserFields(
      {
        name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
        nickname: batchedField(GraphQLString, () => {
          nicknameCalls += 1;
          return ['nickname'];
        }),
      },
      'BatchAllNulledSiblingUser',
    );

    const result = await execute({
      schema,
      document: parse('{ users { name nickname } }'),
      rootValue: {
        users: [{}],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [null],
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field BatchAllNulledSiblingUser.name.',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(nicknameCalls).to.equal(0);
  });

  it('reports errors for invalid batch resolver results', async () => {
    const schema = schemaWithUserFields(
      {
        nonIterable: batchedField(
          GraphQLString,
          () => null as unknown as ReadonlyArray<unknown>,
        ),
        tooFew: batchedField(GraphQLString, () => []),
        throws: batchedField(GraphQLString, () => {
          throw new Error('batch boom');
        }),
        rejects: batchedField(GraphQLString, () =>
          Promise.reject(new Error('batch async boom')),
        ),
      },
      'BatchErrorUser',
    );

    const result = await execute({
      schema,
      document: parse('{ users { nonIterable tooFew throws rejects } }'),
      rootValue: {
        users: [{}],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [
          {
            nonIterable: null,
            tooFew: null,
            throws: null,
            rejects: null,
          },
        ],
      },
      errors: [
        {
          message:
            'Expected batch resolver for field "BatchErrorUser.nonIterable" to return an Iterable.',
          path: ['users', 0, 'nonIterable'],
          locations: [{ line: 1, column: 11 }],
        },
        {
          message:
            'Expected batch resolver for field "BatchErrorUser.tooFew" to return 1 results, returned 0.',
          path: ['users', 0, 'tooFew'],
          locations: [{ line: 1, column: 23 }],
        },
        {
          message: 'batch boom',
          path: ['users', 0, 'throws'],
          locations: [{ line: 1, column: 30 }],
        },
        {
          message: 'batch async boom',
          path: ['users', 0, 'rejects'],
          locations: [{ line: 1, column: 37 }],
        },
      ],
    });
  });

  it('throws a located error when a nullable batch error path is stale', () => {
    const UserType = new GraphQLObjectType({
      name: 'BatchStaleUser',
      fields: {
        name: { type: GraphQLString },
      },
    });
    const schema = schemaWithQueryFields({
      user: { type: UserType },
    });
    const document = parse('{ user { name } }');
    const operation = document.definitions[0];
    assert(operation.kind === Kind.OPERATION_DEFINITION);
    const userFieldNode = operation.selectionSet.selections[0];
    assert(userFieldNode.kind === Kind.FIELD);
    const nameFieldNode = userFieldNode.selectionSet?.selections[0];
    assert(nameFieldNode?.kind === Kind.FIELD);

    const userPath = addPath(undefined, 'user', 'Query');
    const namePath = addPath(userPath, 'name', 'BatchStaleUser');
    const data = Object.assign(Object.create(null), {
      user: 'not a response object',
    });
    const collectedErrors: Array<GraphQLError> = [];

    let thrownError;
    try {
      completeFieldBatchGroup(
        {
          validatedExecutionArgs: {
            schema,
            fragmentDefinitions: Object.create(null),
            fragments: Object.create(null),
            rootValue: undefined,
            contextValue: undefined,
            operation,
            variableValues: {},
            hideSuggestions: false,
          } as any,
          collectedErrors: {
            errors: collectedErrors,
            add: (error) => {
              collectedErrors.push(error);
            },
            hasNulledPosition: () => false,
            hasNulledAncestor: () => false,
          },
          batchFieldGroups: new Map(),
          rootGroupedFieldSet: new Map([['user', [{ node: userFieldNode }]]]),
          getAbortSignal: () => undefined,
          getAsyncHelpers: () => ({
            promiseAll: (values) => Promise.all(values),
            track: () => undefined,
          }),
          promiseAll: (values) => Promise.all(values),
          completeValue: (
            _returnType,
            _fieldDetailsList,
            _info,
            _path,
            result,
          ) => {
            throw result;
          },
          collectAndExecuteSubfields: () => {
            throw new Error('Unexpected subfield completion.');
          },
          handleFieldError: () => undefined,
        },
        data,
        undefined,
        {
          fieldDef: UserType.getFields().name,
          batchResolve: () => [],
          fieldDetailsList: [{ node: nameFieldNode }],
          fieldNodes: [nameFieldNode],
          parentType: UserType,
          entries: [],
        },
        [
          {
            source: {},
            path: namePath,
            positionContext: undefined,
            responseTarget: Object.create(null),
            responseKey: 'name',
          },
        ],
        [new Error('name boom')],
      );
    } catch (error) {
      thrownError = error;
    }

    assert(thrownError instanceof Error);
    expect(thrownError.message).to.equal('name boom');
    expect((thrownError as any).path).to.deep.equal(['user', 'name']);
    expect(data).to.deep.equal({ user: 'not a response object' });
    expect(collectedErrors).to.deep.equal([]);
  });

  it('stops handling a failed batch group once an ancestor is nulled', async () => {
    const schema = schemaWithBatchedUserName(
      'BatchGroupFailureUser',
      new GraphQLNonNull(GraphQLString),
      () => {
        throw new Error('group boom');
      },
      (userType) => new GraphQLList(new GraphQLNonNull(userType)),
    );

    const result = await execute({
      schema,
      document: parse('{ users { name } }'),
      rootValue: {
        users: [{}, {}],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: null,
      },
      errors: [
        {
          message: 'group boom',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
  });

  it('does not run pending batches after root null bubbling', async () => {
    let batchCalls = 0;
    const schema = schemaWithQueryFields({
      batched: batchedField(GraphQLString, () => {
        batchCalls += 1;
        return ['batched'];
      }),
      boom: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: () => null,
      },
    });

    const result = await execute({
      schema,
      document: parse('{ batched boom }'),
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field Query.boom.',
          path: ['boom'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(batchCalls).to.equal(0);
  });

  it('completes async batch resolvers and async subfields', async () => {
    const friendType = new GraphQLObjectType({
      name: 'BatchFriend',
      fields: {
        asyncName: {
          type: GraphQLString,
          resolve: (source: any) => Promise.resolve(source.name),
        },
      },
    });
    const schema = schemaWithUserFields(
      {
        promiseName: batchedField(GraphQLString, (sources) =>
          Promise.resolve(sources.map((source: any) => source.name)),
        ),
        friend: batchedField(friendType, (sources) =>
          Promise.resolve(sources.map((source: any) => source.friend)),
        ),
      },
      'BatchPromiseUser',
    );

    const result = await execute({
      schema,
      document: parse('{ users { promiseName friend { asyncName } } }'),
      rootValue: {
        users: [
          { name: 'Ada', friend: { name: 'Grace' } },
          { name: 'Lin', friend: { name: 'Katherine' } },
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [
          { promiseName: 'Ada', friend: { asyncName: 'Grace' } },
          { promiseName: 'Lin', friend: { asyncName: 'Katherine' } },
        ],
      },
    });
  });

  it('completes concrete object batch nulls and errors', async () => {
    const friendType = new GraphQLObjectType({
      name: 'BatchObjectEdgeFriend',
      fields: {
        name: { type: GraphQLString },
        asyncName: {
          type: new GraphQLNonNull(GraphQLString),
          resolve: () => Promise.reject(new Error('subfield boom')),
        },
      },
    });
    const schema = schemaWithUserFields(
      {
        nullableFriend: batchedField(friendType, () => [null]),
        errorFriend: batchedField(friendType, () => [new Error('friend boom')]),
        rejectedFriend: batchedField(friendType, (sources) =>
          sources.map((source: any) => source.friend),
        ),
      },
      'BatchObjectEdgeUser',
    );

    const result = await execute({
      schema,
      document: parse(`
        {
          users {
            nullableFriend { name }
            errorFriend { name }
            rejectedFriend { asyncName }
          }
        }
      `),
      rootValue: {
        users: [{ friend: { name: 'Grace' } }],
      },
    });

    expectJSON(result.data).toDeepEqual({
      users: [
        {
          nullableFriend: null,
          errorFriend: null,
          rejectedFriend: null,
        },
      ],
    });
    expect(
      result.errors?.map((error) => ({
        message: error.message,
        path: error.path,
      })),
    ).to.deep.equal([
      {
        message: 'friend boom',
        path: ['users', 0, 'errorFriend'],
      },
      {
        message: 'subfield boom',
        path: ['users', 0, 'rejectedFriend', 'asyncName'],
      },
    ]);
  });

  it('filters pending batch records below a path nulled in an earlier batch round', async () => {
    const extraSources: Array<string> = [];
    const nicknameSources: Array<string> = [];

    const schema = schemaWithBatchedProfileFields(
      'BatchFiltered',
      {
        nickname: batchedField(GraphQLString, (sources) => {
          nicknameSources.push(...sources.map((source: any) => source.id));
          return sources.map((source: any) => `nickname-${source.id}`);
        }),
      },
      {
        name: batchedField(new GraphQLNonNull(GraphQLString), (sources) =>
          sources.map((source: any) => source.name),
        ),
        extra: batchedField(GraphQLString, (sources) => {
          extraSources.push(...sources.map((source: any) => source.id));
          return sources.map((source: any) => `extra-${source.id}`);
        }),
      },
    );

    const result = await execute({
      schema,
      document: parse(
        '{ users { profile { details { nickname } name extra } } }',
      ),
      rootValue: {
        users: [
          { profile: { id: '1', name: null, details: { id: '1' } } },
          { profile: { id: '2', name: 'Ada', details: { id: '2' } } },
        ],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [
          { profile: null },
          {
            profile: {
              details: { nickname: 'nickname-2' },
              name: 'Ada',
              extra: 'extra-2',
            },
          },
        ],
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field BatchFilteredProfile.name.',
          path: ['users', 0, 'profile', 'name'],
          locations: [{ line: 1, column: 42 }],
        },
      ],
    });
    expect(extraSources).to.deep.equal(['2']);
    expect(nicknameSources).to.deep.equal(['2']);
  });

  it('filters all pending batch records below a path nulled in an earlier batch round', async () => {
    let extraCalls = 0;
    let nicknameCalls = 0;

    const schema = schemaWithBatchedProfileFields(
      'BatchAllFiltered',
      {
        nickname: batchedField(GraphQLString, () => {
          nicknameCalls += 1;
          return ['nickname'];
        }),
      },
      {
        name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
        extra: batchedField(GraphQLString, () => {
          extraCalls += 1;
          return ['extra'];
        }),
      },
    );

    const result = await execute({
      schema,
      document: parse(
        '{ users { profile { details { nickname } name extra } } }',
      ),
      rootValue: {
        users: [{ profile: { details: {} } }],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [{ profile: null }],
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field BatchAllFilteredProfile.name.',
          path: ['users', 0, 'profile', 'name'],
          locations: [{ line: 1, column: 42 }],
        },
      ],
    });
    expect(extraCalls).to.equal(0);
    expect(nicknameCalls).to.equal(0);
  });

  it('filters deferred work after initial batched errors', async () => {
    let nicknameCalls = 0;

    const schema = schemaWithUserFields(
      {
        name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
        nickname: batchedField(GraphQLString, (sources) => {
          nicknameCalls += 1;
          return sources.map(() => 'nickname');
        }),
      },
      'BatchInitialErrorUser',
    );

    const result = await experimentalExecuteIncrementally({
      schema,
      document: parse(
        '{ users { ... @defer(label: "later") { nickname } name } }',
      ),
      rootValue: {
        users: [{}],
      },
    });

    assert(!('initialResult' in result));
    expectJSON(result).toDeepEqual({
      data: {
        users: [null],
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field BatchInitialErrorUser.name.',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 51 }],
        },
      ],
    });
    expect(nicknameCalls).to.equal(0);
  });

  it('ignores late batch completions below nulled paths', async () => {
    const friendType = new GraphQLObjectType({
      name: 'BatchLateFriend',
      fields: {
        asyncName: {
          type: GraphQLString,
          resolve: (source: any) => Promise.resolve(source.name),
        },
      },
    });
    const schema = schemaWithUserFields(
      {
        friend: batchedField(friendType, (sources) =>
          sources.map((source: any) => source.friend),
        ),
        name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
      },
      'BatchLateUser',
    );

    const result = await execute({
      schema,
      document: parse('{ users { friend { asyncName } name } }'),
      rootValue: {
        users: [{ friend: { name: 'Grace' } }],
      },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [null],
      },
      errors: [
        {
          message:
            'Cannot return null for non-nullable field BatchLateUser.name.',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 32 }],
        },
      ],
    });
  });

  it('preserves batched mutation field ordering', async () => {
    const calls: Array<string> = [];
    let value = '';

    const mutationType = new GraphQLObjectType({
      name: 'BatchMutation',
      fields: {
        first: {
          type: GraphQLString,
          resolve: () => {
            calls.push('first');
            value += '1';
            return value;
          },
        },
        batched: batchedField(GraphQLString, async () => {
          await Promise.resolve();
          calls.push('batched');
          value += '2';
          return [value];
        }),
        last: {
          type: GraphQLString,
          resolve: () => {
            calls.push('last');
            value += '3';
            return value;
          },
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'BatchMutationQuery',
        fields: {
          dummy: { type: GraphQLString },
        },
      }),
      mutation: mutationType,
    });

    const result = await execute({
      schema,
      document: parse('mutation { first batched last }'),
    });

    expectJSON(result).toDeepEqual({
      data: {
        first: '1',
        batched: '12',
        last: '123',
      },
    });
    expect(calls).to.deep.equal(['first', 'batched', 'last']);
    expect(Object.keys(result.data as any)).to.deep.equal([
      'first',
      'batched',
      'last',
    ]);
  });

  it('stops serial mutation execution after batched root null propagation', async () => {
    const calls: Array<string> = [];

    const mutationType = new GraphQLObjectType({
      name: 'BatchMutationNull',
      fields: {
        first: batchedField(new GraphQLNonNull(GraphQLString), () => {
          calls.push('first');
          return [null];
        }),
        last: {
          type: GraphQLString,
          resolve: () => {
            calls.push('last');
            return 'last';
          },
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'BatchMutationNullQuery',
        fields: {
          dummy: { type: GraphQLString },
        },
      }),
      mutation: mutationType,
    });

    const result = await execute({
      schema,
      document: parse('mutation { first last }'),
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message:
            'Cannot return null for non-nullable field BatchMutationNull.first.',
          locations: [{ line: 1, column: 12 }],
          path: ['first'],
        },
      ],
    });
    expect(calls).to.deep.equal(['first']);
  });

  it('does not batch early-executed deferred fields with their parent payload', async () => {
    const calls: Array<BatchCall> = [];

    const schema = schemaWithUserFields(
      {
        id: { type: GraphQLString },
        name: batchedField(GraphQLString, (sources, _args, _context, info) => {
          calls.push(batchCall(sources, info));
          return Promise.resolve(sources.map((source: any) => source.name));
        }),
      },
      'BatchDeferUser',
    );

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          users {
            id
            parentName: name
          }
          ... @defer(label: "later") {
            deferredUsers: users {
              id
              deferredName: name
            }
          }
        }
      `),
      rootValue: {
        users: [
          { id: '1', name: 'Ada' },
          { id: '2', name: 'Grace' },
        ],
      },
      enableEarlyExecution: true,
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          users: [
            { id: '1', parentName: 'Ada' },
            { id: '2', parentName: 'Grace' },
          ],
        },
        pending: [{ id: '0', path: [], label: 'later' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: {
              deferredUsers: [
                { id: '1', deferredName: 'Ada' },
                { id: '2', deferredName: 'Grace' },
              ],
            },
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
    expect(calls).to.deep.equal([
      {
        ids: ['1', '2'],
        paths: [
          ['users', 0, 'parentName'],
          ['users', 1, 'parentName'],
        ],
      },
      {
        ids: ['1', '2'],
        paths: [
          ['deferredUsers', 0, 'deferredName'],
          ['deferredUsers', 1, 'deferredName'],
        ],
      },
    ]);
  });

  it('can complete a deferred payload from a synchronous batched field', async () => {
    const schema = schemaWithQueryFields({
      name: batchedField(GraphQLString, () => ['Ada']),
    });

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          ... @defer(label: "later") {
            name
          }
        }
      `),
    });

    expectJSON(results).toDeepEqual([
      {
        data: {},
        pending: [{ id: '0', path: [], label: 'later' }],
        hasNext: true,
      },
      {
        incremental: [{ data: { name: 'Ada' }, id: '0' }],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('completes a deferred payload when a batched field error bubbles past the payload root', async () => {
    const schema = schemaWithQueryFields({
      name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
    });

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          ... @defer(label: "later") {
            name
          }
        }
      `),
    });

    expectJSON(results).toDeepEqual([
      {
        data: {},
        pending: [{ id: '0', path: [], label: 'later' }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Query.name.',
                locations: [{ line: 4, column: 13 }],
                path: ['name'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('completes a deferred payload when an async batched field error bubbles past the payload root', async () => {
    const schema = schemaWithQueryFields({
      name: batchedField(new GraphQLNonNull(GraphQLString), () =>
        Promise.resolve([null]),
      ),
    });

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          ... @defer(label: "later") {
            name
          }
        }
      `),
    });

    expectJSON(results).toDeepEqual([
      {
        data: {},
        pending: [{ id: '0', path: [], label: 'later' }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field Query.name.',
                locations: [{ line: 4, column: 13 }],
                path: ['name'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('can null a non-root deferred payload field from a batched field error', async () => {
    const HeroType = new GraphQLObjectType({
      name: 'BatchDeferredPayloadHero',
      fields: {
        id: { type: GraphQLString },
        name: batchedField(GraphQLString, () => [new Error('name boom')]),
      },
    });

    const schema = schemaWithQueryFields({
      hero: { type: HeroType },
    });

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          hero {
            id
            ... @defer(label: "later") {
              name
            }
          }
        }
      `),
      rootValue: {
        hero: { id: '1' },
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          hero: { id: '1' },
        },
        pending: [{ id: '0', path: ['hero'], label: 'later' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { name: null },
            id: '0',
            errors: [
              {
                message: 'name boom',
                locations: [{ line: 6, column: 15 }],
                path: ['hero', 'name'],
              },
            ],
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('can null a non-root deferred payload nested field from a batched field error', async () => {
    const FriendType = new GraphQLObjectType({
      name: 'BatchDeferredPayloadFriend',
      fields: {
        name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
      },
    });
    const HeroType = new GraphQLObjectType({
      name: 'BatchDeferredPayloadNestedHero',
      fields: {
        id: { type: GraphQLString },
        friend: { type: FriendType },
      },
    });

    const schema = schemaWithQueryFields({
      hero: { type: HeroType },
    });

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          hero {
            id
            ... @defer(label: "later") {
              friend { name }
            }
          }
        }
      `),
      rootValue: {
        hero: {
          id: '1',
          friend: {},
        },
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          hero: { id: '1' },
        },
        pending: [{ id: '0', path: ['hero'], label: 'later' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            data: { friend: null },
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field BatchDeferredPayloadFriend.name.',
                locations: [{ line: 6, column: 24 }],
                path: ['hero', 'friend', 'name'],
              },
            ],
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('completes a non-root deferred payload when a batched field error bubbles to the payload root', async () => {
    const HeroType = new GraphQLObjectType({
      name: 'BatchDeferredPayloadNonNullHero',
      fields: {
        id: { type: GraphQLString },
        name: batchedField(new GraphQLNonNull(GraphQLString), () => [null]),
      },
    });

    const schema = schemaWithQueryFields({
      hero: { type: HeroType },
    });

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          hero {
            id
            ... @defer(label: "later") {
              name
            }
          }
        }
      `),
      rootValue: {
        hero: { id: '1' },
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          hero: { id: '1' },
        },
        pending: [{ id: '0', path: ['hero'], label: 'later' }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field BatchDeferredPayloadNonNullHero.name.',
                locations: [{ line: 6, column: 15 }],
                path: ['hero', 'name'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('does not batch separate early-executed stream items together', async () => {
    const calls: Array<BatchCall> = [];

    const schema = schemaWithUserFields(
      {
        id: { type: GraphQLString },
        name: batchedField(GraphQLString, (sources, _args, _context, info) => {
          calls.push(batchCall(sources, info));
          return sources.map((source: any) => source.name);
        }),
      },
      'BatchStreamUser',
    );

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          users @stream(initialCount: 1, label: "users") {
            id
            name
          }
        }
      `),
      rootValue: {
        users: [
          { id: '1', name: 'Ada' },
          { id: '2', name: 'Grace' },
          { id: '3', name: 'Lin' },
        ],
      },
      enableEarlyExecution: true,
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          users: [{ id: '1', name: 'Ada' }],
        },
        pending: [{ id: '0', path: ['users'], label: 'users' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [
              { id: '2', name: 'Grace' },
              { id: '3', name: 'Lin' },
            ],
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
    expect(calls).to.deep.equal([
      {
        ids: ['1'],
        paths: [['users', 0, 'name']],
      },
      {
        ids: ['2'],
        paths: [['users', 1, 'name']],
      },
      {
        ids: ['3'],
        paths: [['users', 2, 'name']],
      },
    ]);
  });

  it('can complete streamed items from an async batched field', async () => {
    const schema = schemaWithUserFields(
      {
        name: batchedField(GraphQLString, (sources) =>
          Promise.resolve(sources.map((source: any) => source.name)),
        ),
      },
      'BatchAsyncStreamItemUser',
    );

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          users @stream(initialCount: 0, label: "users") {
            name
          }
        }
      `),
      rootValue: {
        users: [{ name: 'Ada' }],
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          users: [],
        },
        pending: [{ id: '0', path: ['users'], label: 'users' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ name: 'Ada' }],
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('can null a streamed item from a batched field error', async () => {
    const schema = schemaWithBatchedUserName(
      'BatchNullableStreamUser',
      new GraphQLNonNull(GraphQLString),
      (sources) => sources.map((source: any) => source.name),
    );

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          users @stream(initialCount: 0, label: "users") {
            name
          }
        }
      `),
      rootValue: {
        users: [{ name: null }, { name: 'Grace' }],
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          users: [],
        },
        pending: [{ id: '0', path: ['users'], label: 'users' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null, { name: 'Grace' }],
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field BatchNullableStreamUser.name.',
                locations: [{ line: 4, column: 13 }],
                path: ['users', 0, 'name'],
              },
            ],
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('can null a nested field in a streamed item from a batched field error', async () => {
    const friendType = new GraphQLObjectType({
      name: 'BatchNullableStreamFriend',
      fields: {
        name: batchedField(new GraphQLNonNull(GraphQLString), (sources) =>
          sources.map((source: any) => source.name),
        ),
      },
    });
    const schema = schemaWithUserFields(
      {
        friend: { type: friendType },
      },
      'BatchNullableNestedStreamUser',
    );

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          users @stream(initialCount: 0, label: "users") {
            friend { name }
          }
        }
      `),
      rootValue: {
        users: [{ friend: { name: null } }],
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          users: [],
        },
        pending: [{ id: '0', path: ['users'], label: 'users' }],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [{ friend: null }],
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field BatchNullableStreamFriend.name.',
                locations: [{ line: 4, column: 22 }],
                path: ['users', 0, 'friend', 'name'],
              },
            ],
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('can null a stream from a non-null streamed item batched field error', async () => {
    const resultsByType = await Promise.all(
      [false, true].map(async (completeAsync) => {
        const typeName = completeAsync
          ? 'BatchAsyncNonNullStreamUser'
          : 'BatchNonNullStreamUser';
        const schema = schemaWithBatchedUserName(
          typeName,
          new GraphQLNonNull(GraphQLString),
          (sources) => {
            const names = sources.map((source: any) => source.name);
            return completeAsync ? Promise.resolve(names) : names;
          },
          (userType) => new GraphQLList(new GraphQLNonNull(userType)),
        );

        const results = await collectIncrementalResults({
          schema,
          document: parse(`
            {
              users @stream(initialCount: 0, label: "users") {
                name
              }
            }
          `),
          rootValue: {
            users: [{ name: null }],
          },
        });
        return { results, typeName };
      }),
    );

    for (const { results, typeName } of resultsByType) {
      expectJSON(results).toDeepEqual([
        {
          data: {
            users: [],
          },
          pending: [{ id: '0', path: ['users'], label: 'users' }],
          hasNext: true,
        },
        {
          completed: [
            {
              id: '0',
              errors: [
                {
                  message: `Cannot return null for non-nullable field ${typeName}.name.`,
                  locations: [{ line: 4, column: 17 }],
                  path: ['users', 0, 'name'],
                },
              ],
            },
          ],
          hasNext: false,
        },
      ]);
    }
  });

  it('completes a stream when a batched field error bubbles past the stream root', async () => {
    const schema = schemaWithBatchedUserName(
      'BatchNonNullListStreamUser',
      new GraphQLNonNull(GraphQLString),
      (sources) => Promise.resolve(sources.map((source: any) => source.name)),
      (userType) =>
        new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(userType))),
    );

    const results = await collectIncrementalResults({
      schema,
      document: parse(`
        {
          users @stream(initialCount: 0, label: "users") {
            name
          }
        }
      `),
      rootValue: {
        users: [{ name: null }],
      },
    });

    expectJSON(results).toDeepEqual([
      {
        data: {
          users: [],
        },
        pending: [{ id: '0', path: ['users'], label: 'users' }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: '0',
            errors: [
              {
                message:
                  'Cannot return null for non-nullable field BatchNonNullListStreamUser.name.',
                locations: [{ line: 4, column: 13 }],
                path: ['users', 0, 'name'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('writes batched results to alias paths without changing prototypes', () => {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
      name: 'BatchAliasUser',
      fields: () => ({
        friend: batchedField(UserType, (sources) =>
          sources.map((source: any) => source.friend),
        ),
        name: { type: GraphQLString },
      }),
    });

    const schema = schemaWithQueryFields({
      users: { type: new GraphQLList(UserType) },
    });

    const result = executeSync({
      schema,
      document: parse(`
        {
          users {
            __proto__: friend { name }
            constructor: friend { name }
            prototype: friend { name }
          }
        }
      `),
      rootValue: {
        users: [{ friend: { name: 'Ada' } }],
      },
    });

    const expectedUser = Object.create(null);
    Object.defineProperty(expectedUser, '__proto__', {
      value: { name: 'Ada' },
      enumerable: true,
    });
    expectedUser.constructor = { name: 'Ada' };
    expectedUser.prototype = { name: 'Ada' };

    expectJSON(result).toDeepEqual({
      data: {
        users: [expectedUser],
      },
    });
    const user = (result.data as any).users[0];
    expect(Object.getPrototypeOf(user)).to.equal(null);
    expect(Object.hasOwn(user, '__proto__')).to.equal(true);
  });
});
