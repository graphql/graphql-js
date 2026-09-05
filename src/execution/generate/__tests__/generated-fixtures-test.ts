import path from 'node:path';
import { before, describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { assert, expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { writeGeneratedExecutionFixtures } from '../../../../resources/generate-execution-fixtures.ts';

import type {
  CompiledExecution,
  CompiledSubscription,
} from '../../compile/index.ts';
import { validateSubscriptionArgs } from '../../execute.ts';

import type {
  QueryFixtureContext,
  SubscriptionFixtureContext,
} from './generatedFixtureSchemas.ts';
import {
  createKitchenSinkFixtureSchema,
  createQueryFixtureRootValue,
  subscriptionFixtureDocument,
} from './generatedFixtureSchemas.ts';

interface GeneratedExecutionModule {
  createCompiledExecution: (
    args: unknown,
  ) => ReadonlyArray<unknown> | CompiledExecution;
}

interface GeneratedSubscriptionModule {
  createCompiledSubscription: (
    args: unknown,
  ) => ReadonlyArray<unknown> | CompiledSubscription;
}

let generatedFixtureDir: string;

describe('generated execution kitchen sink fixtures', () => {
  before(() => {
    generatedFixtureDir = writeGeneratedExecutionFixtures();
  });

  it('generates kitchen sink execution fixture modules', () => {
    expect(generatedFixtureDir).to.be.a('string');
  });

  it('executes the query fixture through synchronous specialized paths', async () => {
    const generated = await createQueryFixtureExecution();
    const result = await Promise.resolve(
      generated.execute({
        rootValue: createQueryFixtureRootValue(),
        variableValues: queryVariables(),
        contextValue: {
          count: { valueOf: () => 8 },
          ratio: { valueOf: () => 2.5 },
        },
      }),
    );

    expectJSON(result).toDeepEqual({
      data: {
        typename: 'Query',
        node: {
          __typename: 'Item',
          id: 'q1',
          label: 'item:q1',
          count: 8,
          ratio: 2.5,
          active: true,
          tags: ['generated', 'q1'],
          computed: 'computed:q1',
          maybeError: 'ok',
          optional: 'computed:q1',
          child: { name: 'child:q1' },
        },
        item: {
          id: 'q1',
          label: 'item:q1:mark:4',
          count: 8,
          tags: ['generated', 'q1'],
        },
        defaultItem: {
          id: 'root',
          label: 'item:root',
          tags: ['generated', 'root'],
          child: { name: 'child:root' },
        },
        scalarBox: {
          bool: true,
          float: 3.5,
          id: '123',
          int: 6,
          odd: 9,
          string: '42',
        },
        list: [
          { id: 'a', label: 'item:a' },
          { id: 'b', label: 'item:b' },
        ],
      },
    });
    expectNullPrototypeData(result.data);
  });

  it('executes the query fixture through async and error paths', async () => {
    const generated = await createQueryFixtureExecution();
    const result = await Promise.resolve(
      generated.execute({
        rootValue: createQueryFixtureRootValue(),
        variableValues: queryVariables(),
        contextValue: {
          asyncLeaf: true,
          asyncRoot: true,
          asyncType: true,
          throwMaybe: true,
        },
      }),
    );

    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'fixture field error',
          locations: [{ line: 20, column: 9 }],
          path: ['node', 'maybeError'],
        },
      ],
      data: {
        typename: 'Query',
        node: {
          __typename: 'Item',
          id: 'q1',
          label: 'item:q1',
          count: 7,
          ratio: 1.25,
          active: true,
          tags: ['generated', 'q1'],
          computed: 'computed:q1',
          optional: 'computed:q1',
          child: { name: 'child:q1' },
          maybeError: null,
        },
        item: {
          id: 'q1',
          label: 'item:q1:mark:4',
          count: 7,
          tags: ['generated', 'q1'],
        },
        defaultItem: {
          id: 'root',
          label: 'item:root',
          tags: ['generated', 'root'],
          child: { name: 'child:root' },
        },
        scalarBox: {
          bool: true,
          float: 3.5,
          id: '123',
          int: 6,
          odd: 9,
          string: '42',
        },
        list: [
          { id: 'a', label: 'item:a' },
          { id: 'b', label: 'item:b' },
        ],
      },
    });
    expectNullPrototypeData(result.data);
  });

  it('reports generated query fixture variable and coercion errors', async () => {
    const generated = await createQueryFixtureExecution();

    const invalidVariableResult = await Promise.resolve(
      generated.execute({
        rootValue: createQueryFixtureRootValue(),
        variableValues: {
          ...queryVariables(),
          id: null,
        },
      }),
    );
    expect(invalidVariableResult.data).to.equal(undefined);
    expect(invalidVariableResult.errors).to.have.lengthOf(1);

    const invalidScalarResult = await Promise.resolve(
      generated.execute({
        rootValue: createQueryFixtureRootValue(),
        variableValues: queryVariables(),
        contextValue: { odd: 10 },
      }),
    );
    expectJSON(invalidScalarResult).toDeepEqual({
      errors: [
        {
          message: 'Expected odd integer.',
          locations: [{ line: 46, column: 7 }],
          path: ['scalarBox', 'odd'],
        },
      ],
      data: {
        typename: 'Query',
        node: {
          __typename: 'Item',
          id: 'q1',
          label: 'item:q1',
          count: 7,
          ratio: 1.25,
          active: true,
          tags: ['generated', 'q1'],
          computed: 'computed:q1',
          maybeError: 'ok',
          optional: 'computed:q1',
          child: { name: 'child:q1' },
        },
        item: {
          id: 'q1',
          label: 'item:q1:mark:4',
          count: 7,
          tags: ['generated', 'q1'],
        },
        defaultItem: {
          id: 'root',
          label: 'item:root',
          tags: ['generated', 'root'],
          child: { name: 'child:root' },
        },
        scalarBox: {
          bool: true,
          float: 3.5,
          id: '123',
          int: 6,
          string: '42',
          odd: null,
        },
        list: [
          { id: 'a', label: 'item:a' },
          { id: 'b', label: 'item:b' },
        ],
      },
    });
  });

  it('executes generated query variable defaults and entrypoint validation branches', async () => {
    const generated = await createQueryFixtureExecution();
    const defaultedResult = await Promise.resolve(
      generated.execute({
        rootValue: createQueryFixtureRootValue(),
        variableValues: {
          id: 'q1',
          includeOptional: false,
          skipMaybe: true,
        },
      }),
    );
    const defaultedData = getResultData(defaultedResult);
    expectJSON(defaultedData.item).toDeepEqual({
      id: 'q1',
      label: 'item:q1:none:3',
      count: 7,
      tags: ['generated', 'q1'],
    });
    assertObject(defaultedData.node);
    expect(defaultedData.node).not.to.have.property('maybeError');
    expect(defaultedData.node).not.to.have.property('optional');

    const invalidVariables = {
      ...queryVariables(),
      id: null,
    };
    const incrementalResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally({
        rootValue: createQueryFixtureRootValue(),
        variableValues: invalidVariables,
      }),
    );
    assert(!('initialResult' in incrementalResult));
    expect(incrementalResult.errors).to.have.lengthOf(1);

    const ignoringIncrementalResult = await Promise.resolve(
      generated.executeIgnoringIncremental({
        rootValue: createQueryFixtureRootValue(),
        variableValues: invalidVariables,
      }),
    );
    assert(!('initialResult' in ignoringIncrementalResult));
    expect(ignoringIncrementalResult.errors).to.have.lengthOf(1);

    const maxErrorsResult = await Promise.resolve(
      generated.execute({
        variableValues: {},
        options: { maxCoercionErrors: 1 },
      }),
    );
    expect(maxErrorsResult.errors).to.have.lengthOf(2);
    expect(maxErrorsResult.errors?.[1]?.message).to.equal(
      'Too many errors processing variables, error limit reached. Execution aborted.',
    );
  });

  it('executes generated query default resolver scalar variants', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        active: 0,
        child: { name: true },
        count: { valueOf: () => true },
        id: 12,
        label: false,
        ratio: '2.5',
        tags: [true, 3],
      },
    });
    const data = getResultData(result);
    assertObject(data.node);

    expectJSON(data.node).toDeepEqual({
      __typename: 'Item',
      id: '12',
      label: 'false',
      count: 1,
      ratio: 2.5,
      active: false,
      tags: ['true', '3'],
      computed: 'computed:q1',
      maybeError: 'ok',
      optional: 'computed:q1',
      child: { name: 'true' },
    });
  });

  it('coerces generated built-in scalar object variants', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        bool: { valueOf: () => 0 },
        float: { toJSON: () => '4.25' },
        int: { valueOf: () => '8' },
        scalarId: { valueOf: () => 456 },
        string: { toJSON: () => 99 },
      },
    });

    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: false,
      float: 4.25,
      id: '456',
      int: 8,
      odd: 9,
      string: '99',
    });
  });

  it('coerces generated built-in scalar object boolean and bigint variants', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        bool: { valueOf: () => 1n },
        float: { valueOf: () => true },
        int: { valueOf: () => false },
        scalarId: { toJSON: () => 456n },
        string: { valueOf: () => true },
      },
    });

    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: true,
      float: 1,
      id: '456',
      int: 0,
      odd: 9,
      string: 'true',
    });
  });

  it('coerces generated built-in scalar object string and bigint fallbacks', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        bool: { toJSON: () => false },
        float: { toJSON: () => 8n },
        int: { toJSON: () => 8n },
        scalarId: { valueOf: () => 'custom-id' },
        string: { toJSON: () => 99n },
      },
    });

    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: false,
      float: 8,
      id: 'custom-id',
      int: 8,
      odd: 9,
      string: '99',
    });
  });

  it('coerces generated built-in scalar bigint variants', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        bool: 1n,
        float: 8n,
        int: 8n,
        scalarId: 456n,
        string: 99n,
      },
    });

    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: true,
      float: 8,
      id: '456',
      int: 8,
      odd: 9,
      string: '99',
    });
  });

  it('completes generated async built-in scalar fields', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        bool: Promise.resolve(0),
        float: Promise.resolve('4.25'),
        int: Promise.resolve('8'),
        odd: Promise.resolve(9),
        scalarId: Promise.resolve(456n),
        string: Promise.resolve(false),
      },
    });

    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: false,
      float: 4.25,
      id: '456',
      int: 8,
      odd: 9,
      string: 'false',
    });
  });

  it('reports generated async scalar rejection errors', async () => {
    const result = await executeQueryFixture({
      contextValue: {
        string: Promise.reject(new Error('string failed')),
      },
    });

    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors?.[0]?.message).to.equal('string failed');
    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: true,
      float: 3.5,
      id: '123',
      int: 6,
      odd: 9,
      string: null,
    });
  });

  it('reports generated built-in scalar object coercion errors', async () => {
    const result = await executeQueryFixture({
      contextValue: { int: Object.create(null) as unknown },
    });

    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors?.[0]?.message).to.equal(
      'Int cannot represent non-integer value: {}',
    );
    expectJSON(getResultData(result).scalarBox).toDeepEqual({
      bool: true,
      float: 3.5,
      id: '123',
      int: null,
      odd: 9,
      string: '42',
    });
  });

  it('reports generated built-in scalar primitive coercion errors', async () => {
    const cases: ReadonlyArray<{
      contextValue: QueryFixtureContext;
      fieldName: keyof NonNullable<ReturnType<typeof scalarBoxFixture>>;
      message?: string;
      messageIncludes?: string;
    }> = [
      {
        contextValue: { bool: Number.NaN },
        fieldName: 'bool',
        message: 'Boolean cannot represent a non boolean value: NaN',
      },
      {
        contextValue: { bool: Object.create(null) as unknown },
        fieldName: 'bool',
        message: 'Boolean cannot represent a non boolean value: {}',
      },
      {
        contextValue: { float: Number.NaN },
        fieldName: 'float',
        message: 'Float cannot represent non numeric value: NaN',
      },
      {
        contextValue: { float: Object.create(null) as unknown },
        fieldName: 'float',
        message: 'Float cannot represent non numeric value: {}',
      },
      {
        contextValue: { float: '' },
        fieldName: 'float',
        message: 'Float cannot represent non numeric value: ""',
      },
      {
        contextValue: { float: 'abc' },
        fieldName: 'float',
        message: 'Float cannot represent non numeric value: "abc"',
      },
      {
        contextValue: { float: 2n ** 1024n },
        fieldName: 'float',
        messageIncludes: '(value is too large)',
      },
      {
        contextValue: { float: 9007199254740993n },
        fieldName: 'float',
        messageIncludes: '(value would lose precision)',
      },
      {
        contextValue: { scalarId: Object.create(null) as unknown },
        fieldName: 'id',
        message: 'ID cannot represent value: {}',
      },
      {
        contextValue: { scalarId: 1.5 },
        fieldName: 'id',
        message: 'ID cannot represent value: 1.5',
      },
      {
        contextValue: { int: 1.5 },
        fieldName: 'int',
        message: 'Int cannot represent non-integer value: 1.5',
      },
      {
        contextValue: { int: 2147483648 },
        fieldName: 'int',
        message:
          'Int cannot represent non 32-bit signed integer value: 2147483648',
      },
      {
        contextValue: { int: '' },
        fieldName: 'int',
        message: 'Int cannot represent non-integer value: ""',
      },
      {
        contextValue: { int: '1.5' },
        fieldName: 'int',
        message: 'Int cannot represent non-integer value: "1.5"',
      },
      {
        contextValue: { int: '2147483648' },
        fieldName: 'int',
        message:
          'Int cannot represent non 32-bit signed integer value: "2147483648"',
      },
      {
        contextValue: { int: 2147483648n },
        fieldName: 'int',
        message:
          'Int cannot represent non 32-bit signed integer value: 2147483648',
      },
      {
        contextValue: { string: Object.create(null) as unknown },
        fieldName: 'string',
        message: 'String cannot represent value: {}',
      },
      {
        contextValue: { string: Number.NaN },
        fieldName: 'string',
        message: 'String cannot represent value: NaN',
      },
    ];

    const results = await Promise.all(
      cases.map(async (testCase) => ({
        result: await executeQueryFixture({
          contextValue: testCase.contextValue,
        }),
        testCase,
      })),
    );

    for (const { result, testCase } of results) {
      expect(result.errors, testCase.fieldName).to.have.lengthOf(1);
      if (testCase.message !== undefined) {
        expect(result.errors?.[0]?.message).to.equal(testCase.message);
      }
      if (testCase.messageIncludes !== undefined) {
        expect(result.errors?.[0]?.message).to.include(
          testCase.messageIncludes,
        );
      }
      expect(scalarBoxFixture(result)[testCase.fieldName]).to.equal(null);
    }
  });

  it('exposes the generated query fixture through every execution entrypoint', async () => {
    const generated = await createQueryFixtureExecution();
    const executeIgnoringIncrementalResult = await Promise.resolve(
      generated.executeIgnoringIncremental({
        rootValue: createQueryFixtureRootValue(),
        variableValues: queryVariables(),
      }),
    );
    const incrementalResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally({
        rootValue: createQueryFixtureRootValue(),
        variableValues: queryVariables(),
      }),
    );

    expectJSON(executeIgnoringIncrementalResult).toDeepEqual(
      await executeQueryFixture(),
    );
    expectJSON(incrementalResult).toDeepEqual(await executeQueryFixture());
  });

  it('runs generated query hooks and removes external abort listeners', async () => {
    const calls: Array<string> = [];
    let abortListener: (() => void) | undefined;
    const abortSignal = {
      throwIfAborted() {
        calls.push('throwIfAborted');
      },
      addEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        abortListener = listener;
        calls.push('addEventListener');
      },
      removeEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        expect(listener).to.equal(abortListener);
        calls.push('removeEventListener');
      },
    } as AbortSignal;
    const generated = await createQueryFixtureExecution({
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWorkFinished');
        },
      },
    });

    const invalidVariablesResult = await Promise.resolve(
      generated.execute({
        variableValues: {
          ...queryVariables(),
          id: null,
        },
      }),
    );
    expect(invalidVariablesResult.errors).to.have.lengthOf(1);

    const result = await Promise.resolve(
      generated.execute({
        rootValue: createQueryFixtureRootValue(),
        variableValues: queryVariables(),
        contextValue: { asyncRoot: true },
        abortSignal,
      }),
    );

    expect(result.errors).to.equal(undefined);
    await setImmediate();
    expect(calls.join(',')).to.equal(
      'throwIfAborted,addEventListener,removeEventListener,asyncWorkFinished',
    );
  });

  it('responds to generated query external abort signals', async () => {
    const calls: Array<string> = [];
    let abortListener: (() => void) | undefined;
    const abortSignal = {
      reason: new Error('stop'),
      throwIfAborted() {
        calls.push('throwIfAborted');
      },
      addEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        abortListener = listener;
        calls.push('addEventListener');
        listener();
      },
      removeEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        expect(listener).to.equal(abortListener);
        calls.push('removeEventListener');
      },
    } as AbortSignal;
    const generated = await createQueryFixtureExecution();

    try {
      await Promise.resolve(
        generated.execute({
          rootValue: createQueryFixtureRootValue(),
          variableValues: queryVariables(),
          contextValue: {},
          abortSignal,
        }),
      );
      throw new Error('Expected generated execution to abort.');
    } catch (error) {
      expect((error as Error).message).to.equal('stop');
      expect((error as { abortedResult?: unknown }).abortedResult).to.not.equal(
        undefined,
      );
    }

    expect(calls).to.deep.equal([
      'throwIfAborted',
      'addEventListener',
      'removeEventListener',
    ]);
  });

  it('reports generated query runtime schema incompatibility', async () => {
    const module =
      await importFixtureModule<GeneratedExecutionModule>('query.mjs');
    expect(() =>
      module.createCompiledExecution({
        schema: buildSchema('type Query { other: String }'),
      }),
    ).to.throw(
      'Generated execution is incompatible with the provided runtime arguments.',
    );
  });

  it('executes the incremental fixture from generated source', async () => {
    const module =
      await importFixtureModule<GeneratedExecutionModule>('incremental.mjs');
    const generated = module.createCompiledExecution({
      schema: createKitchenSinkFixtureSchema(),
    });
    assert('experimentalExecuteIncrementally' in generated);

    const result = await Promise.resolve(
      generated.experimentalExecuteIncrementally({
        contextValue: { asyncDeferred: true },
      }),
    );
    assert('initialResult' in result);
    expectJSON(result.initialResult).toDeepEqual({
      data: {
        immediate: 'first',
        streamItems: [{ id: '1', label: 'one' }],
      },
      pending: [
        { id: '0', path: [], label: 'deferred' },
        { id: '1', path: ['streamItems'], label: 'streamed' },
      ],
      hasNext: true,
    });
    expectNullPrototypeData(result.initialResult.data);

    const subsequentResults = await collectAsyncIterable(
      result.subsequentResults,
    );
    expectJSON(subsequentResults).toDeepEqual([
      {
        hasNext: false,
        incremental: [
          {
            id: '1',
            items: [{ id: '2', label: 'two' }],
          },
          {
            id: '0',
            data: { deferred: 'later' },
          },
        ],
        completed: [{ id: '1' }, { id: '0' }],
      },
    ]);
  });

  it('executes incremental fixture with hooks and abort signal', async () => {
    const module =
      await importFixtureModule<GeneratedExecutionModule>('incremental.mjs');
    const calls: Array<string> = [];
    const generated = module.createCompiledExecution({
      schema: createKitchenSinkFixtureSchema(),
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWorkFinished');
        },
      },
    });
    assert('experimentalExecuteIncrementally' in generated);

    const result = await Promise.resolve(
      generated.experimentalExecuteIncrementally({
        abortSignal: new AbortController().signal,
        contextValue: { asyncDeferred: true },
      }),
    );
    assert('initialResult' in result);
    expectJSON(result.initialResult.data).toDeepEqual({
      immediate: 'first',
      streamItems: [{ id: '1', label: 'one' }],
    });
    await collectAsyncIterable(result.subsequentResults);
    expect(calls).to.deep.equal(['asyncWorkFinished']);
  });

  it('executes incremental fixture non-incremental entrypoints', async () => {
    const module =
      await importFixtureModule<GeneratedExecutionModule>('incremental.mjs');
    const generated = module.createCompiledExecution({
      schema: createKitchenSinkFixtureSchema(),
    });
    assert('execute' in generated);
    const executionArgs = { contextValue: { asyncDeferred: true } };

    try {
      await Promise.resolve(generated.execute(executionArgs));
      throw new Error('Expected execute to reject incremental delivery.');
    } catch (error) {
      expectJSON(
        (error as { abortedResult?: unknown }).abortedResult,
      ).toDeepEqual({
        errors: [
          {
            message:
              'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
          },
        ],
        data: null,
      });
    }

    const result = await Promise.resolve(
      generated.executeIgnoringIncremental(executionArgs),
    );
    expectJSON(result).toDeepEqual({
      data: {
        immediate: 'first',
        deferred: 'later',
        streamItems: [
          { id: '1', label: 'one' },
          { id: '2', label: 'two' },
        ],
      },
    });
    assert('data' in result);
    expectNullPrototypeData(result.data);
  });

  it('reports generated incremental runtime schema incompatibility', async () => {
    const module =
      await importFixtureModule<GeneratedExecutionModule>('incremental.mjs');
    expect(() =>
      module.createCompiledExecution({
        schema: buildSchema('type Query { other: String }'),
      }),
    ).to.throw(
      'Generated execution is incompatible with the provided runtime arguments.',
    );
  });

  it('executes the subscription fixture from generated source', async () => {
    const module =
      await importFixtureModule<GeneratedSubscriptionModule>(
        'subscription.mjs',
      );
    const generated = module.createCompiledSubscription({
      schema: createKitchenSinkFixtureSchema(),
    });
    assert('subscribe' in generated);

    const result = await Promise.resolve(
      generated.subscribe({ variableValues: { enabled: true } }),
    );
    assertAsyncIterable(result);
    const values = await collectAsyncIterable(result);
    expectJSON(values).toDeepEqual([
      { data: { event: { id: '1', label: 'first' } } },
      { data: { event: { id: '2', label: 'second' } } },
    ]);
    for (const value of values) {
      expectNullPrototypeData((value as { data?: unknown }).data);
    }
  });

  it('executes subscription fixture execution entrypoints and empty streams', async () => {
    const module =
      await importFixtureModule<GeneratedSubscriptionModule>(
        'subscription.mjs',
      );
    const generated = module.createCompiledSubscription({
      schema: createKitchenSinkFixtureSchema(),
    });
    assert('subscribe' in generated);

    const executionArgs = {
      rootValue: { event: { id: 'root', label: 'event' } },
      variableValues: { enabled: true },
    };
    const expected = { data: { event: { id: 'root', label: 'event' } } };
    expectJSON(
      await Promise.resolve(generated.execute(executionArgs)),
    ).toDeepEqual(expected);
    expectJSON(
      await Promise.resolve(
        generated.executeIgnoringIncremental(executionArgs),
      ),
    ).toDeepEqual(expected);
    expectJSON(
      await Promise.resolve(
        generated.experimentalExecuteIncrementally(executionArgs),
      ),
    ).toDeepEqual(expected);

    const emptyStream = await Promise.resolve(
      generated.subscribe({ variableValues: { enabled: false } }),
    );
    assertAsyncIterable(emptyStream);
    expectJSON(await collectAsyncIterable(emptyStream)).toDeepEqual([]);

    const invalidVariables = await Promise.resolve(
      generated.subscribe({ variableValues: { enabled: null } }),
    );
    assert(!isAsyncIterableValue(invalidVariables));
    expect(invalidVariables.errors).to.have.lengthOf(1);
  });

  it('executes subscription helper paths for promised streams and abort-aware mapping', async () => {
    const generated = await createSubscriptionFixtureExecution();
    const validatedExecutionArgs = validateSubscriptionArgs({
      schema: createKitchenSinkFixtureSchema(),
      document: subscriptionFixtureDocument,
      variableValues: { enabled: true },
      contextValue: {
        eventId: 2,
        eventLabel: false,
        resolveEventAsync: true,
        subscribeMode: 'promise',
      },
      abortSignal: new AbortController().signal,
    });
    assert('operation' in validatedExecutionArgs);

    const sourceEventStream = await Promise.resolve(
      generated.createSourceEventStream(validatedExecutionArgs),
    );
    assertAsyncIterable(sourceEventStream);

    const responseStream = generated.mapSourceToResponseEvent(
      validatedExecutionArgs,
      sourceEventStream,
    );
    assertAsyncIterable(responseStream);
    expectJSON(await collectAsyncIterable(responseStream)).toDeepEqual([
      { data: { event: { id: '2', label: 'false' } } },
      { data: { event: { id: '2', label: 'false' } } },
    ]);
  });

  it('reports generated subscription source failures', async () => {
    const generated = await createSubscriptionFixtureExecution();
    const cases: ReadonlyArray<{
      contextValue: SubscriptionFixtureContext;
      messageIncludes: string;
    }> = [
      {
        contextValue: { subscribeMode: 'reject' },
        messageIncludes: 'subscription source rejected',
      },
      {
        contextValue: { subscribeMode: 'throw' },
        messageIncludes: 'subscription source failed',
      },
      {
        contextValue: { subscribeMode: 'error' },
        messageIncludes: 'subscription source error',
      },
      {
        contextValue: { subscribeMode: 'nonIterable' },
        messageIncludes: 'Subscription field must return Async Iterable.',
      },
    ];

    const results = await Promise.all(
      cases.map(async (testCase) => ({
        result: await Promise.resolve(
          generated.subscribe({
            variableValues: { enabled: true },
            contextValue: testCase.contextValue,
          }),
        ),
        testCase,
      })),
    );

    for (const { result, testCase } of results) {
      assert(!isAsyncIterableValue(result));
      expect(result.errors?.[0]?.message).to.include(testCase.messageIncludes);
    }

    expect(() => generated.createSourceEventStream({} as never)).to.throw(
      'Passing ExecutionArgs to createSourceEventStream() was removed in graphql-js@17.0.0',
    );
  });

  it('reports generated subscription runtime schema incompatibility', async () => {
    const module =
      await importFixtureModule<GeneratedSubscriptionModule>(
        'subscription.mjs',
      );
    expect(() =>
      module.createCompiledSubscription({
        schema: buildSchema(`
          type Query { noop: String }
          type Subscription { other: String }
        `),
      }),
    ).to.throw(
      'Generated subscription is incompatible with the provided runtime arguments.',
    );
  });
});

