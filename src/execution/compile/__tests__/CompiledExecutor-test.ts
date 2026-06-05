import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';
import { expectPromise } from '../../../__testUtils__/expectPromise.ts';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.ts';

import type { PromiseOrValue } from '../../../jsutils/PromiseOrValue.ts';
import { promiseWithResolvers } from '../../../jsutils/promiseWithResolvers.ts';

import { parse } from '../../../language/parser.ts';

import type { GraphQLResolveInfo } from '../../../type/definition.ts';
import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import type { DeferUsage, FieldDetailsList } from '../../collectFields.ts';
import type { ValidatedExecutionArgs } from '../../ExecutionArgs.ts';
import type { ExecutionResult } from '../../Executor.ts';
import type {
  DeliveryGroup,
  ExperimentalIncrementalExecutionResults,
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../../incremental/IncrementalExecutor.ts';

import {
  CompiledExecutionRunner,
  CompiledExecutor,
} from '../CompiledExecutor.ts';
import type {
  CompiledExecution,
  CompiledExecutionArgs,
  CompileExecutionArgs,
} from '../index.ts';
import { compileExecution } from '../index.ts';

describe('compiled executor', () => {
  it('runs asyncWorkFinished hooks', () => {
    let hookCalls = 0;
    const compiled = compileExecution({
      schema: new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            test: {
              type: GraphQLString,
              resolve: () => 'ok',
            },
          },
        }),
      }),
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          hookCalls++;
        },
      },
    });

    assert('execute' in compiled);
    expect(compiled.execute()).to.deep.equal({ data: { test: 'ok' } });
    expect(hookCalls).to.equal(1);
  });

  it('removes external abort listener when root execution setup throws', () => {
    const abortController = new AbortController();
    const compiled = compileExecution({
      schema: new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            test: {
              type: GraphQLString,
              resolve: () => 'ok',
            },
          },
        }),
      }),
      document: parse('mutation { test }'),
    });

    assert('execute' in compiled);
    const result = compiled.execute({
      abortSignal: abortController.signal,
    });
    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Schema is not configured to execute mutation operation.',
          locations: [{ line: 1, column: 1 }],
        },
      ],
    });
  });

  it('aborts pending compiled execution', async () => {
    const abortController = new AbortController();
    const { promise, resolve } = promiseWithResolvers<unknown>();
    const { promise: lateValue, resolve: resolveLateValue } =
      promiseWithResolvers<string>();
    const { promise: lateError, reject: rejectLateError } =
      promiseWithResolvers<string>();
    let resolverAbortSignal: AbortSignal | undefined;
    const testInterface = new GraphQLInterfaceType({
      name: 'AbortTest',
      fields: {
        value: { type: GraphQLString },
      },
      resolveType: () => 'AbortTestObject',
    });
    const compiled = compileExecution({
      schema: new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            test: {
              type: testInterface,
              resolve(_source, _args, _context, info) {
                resolverAbortSignal = info.getAbortSignal();
                expect(resolverAbortSignal).to.be.instanceOf(AbortSignal);
                expect(resolverAbortSignal?.aborted).to.equal(false);
                return promise;
              },
            },
            lateValue: {
              type: GraphQLString,
              resolve: () => lateValue,
            },
            lateError: {
              type: GraphQLString,
              resolve: () => lateError,
            },
          },
        }),
        types: [
          new GraphQLObjectType({
            name: 'AbortTestObject',
            interfaces: [testInterface],
            fields: {
              value: { type: GraphQLString },
            },
          }),
        ],
      }),
      document: parse('{ test { value } lateValue lateError }'),
    });

    assert('execute' in compiled);
    const result = compiled.execute({ abortSignal: abortController.signal });
    abortController.abort(new Error('Custom abort error'));

    await expectPromise(result).toRejectWith('Custom abort error');
    expect(resolverAbortSignal?.aborted).to.equal(true);

    resolve({ value: 'late' });
    await resolveOnNextTick();
    await resolveOnNextTick();
    resolveLateValue('ignored');
    rejectLateError(new Error('ignored'));
    await resolveOnNextTick();
    await resolveOnNextTick();
  });

  it('aborts if the external signal fires before async root setup finishes', async () => {
    const abortController = new AbortController();
    const { promise } = promiseWithResolvers<string>();
    const compiled = compileExecution({
      schema: new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            test: {
              type: GraphQLString,
              resolve() {
                abortController.abort(new Error('Setup abort'));
                return promise;
              },
            },
          },
        }),
      }),
      document: parse('{ test }'),
    });

    assert('execute' in compiled);
    const result = compiled.execute({ abortSignal: abortController.signal });

    await expectPromise(result).toRejectWith('Setup abort');
  });

  it('compares defer usage sets across sub executors', () => {
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs(),
      'incremental',
    );
    const parent: DeferUsage = {
      label: 'parent',
      parentDeferUsage: undefined,
    };
    const child: DeferUsage = {
      label: 'child',
      parentDeferUsage: parent,
    };

    expect(executor.isCurrentDeferUsageSet(new Set([child]))).to.equal(false);

    const deferUsageSet = new Set([child]);
    const subExecutor = executor.createSubExecutor(deferUsageSet);
    expect(subExecutor.isCurrentDeferUsageSet(deferUsageSet)).to.equal(true);
    expect(subExecutor.isCurrentDeferUsageSet(new Set([parent]))).to.equal(
      false,
    );

    const other: DeferUsage = {
      label: 'other',
      parentDeferUsage: undefined,
    };
    const otherSubExecutor = executor.createSubExecutor(new Set([other]));
    expect(otherSubExecutor.isCurrentDeferUsageSet(deferUsageSet)).to.equal(
      false,
    );
    expect(otherSubExecutor.isCurrentDeferUsageSet(new Set([other]))).to.equal(
      true,
    );
  });

  it('primes preplanned deferred execution groups already in the current defer set', () => {
    const child: DeferUsage = {
      label: 'child',
      parentDeferUsage: undefined,
    };
    const deferUsageSet = new Set([child]);
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs({ enableEarlyExecution: true }),
      'incremental',
      undefined,
      deferUsageSet,
    );
    const deliveryGroupMap = new Map([
      [child, { label: child.label, parent: undefined, path: undefined }],
    ]);
    let executed = false;

    executor.deferPreplannedExecutionGroup(
      deferUsageSet,
      deliveryGroupMap,
      undefined,
      { value: 'source' },
      (_subExecutor, _runner, source, target) => {
        executed = true;
        expect(source).to.deep.equal({ value: 'source' });
        expect(Object.getPrototypeOf(target)).to.equal(null);
      },
    );

    expect(executed).to.equal(true);
  });

  it('tracks deferred preplanned execution groups as background work', async () => {
    const child: DeferUsage = {
      label: 'child',
      parentDeferUsage: undefined,
    };
    const deferUsageSet = new Set([child]);
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs({ enableEarlyExecution: true }),
      'incremental',
    );
    const deliveryGroupMap = new Map([
      [child, { label: child.label, parent: undefined, path: undefined }],
    ]);
    let executed = false;

    executor.deferPreplannedExecutionGroup(
      deferUsageSet,
      deliveryGroupMap,
      undefined,
      { value: 'source' },
      () => {
        executed = true;
      },
    );

    expect(executed).to.equal(false);
    await executor.sharedExecutionContext.asyncWorkTracker.wait();
    expect(executed).to.equal(true);
  });

  it('aborts deferred preplanned execution groups before they execute', () => {
    const child: DeferUsage = {
      label: 'child',
      parentDeferUsage: undefined,
    };
    const deferUsageSet = new Set([child]);
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs(),
      'incremental',
    );
    const deliveryGroupMap = new Map([
      [child, { label: child.label, parent: undefined, path: undefined }],
    ]);

    executor.deferPreplannedExecutionGroup(
      deferUsageSet,
      deliveryGroupMap,
      undefined,
      { value: 'source' },
      () => {
        throw new Error('Should not execute');
      },
    );

    const aborted = executor.tasks[0].computation.abort(
      new Error('Stop deferred group'),
    );
    expect(aborted).to.equal(undefined);
  });

  it('aborts pending preplanned execution groups', () => {
    const child: DeferUsage = {
      label: 'child',
      parentDeferUsage: undefined,
    };
    const deferUsageSet = new Set([child]);
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs({ enableEarlyExecution: true }),
      'incremental',
      undefined,
      deferUsageSet,
    );
    const deliveryGroupMap = new Map([
      [child, { label: child.label, parent: undefined, path: undefined }],
    ]);
    const reason = new Error('Stop pending group');
    let deferredExecutor: CompiledExecutor | undefined;

    executor.deferPreplannedExecutionGroup(
      deferUsageSet,
      deliveryGroupMap,
      undefined,
      { value: 'source' },
      (subExecutor, runner) => {
        deferredExecutor = subExecutor;
        setRunnerPending(runner, 1);
      },
    );

    const aborted = executor.tasks[0].computation.abort(reason);
    expect(aborted).to.equal(undefined);
    assert(deferredExecutor !== undefined);
    expect(deferredExecutor.aborted).to.equal(true);
    expect(deferredExecutor.abortReason).to.equal(reason);
  });

  it('executes asynchronous preplanned execution groups', async () => {
    const child: DeferUsage = {
      label: 'child',
      parentDeferUsage: undefined,
    };
    const deliveryGroup: DeliveryGroup = {
      label: child.label,
      parent: undefined,
      path: undefined,
    };
    const deliveryGroupMap = new Map([[child, deliveryGroup]]);
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs(),
      'incremental',
    );

    const result = executor.executePreplannedExecutionGroup(
      [deliveryGroup],
      undefined,
      { value: 'source' },
      deliveryGroupMap,
      (...executionGroupArgs) => {
        const [, runner, source, target, parentNullTarget, groups] =
          executionGroupArgs;
        expect(source).to.deep.equal({ value: 'source' });
        expect(parentNullTarget.key).to.equal('data');
        assert(groups !== undefined);
        expect(groups.get(child)).to.equal(deliveryGroup);
        target.value = 'sync';
        setRunnerPending(runner, 1);
        Promise.resolve().then(() => {
          target.value = 'async';
          setRunnerPending(runner, 0);
          runner._drainIfReady();
        });
      },
    );

    expect(result).to.be.instanceOf(Promise);
    const resolved = await result;
    expect(resolved.value.deliveryGroups).to.deep.equal([deliveryGroup]);
    expect(resolved.value.path).to.deep.equal([]);
    expectJSON(resolved.value.data).toDeepEqual({ value: 'async' });
    expect(resolved.work).to.deep.equal({});
  });

  it('uses custom stream item completers', async () => {
    const executor = new CompiledExecutor(
      getValidatedExecutionArgs({ enableEarlyExecution: true }),
      'incremental',
    );
    const streamUsage = {
      label: 'items',
      initialCount: 0,
      fieldDetailsList: [] as unknown as FieldDetailsList,
    };

    const handled = executor.handleStream(
      0,
      { prev: undefined, key: 'values', typename: undefined },
      { handle: ['value'][Symbol.iterator]() },
      streamUsage,
      {} as GraphQLResolveInfo,
      GraphQLString,
      (_subExecutor, _itemPath, item, index) => ({
        value: { item: `${String(item)}:${index}` },
      }),
    );

    expect(handled).to.equal(true);
    const results: Array<unknown> = [];
    for await (const batch of executor.streams[0].queue.subscribe((generator) =>
      Array.from(generator),
    )) {
      results.push(...batch);
    }
    expectJSON(results).toDeepEqual([{ value: { item: 'value:0' } }]);
  });

  it('resolves preplanned runners after pending work drains', async () => {
    let didDrain = false;
    const runner = new CompiledExecutionRunner({
      applyNulledTargets() {
        return undefined;
      },
    } as unknown as CompiledExecutor);

    setRunnerPending(runner, 1);
    const result = runner.runUntilNulled(undefined);
    runner.runWhenDrained(() => {
      didDrain = true;
    });
    runner._drainIfReady();
    expect(didDrain).to.equal(false);
    setRunnerPending(runner, 0);
    runner._drainIfReady();

    expect(result).to.be.instanceOf(Promise);
    await result;
    expect(didDrain).to.equal(true);
    expect(runner._settled).to.equal(true);
  });

  it('rejects preplanned runners when pending drain fails', async () => {
    const error = new Error('pending drain failed');
    const runner = new CompiledExecutionRunner({
      applyNulledTargets() {
        throw error;
      },
    } as unknown as CompiledExecutor);

    setRunnerPending(runner, 1);
    const result = runner.runUntilNulled(undefined);
    setRunnerPending(runner, 0);
    runner._drainIfReady();

    await expectPromise(result).toRejectWith('pending drain failed');
    expect(runner._settled).to.equal(true);
  });

  it('covers execution runner throwing drain paths', () => {
    const error = new Error('drain failed');
    const failingRunner = new CompiledExecutionRunner({
      applyNulledTargets() {
        throw error;
      },
    } as unknown as CompiledExecutor);
    expect(() => failingRunner.drain()).to.throw(error);
  });

  it('covers preplanned runner awaitValue edge paths', async () => {
    const thenError = new Error('then failed');
    const thenRunner = createExecutionRunner();
    let rejectedReason: unknown;
    thenRunner.awaitValue(
      {
        then() {
          throw thenError;
        },
      },
      () => {
        throw new Error('unexpected resolve');
      },
      (reason) => {
        rejectedReason = reason;
      },
      undefined,
    );
    expect(rejectedReason).to.equal(thenError);
    expect(getRunnerPending(thenRunner)).to.equal(0);

    const { promise: settledResolvePromise, resolve: resolveSettled } =
      promiseWithResolvers<string>();
    const settledResolveRunner = createExecutionRunner();
    let resolved = false;
    settledResolveRunner.awaitValue(
      settledResolvePromise,
      () => {
        resolved = true;
      },
      () => {
        throw new Error('unexpected reject');
      },
      undefined,
    );
    settledResolveRunner._settled = true;
    resolveSettled('ignored');
    await resolveOnNextTick();
    expect(resolved).to.equal(false);
    expect(getRunnerPending(settledResolveRunner)).to.equal(0);

    const { promise: settledRejectPromise, reject: rejectSettled } =
      promiseWithResolvers<string>();
    const settledRejectRunner = createExecutionRunner();
    let settledRejectedReason: unknown;
    settledRejectRunner.awaitValue(
      settledRejectPromise,
      () => {
        throw new Error('unexpected resolve');
      },
      (reason) => {
        settledRejectedReason = reason;
      },
      undefined,
    );
    settledRejectRunner._settled = true;
    rejectSettled(new Error('ignored'));
    await resolveOnNextTick();
    expect(settledRejectedReason).to.equal(undefined);
    expect(getRunnerPending(settledRejectRunner)).to.equal(0);

    const resolveError = new Error('resolve failed');
    const resolveRunner = createExecutionRunner();
    resolveRunner.awaitValue(
      Promise.resolve('value'),
      () => {
        throw resolveError;
      },
      () => {
        throw new Error('unexpected reject');
      },
      undefined,
    );
    await expectPromise(resolveRunner.runUntilNulled(undefined)).toRejectWith(
      'resolve failed',
    );
    expect(resolveRunner._settled).to.equal(true);

    const rejectError = new Error('reject failed');
    const rejectRunner = createExecutionRunner();
    rejectRunner.awaitValue(
      Promise.reject(new Error('source failed')),
      () => {
        throw new Error('unexpected resolve');
      },
      () => {
        throw rejectError;
      },
      undefined,
    );
    await expectPromise(rejectRunner.runUntilNulled(undefined)).toRejectWith(
      'reject failed',
    );
    expect(rejectRunner._settled).to.equal(true);
  });

  it('creates already-aborted resolver signals after resolver abort finishes', () => {
    const defaultAbortExecutor = new CompiledExecutor(
      getValidatedExecutionArgs(),
      'throw',
    );
    callAbortResolverSignal(defaultAbortExecutor);
    const defaultAbortSignal = defaultAbortExecutor.getAbortSignal();
    expect(defaultAbortSignal?.aborted).to.equal(true);
    expect(defaultAbortSignal?.reason).to.be.instanceOf(Error);

    const customAbortExecutor = new CompiledExecutor(
      getValidatedExecutionArgs(),
      'throw',
    );
    const reason = new Error('Custom resolver abort');
    callAbortResolverSignal(customAbortExecutor, reason);
    const customAbortSignal = customAbortExecutor.getAbortSignal();
    expect(customAbortSignal?.aborted).to.equal(true);
    expect(customAbortSignal?.reason).to.equal(reason);
  });

  it('reports scalar coercion errors from compiled leaf paths', async () => {
    const scalar = new GraphQLScalarType({
      name: 'CompiledScalar',
      coerceOutputValue(value) {
        if (value === 'throw') {
          throw new Error('Cannot coerce compiled scalar');
        }
        if (value === 'null') {
          return null;
        }
        return value;
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          syncThrow: { type: scalar, resolve: () => 'throw' },
          syncNull: { type: scalar, resolve: () => 'null' },
          asyncThrow: {
            type: scalar,
            resolve: () => Promise.resolve('throw'),
          },
          list: {
            type: new GraphQLList(scalar),
            resolve: () => ['ok', 'throw', 'null'],
          },
        },
      }),
    });

    const result = await executeCompiled(
      schema,
      '{ syncThrow syncNull asyncThrow list }',
    );

    expectJSON(result).toDeepEqual({
      data: {
        syncThrow: null,
        syncNull: null,
        asyncThrow: null,
        list: ['ok', null, null],
      },
      errors: [
        {
          message: 'Cannot coerce compiled scalar',
          locations: [{ line: 1, column: 3 }],
          path: ['syncThrow'],
        },
        {
          message:
            'Expected `CompiledScalar.coerceOutputValue("null")` to return non-nullable value, returned: null',
          locations: [{ line: 1, column: 13 }],
          path: ['syncNull'],
        },
        {
          message: 'Cannot coerce compiled scalar',
          locations: [{ line: 1, column: 33 }],
          path: ['list', 1],
        },
        {
          message:
            'Expected `CompiledScalar.coerceOutputValue("null")` to return non-nullable value, returned: null',
          locations: [{ line: 1, column: 33 }],
          path: ['list', 2],
        },
        {
          message: 'Cannot coerce compiled scalar',
          locations: [{ line: 1, column: 22 }],
          path: ['asyncThrow'],
        },
      ],
    });
  });

  it('reports async scalar coercion nulls from compiled leaf paths', async () => {
    const scalar = new GraphQLScalarType({
      name: 'AsyncNullScalar',
      coerceOutputValue() {
        return null;
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: {
            type: scalar,
            resolve: () => Promise.resolve('value'),
          },
        },
      }),
    });

    const result = await executeCompiled(schema, '{ value }');

    expectJSON(result).toDeepEqual({
      data: { value: null },
      errors: [
        {
          message:
            'Expected `AsyncNullScalar.coerceOutputValue("value")` to return non-nullable value, returned: null',
          locations: [{ line: 1, column: 3 }],
          path: ['value'],
        },
      ],
    });
  });

  it('completes serial mutation leaf fields through the generic path', async () => {
    const scalar = new GraphQLScalarType({
      name: 'SerialNullScalar',
      coerceOutputValue() {
        return null;
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          noop: { type: GraphQLString },
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          value: {
            type: scalar,
            resolve: () => 'value',
          },
        },
      }),
    });

    const result = await executeCompiled(schema, 'mutation { value }');

    expectJSON(result).toDeepEqual({
      data: { value: null },
      errors: [
        {
          message:
            'Expected `SerialNullScalar.coerceOutputValue("value")` to return non-nullable value, returned: null',
          locations: [{ line: 1, column: 12 }],
          path: ['value'],
        },
      ],
    });
  });

  it('skips duplicate errors below an already nulled list path', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          values: {
            type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
            resolve: () => [new Error('first'), new Error('second')],
          },
        },
      }),
    });

    const result = await executeCompiled(schema, '{ values }');

    expectJSON(result).toDeepEqual({
      data: { values: null },
      errors: [
        {
          message: 'first',
          locations: [{ line: 1, column: 3 }],
          path: ['values', 0],
        },
      ],
    });
  });

  it('uses the compiled default field resolver with function sources', async () => {
    function root() {
      return undefined;
    }
    Object.assign(root, { value: 'resolved' });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: { type: GraphQLString },
        },
      }),
    });

    const result = await executeCompiled(schema, '{ value }', {
      rootValue: root,
    });

    expectJSON(result).toDeepEqual({
      data: { value: 'resolved' },
    });
  });

  it('uses the compiled default field resolver with non-object sources', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: { type: GraphQLString },
        },
      }),
    });

    const result = await executeCompiled(schema, '{ value }', {
      rootValue: 'source',
    });

    expectJSON(result).toDeepEqual({
      data: { value: null },
    });
  });

  it('reports object completion errors from compiled object paths', async () => {
    const childType = new GraphQLObjectType({
      name: 'Child',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          errorObject: {
            type: childType,
            resolve: () => new Error('Object resolver result error'),
          },
          nullableObject: {
            type: childType,
            resolve: () => null,
          },
        },
      }),
    });

    const result = await executeCompiled(
      schema,
      '{ errorObject { value } nullableObject { value } }',
    );

    expectJSON(result).toDeepEqual({
      data: {
        errorObject: null,
        nullableObject: null,
      },
      errors: [
        {
          message: 'Object resolver result error',
          locations: [{ line: 1, column: 3 }],
          path: ['errorObject'],
        },
      ],
    });
  });

  it('propagates non-null object completion errors', async () => {
    const childType = new GraphQLObjectType({
      name: 'RequiredChild',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          child: {
            type: new GraphQLNonNull(childType),
            resolve: () => null,
          },
        },
      }),
    });

    const result = await executeCompiled(schema, '{ child { value } }');

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field Query.child.',
          locations: [{ line: 1, column: 3 }],
          path: ['child'],
        },
      ],
    });
  });

  it('reports isTypeOf completion errors', async () => {
    const checkedType = new GraphQLObjectType({
      name: 'Checked',
      fields: {
        value: { type: GraphQLString },
      },
      isTypeOf(value: { kind?: string }) {
        if (value.kind === 'throw') {
          throw new Error('isTypeOf threw');
        }
        if (value.kind === 'reject') {
          return Promise.reject(new Error('isTypeOf rejected'));
        }
        return value.kind !== 'wrong';
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          threw: {
            type: checkedType,
            resolve: () => ({ kind: 'throw', value: 'THREW' }),
          },
          rejected: {
            type: checkedType,
            resolve: () => ({ kind: 'reject', value: 'REJECTED' }),
          },
          wrong: {
            type: checkedType,
            resolve: () => ({ kind: 'wrong', value: 'WRONG' }),
          },
          passed: {
            type: checkedType,
            resolve: () => ({ kind: 'right', value: 'PASSED' }),
          },
        },
      }),
    });

    const result = await executeCompiled(
      schema,
      '{ threw { value } rejected { value } wrong { value } passed { value } }',
    );

    expectJSON(result).toDeepEqual({
      data: {
        threw: null,
        rejected: null,
        wrong: null,
        passed: { value: 'PASSED' },
      },
      errors: [
        {
          message:
            'Expected value of type "Checked" but got: { kind: "wrong", value: "WRONG" }.',
          locations: [{ line: 1, column: 38 }],
          path: ['wrong'],
        },
        {
          message: 'isTypeOf threw',
          locations: [{ line: 1, column: 3 }],
          path: ['threw'],
        },
        {
          message: 'isTypeOf rejected',
          locations: [{ line: 1, column: 19 }],
          path: ['rejected'],
        },
      ],
    });
  });

  it('reports abstract type completion errors', async () => {
    const nodeType = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        value: { type: GraphQLString },
      },
      resolveType(value: { kind?: string }) {
        if (value.kind === 'throw') {
          throw new Error('resolveType threw');
        }
        if (value.kind === 'reject') {
          return Promise.reject(new Error('resolveType rejected'));
        }
        if (value.kind === 'missing') {
          return 'MissingType';
        }
        return 'ConcreteNode';
      },
    });
    const concreteType = new GraphQLObjectType({
      name: 'ConcreteNode',
      interfaces: [nodeType],
      fields: {
        value: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          threw: {
            type: nodeType,
            resolve: () => ({ kind: 'throw', value: 'THREW' }),
          },
          rejected: {
            type: nodeType,
            resolve: () => ({ kind: 'reject', value: 'REJECTED' }),
          },
          missing: {
            type: nodeType,
            resolve: () => ({ kind: 'missing', value: 'MISSING' }),
          },
          passed: {
            type: nodeType,
            resolve: () => ({ kind: 'pass', value: 'PASSED' }),
          },
        },
      }),
      types: [concreteType],
    });

    const result = await executeCompiled(
      schema,
      '{ threw { value } rejected { value } missing { value } passed { value } }',
    );

    expectJSON(result).toDeepEqual({
      data: {
        threw: null,
        rejected: null,
        missing: null,
        passed: { value: 'PASSED' },
      },
      errors: [
        {
          message:
            'Abstract type "Node" was resolved to a type "MissingType" that does not exist inside the schema.',
          locations: [{ line: 1, column: 38 }],
          path: ['missing'],
        },
        {
          message: 'resolveType threw',
          locations: [{ line: 1, column: 3 }],
          path: ['threw'],
        },
        {
          message: 'resolveType rejected',
          locations: [{ line: 1, column: 19 }],
          path: ['rejected'],
        },
      ],
    });
  });

  it('continues queued compiled work after root null bubbling', async () => {
    let siblingResolverCalls = 0;
    const namedType = new GraphQLObjectType({
      name: 'NamedThing',
      fields: {
        name: { type: GraphQLString },
      },
      isTypeOf: () => true,
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          skipped: {
            type: namedType,
            resolve() {
              siblingResolverCalls++;
              return { name: 'sibling' };
            },
          },
          bad: {
            type: new GraphQLNonNull(namedType),
            resolve: () => null,
          },
        },
      }),
    });

    const result = await executeCompiled(
      schema,
      '{ skipped { name } bad { name } }',
    );

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field Query.bad.',
          locations: [{ line: 1, column: 20 }],
          path: ['bad'],
        },
      ],
    });
    // The compiled executor runs already-queued sibling work to completion
    // after null bubbling.
    expect(siblingResolverCalls).to.equal(1);
  });

  it('completes async iterables and reports async iterable errors', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          asyncValues: {
            type: new GraphQLList(GraphQLString),
            resolve: () =>
              asyncIterableFrom([
                Promise.resolve('first'),
                Promise.resolve('second'),
              ]),
          },
          failingValues: {
            type: new GraphQLList(GraphQLString),
            resolve: () =>
              rejectingAsyncIterable(new Error('Cannot read list')),
          },
        },
      }),
    });

    const result = await executeCompiled(
      schema,
      '{ asyncValues failingValues }',
    );

    expectJSON(result).toDeepEqual({
      data: {
        asyncValues: ['first', 'second'],
        failingValues: null,
      },
      errors: [
        {
          message: 'Cannot read list',
          locations: [{ line: 1, column: 15 }],
          path: ['failingValues'],
        },
      ],
    });
  });

  it('can ignore stream directives in compiled execution', async () => {
    const compiled = compileQuery(
      listSchema(['a', 'b', 'c']),
      '{ values @stream(initialCount: 1) }',
    );

    const result = await Promise.resolve(compiled.executeIgnoringIncremental());

    expectJSON(result).toDeepEqual({
      data: {
        values: ['a', 'b', 'c'],
      },
    });
  });

  it('reports stream directives in non-incremental compiled execution', async () => {
    await expectPromise(
      Promise.resolve().then(() =>
        executeCompiled(
          listSchema(['a', 'b', 'c']),
          '{ values @stream(initialCount: 1) }',
        ),
      ),
    ).toRejectWith(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });

  it('executes compiled streams', async () => {
    const compiled = compileQuery(
      listSchema(asyncIterableFrom(['a', 'b', 'c'])),
      '{ values @stream(initialCount: 1, label: "items") }',
    );

    const result = await collectIncrementalResults(
      await compiled.experimentalExecuteIncrementally(),
    );

    expectJSON(result).toDeepEqual([
      {
        data: {
          values: ['a'],
        },
        pending: [{ id: '0', path: ['values'], label: 'items' }],
        hasNext: true,
      },
      {
        incremental: [{ items: ['b'], id: '0' }],
        hasNext: true,
      },
      {
        incremental: [{ items: ['c'], id: '0' }],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('completes a short async stream during the initial pass', async () => {
    const compiled = compileQuery(
      listSchema(asyncIterableFrom(['a'])),
      '{ values @stream(initialCount: 5) }',
    );

    const result = await collectIncrementalResults(
      await compiled.experimentalExecuteIncrementally(),
    );

    expectJSON(result).toDeepEqual({
      data: {
        values: ['a'],
      },
    });
  });

  it('aborts pending early stream item execution when the stream is returned', async () => {
    let itemAbortSignal: AbortSignal | undefined;
    const { promise: itemStarted, resolve: resolveItemStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const itemType = new GraphQLObjectType({
      name: 'PendingItem',
      fields: {
        value: {
          type: GraphQLString,
          resolve(_source, _args, _context, info) {
            itemAbortSignal = info.getAbortSignal();
            resolveItemStarted();
            return new Promise((_resolve, reject) => {
              itemAbortSignal?.addEventListener('abort', () => {
                const reason = itemAbortSignal?.reason;
                reject(reason instanceof Error ? reason : new Error('aborted'));
              });
            });
          },
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          items: {
            type: new GraphQLList(itemType),
            resolve: () => ({
              [Symbol.asyncIterator]() {
                let index = 0;
                return {
                  async next() {
                    if (index++ === 0) {
                      return { value: {}, done: false };
                    }
                    return new Promise<IteratorResult<unknown>>(() => {
                      // Keep the source open until cancellation.
                    });
                  },
                  return() {
                    return { value: undefined, done: true };
                  },
                };
              },
            }),
          },
        },
      }),
    });
    const compiled = compileExecution({
      schema,
      document: parse('{ items @stream(initialCount: 0) { value } }'),
      enableEarlyExecution: true,
    });
    assert('execute' in compiled);

    const result = await compiled.experimentalExecuteIncrementally();
    assert('initialResult' in result);

    await itemStarted;
    await resolveOnNextTick();
    await result.subsequentResults.return(undefined);

    expect(itemAbortSignal?.aborted).to.equal(true);
  });

  it('stops compiled streaming while the stream queue is back-pressured', async () => {
    const { promise: reachedCapacity, resolve: resolveReachedCapacity } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let count = 0;
    let done = false;
    const iterator = {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (done) {
          return { value: undefined, done: true };
        }
        count++;
        if (count === 100) {
          resolveReachedCapacity();
        }
        if (count > 100) {
          done = true;
        }
        return { value: String(count), done: false };
      },
    };
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          values: {
            type: new GraphQLList(GraphQLString),
            resolve: () => iterator,
          },
        },
      }),
    });
    const compiled = compileExecution({
      schema,
      document: parse('{ values @stream(initialCount: 0) }'),
      enableEarlyExecution: true,
    });
    assert('execute' in compiled);

    const result = await compiled.experimentalExecuteIncrementally();
    assert('initialResult' in result);

    await reachedCapacity;
    await result.subsequentResults.return(undefined);
    expect(count).to.equal(101);
  });

  it('tracks background work from nulled stream item execution', async () => {
    const itemType = new GraphQLObjectType({
      name: 'StreamedBackgroundItem',
      fields: {
        bad: {
          type: new GraphQLNonNull(GraphQLString),
          resolve: () => {
            throw new Error('stream item failed');
          },
        },
        slow: {
          type: GraphQLString,
          resolve: async () => {
            await resolveOnNextTick();
            return 'slow';
          },
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          items: {
            type: new GraphQLList(itemType),
            resolve: () => [{}],
          },
        },
      }),
    });
    const compiled = compileQuery(
      schema,
      '{ items @stream(initialCount: 0) { bad slow } }',
    );

    const result = await collectIncrementalResults(
      await compiled.experimentalExecuteIncrementally(),
    );

    expectJSON(result).toDeepEqual([
      {
        data: { items: [] },
        pending: [{ id: '0', path: ['items'] }],
        hasNext: true,
      },
      {
        incremental: [
          {
            items: [null],
            errors: [
              {
                message: 'stream item failed',
                locations: [{ line: 1, column: 36 }],
                path: ['items', 0, 'bad'],
              },
            ],
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('executes compiled deferred fragments with async fields', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          immediate: { type: GraphQLString, resolve: () => 'first' },
          deferred: {
            type: GraphQLString,
            resolve: async () => {
              await resolveOnNextTick();
              return 'second';
            },
          },
        },
      }),
    });
    const compiled = compileQuery(
      schema,
      '{ immediate ... @defer(label: "later") { deferred } }',
    );

    const result = await collectIncrementalResults(
      await compiled.experimentalExecuteIncrementally(),
    );

    expectJSON(result).toDeepEqual([
      {
        data: { immediate: 'first' },
        pending: [{ id: '0', path: [], label: 'later' }],
        hasNext: true,
      },
      {
        incremental: [{ data: { deferred: 'second' }, id: '0' }],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    ]);
  });

  it('tracks background work from nulled deferred execution groups', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          bad: {
            type: new GraphQLNonNull(GraphQLString),
            resolve: () => {
              throw new Error('defer failed');
            },
          },
          slow: {
            type: GraphQLString,
            resolve: async () => {
              await resolveOnNextTick();
              return 'slow';
            },
          },
        },
      }),
    });
    const compiled = compileQuery(
      schema,
      '{ ... @defer(label: "later") { bad slow } }',
    );

    const result = await collectIncrementalResults(
      await compiled.experimentalExecuteIncrementally(),
    );

    expectJSON(result).toDeepEqual([
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
                message: 'defer failed',
                locations: [{ line: 1, column: 32 }],
                path: ['bad'],
              },
            ],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('reports thrown thenable errors from compiled async field setup', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: {
            type: GraphQLString,
            resolve: () => ({
              then() {
                throw new Error('Thenable setup failed');
              },
            }),
          },
        },
      }),
    });

    const result = await executeCompiled(schema, '{ value }');

    expectJSON(result).toDeepEqual({
      data: { value: null },
      errors: [
        {
          message: 'Thenable setup failed',
          locations: [{ line: 1, column: 3 }],
          path: ['value'],
        },
      ],
    });
  });
});