async function createQueryFixtureExecution(
  args: {
    hooks?: unknown;
  } = {},
): Promise<CompiledExecution> {
  const module =
    await importFixtureModule<GeneratedExecutionModule>('query.mjs');
  const generated = module.createCompiledExecution({
    schema: createKitchenSinkFixtureSchema(),
    ...args,
  });
  assert('execute' in generated);
  return generated;
}

async function createSubscriptionFixtureExecution(): Promise<CompiledSubscription> {
  const module =
    await importFixtureModule<GeneratedSubscriptionModule>('subscription.mjs');
  const generated = module.createCompiledSubscription({
    schema: createKitchenSinkFixtureSchema(),
  });
  assert('subscribe' in generated);
  return generated;
}

async function executeQueryFixture(
  args: {
    contextValue?: QueryFixtureContext;
    variableValues?: { [key: string]: unknown };
  } = {},
): Promise<Awaited<ReturnType<CompiledExecution['execute']>>> {
  const generated = await createQueryFixtureExecution();
  return Promise.resolve(
    generated.execute({
      rootValue: createQueryFixtureRootValue(),
      variableValues: args.variableValues ?? queryVariables(),
      contextValue: args.contextValue,
    }),
  );
}

function queryVariables(): { [key: string]: unknown } {
  return {
    id: 'q1',
    includeOptional: true,
    input: { marker: 'mark' },
    skipMaybe: false,
    value: 4,
  };
}