function compileQuery(
  schema: GraphQLSchema,
  source: string,
): CompiledExecution {
  const compiled = compileExecution({ schema, document: parse(source) });
  assert('execute' in compiled);
  return compiled;
}

function executeCompiled(
  schema: GraphQLSchema,
  source: string,
  args?: CompiledExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  return compileQuery(schema, source).execute(args);
}

function getValidatedExecutionArgs(
  args: Pick<CompileExecutionArgs, 'enableEarlyExecution'> = {},
): ValidatedExecutionArgs {
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        value: { type: GraphQLString },
      },
    }),
  });
  const compiled = compileExecution({
    schema,
    document: parse('{ value }'),
    ...args,
  });
  assert('execute' in compiled);
  const validatedExecutionArgs = (
    compiled as unknown as {
      getValidatedExecutionArgs: () => unknown;
    }
  ).getValidatedExecutionArgs();
  assert(
    typeof validatedExecutionArgs === 'object' &&
      validatedExecutionArgs !== null &&
      'schema' in validatedExecutionArgs,
  );
  return validatedExecutionArgs as ValidatedExecutionArgs;
}

function callAbortResolverSignal(
  executor: CompiledExecutor,
  reason?: unknown,
): void {
  (
    executor as unknown as {
      abortResolverSignal: (reason?: unknown) => void;
    }
  ).abortResolverSignal(reason);
}

function setRunnerPending(
  runner: CompiledExecutionRunner,
  pending: number,
): void {
  (runner as unknown as { _pending: number })._pending = pending;
}

function getRunnerPending(runner: CompiledExecutionRunner): number {
  return (runner as unknown as { _pending: number })._pending;
}

function createExecutionRunner(): CompiledExecutionRunner {
  return new CompiledExecutionRunner({
    applyNulledTargets() {
      return undefined;
    },
  } as unknown as CompiledExecutor);
}

async function collectIncrementalResults(
  result: ExecutionResult | ExperimentalIncrementalExecutionResults,
): Promise<
  | ExecutionResult
  | ReadonlyArray<
      InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
    >
> {
  if (!('initialResult' in result)) {
    return result;
  }

  const results: Array<
    InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
  > = [result.initialResult];
  for await (const patch of result.subsequentResults) {
    results.push(patch);
  }
  return results;
}

function listSchema(values: unknown): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        values: {
          type: new GraphQLList(GraphQLString),
          resolve: () => values,
        },
      },
    }),
  });
}

function asyncIterableFrom(
  values: ReadonlyArray<unknown>,
): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          const value = values[index++];
          if (index > values.length) {
            return { done: true, value: undefined };
          }
          await resolveOnNextTick();
          return { done: false, value };
        },
        return() {
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

function rejectingAsyncIterable(error: Error): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next() {
          return Promise.reject(error);
        },
        return() {
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}