function getResultData(
  result: Awaited<ReturnType<CompiledExecution['execute']>>,
): { [key: string]: unknown; scalarBox?: unknown } {
  assert(result.data != null && typeof result.data === 'object');
  return result.data;
}

function scalarBoxFixture(
  result: Awaited<ReturnType<CompiledExecution['execute']>>,
): {
  bool?: unknown;
  float?: unknown;
  id?: unknown;
  int?: unknown;
  odd?: unknown;
  string?: unknown;
} {
  const { scalarBox } = getResultData(result);
  assert(scalarBox != null && typeof scalarBox === 'object');
  return scalarBox;
}

async function importFixtureModule<T>(filename: string): Promise<T> {
  return (await import(
    pathToFileURL(path.join(generatedFixtureDir, filename)).href
  )) as T;
}

async function collectAsyncIterable(
  iterable: AsyncIterable<unknown>,
): Promise<ReadonlyArray<unknown>> {
  const values = [];
  for await (const value of iterable) {
    values.push(value);
  }
  return values;
}

function assertAsyncIterable(
  value: unknown,
): asserts value is AsyncIterable<unknown> {
  assert(
    value != null &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as Partial<AsyncIterable<unknown>>)[
        Symbol.asyncIterator
      ] === 'function',
  );
}

function assertObject(value: unknown): asserts value is {
  [key: string]: unknown;
} {
  assert(value != null && typeof value === 'object');
}

function isAsyncIterableValue(value: unknown): value is AsyncIterable<unknown> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as Partial<AsyncIterable<unknown>>)[Symbol.asyncIterator] ===
      'function'
  );
}

function expectNullPrototypeData(value: unknown): void {
  if (value == null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      expectNullPrototypeData(item);
    }
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  expect(Object.getPrototypeOf(value)).to.equal(null);
  for (const childValue of Object.values(value)) {
    expectNullPrototypeData(childValue);
  }
}
