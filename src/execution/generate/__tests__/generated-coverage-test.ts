import path from 'node:path';
import { before, describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { assert, expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { writeGeneratedExecutionCoverageFixtures } from '../../../../resources/generate-execution-coverage-fixtures.ts';

import type { CompiledExecution } from '../../compile/index.ts';
import type { ExecutionResult } from '../../Executor.ts';

import type { RootStringCoverageSchemaMode } from './generatedCoverageFixtures.ts';
import { createRootStringCoverageSchema } from './generatedCoverageFixtures.ts';

interface GeneratedExecutionModule {
  createCompiledExecution: (args: unknown) => CompiledExecution;
}

let generatedCoverageFixtureDir: string;

describe('generated execution coverage fixtures', () => {
  before(() => {
    generatedCoverageFixtureDir = writeGeneratedExecutionCoverageFixtures();
  });

  it('generates coverage fixture modules', () => {
    expect(generatedCoverageFixtureDir).to.be.a('string');
  });

  it('exercises root execution runtime compatibility branches', async () => {
    await expectRootStringCreateFailure({ schemaMode: 'noQuery' });
    await expectRootStringCreateFailure({ schemaMode: 'renamedRoot' });
    await expectRootStringCreateFailure({ schemaMode: 'missingField' });
    await expectRootStringCreateFailure({ schemaMode: 'customResolver' });
    await expectRootStringCreateFailure({ schemaMode: 'customString' });
    await expectRootStringCreateFailure({
      args: {
        fieldResolver: () => undefined,
      },
    });
  });

  it('exercises root execution entrypoints and validation arg variants', async () => {
    const generated = await createRootStringCoverageExecution();
    expectJSON(await Promise.resolve(generated.execute())).toDeepEqual({
      data: { value: null },
    });
    expectJSON(
      await Promise.resolve(
        generated.experimentalExecuteIncrementally({
          rootValue: { value: 'incremental' },
        }),
      ),
    ).toDeepEqual({ data: { value: 'incremental' } });
    expectJSON(
      await Promise.resolve(
        generated.executeIgnoringIncremental({
          rootValue: { value: 'ignore' },
          variableValues: { unused: true },
        }),
      ),
    ).toDeepEqual({ data: { value: 'ignore' } });

    const hookCalls: Array<string> = [];
    const hooked = await createRootStringCoverageExecution({
      hooks: {
        asyncWorkFinished() {
          hookCalls.push('asyncWorkFinished');
        },
      },
      hideSuggestions: true,
      enableBatchResolvers: true,
    });
    expectJSON(
      await Promise.resolve(
        hooked.execute({
          rootValue: { value: 'hooked' },
        }),
      ),
    ).toDeepEqual({ data: { value: 'hooked' } });

    expectJSON(
      await Promise.resolve(
        hooked.execute({
          rootValue: {
            value() {
              return Promise.resolve('hooked async');
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: 'hooked async' } });
    await setImmediate();
    expect(hookCalls.join(',')).to.equal('asyncWorkFinished,asyncWorkFinished');
  });

  it('exercises root execution scalar fast paths', async () => {
    const generated = await createRootStringCoverageExecution();
    const cases: ReadonlyArray<{
      expected: string | null;
      value: unknown;
    }> = [
      { value: 'text', expected: 'text' },
      { value: false, expected: 'false' },
      { value: true, expected: 'true' },
      { value: 3, expected: '3' },
      { value: 4n, expected: '4' },
      { value: null, expected: null },
      { value: undefined, expected: null },
    ];

    const results = await Promise.all(
      cases.map(async (testCase) => ({
        result: await executeRootStringValue(generated, testCase.value),
        testCase,
      })),
    );

    for (const { result, testCase } of results) {
      expectJSON(result).toDeepEqual({ data: { value: testCase.expected } });
    }
  });

  it('exercises root execution scalar completion branches', async () => {
    const generated = await createRootStringCoverageExecution();
    const cases: ReadonlyArray<{
      expected?: string;
      expectedData?: unknown;
      message?: string;
      value: unknown;
    }> = [
      { value: { valueOf: () => 'object-string' }, expected: 'object-string' },
      { value: { valueOf: () => true }, expected: 'true' },
      { value: { valueOf: () => false }, expected: 'false' },
      { value: { valueOf: () => 5 }, expected: '5' },
      { value: { valueOf: () => 6n }, expected: '6' },
      {
        value: { valueOf: () => Object.create(null), toJSON: () => 'json' },
        expected: 'json',
      },
      {
        value: { valueOf: () => Object.create(null), toJSON: () => true },
        expected: 'true',
      },
      {
        value: { valueOf: () => Object.create(null), toJSON: () => false },
        expected: 'false',
      },
      {
        value: { valueOf: () => Object.create(null), toJSON: () => 7 },
        expected: '7',
      },
      {
        value: { valueOf: () => Object.create(null), toJSON: () => 8n },
        expected: '8',
      },
      {
        value: {
          get then() {
            throw new Error('then lookup failed');
          },
        },
        message: 'then lookup failed',
        expectedData: null,
      },
      {
        value: Number.NaN,
        message: 'String cannot represent value: NaN',
      },
      {
        value: { valueOf: () => Object.create(null) },
        message:
          'String cannot represent value: { valueOf: [function valueOf] }',
      },
    ];

    const results = await Promise.all(
      cases.map(async (testCase) => ({
        result: await executeRootStringValue(generated, testCase.value),
        testCase,
      })),
    );

    for (const { result, testCase } of results) {
      if (testCase.message === undefined) {
        expectJSON(result).toDeepEqual({
          data: { value: testCase.expected },
        });
      } else {
        expect(result.errors?.[0]?.message).to.equal(testCase.message);
        expectJSON(result.data).toDeepEqual(
          Object.hasOwn(testCase, 'expectedData')
            ? testCase.expectedData
            : { value: null },
        );
      }
    }
  });

  it('exercises root execution resolver function branches', async () => {
    const generated = await createRootStringCoverageExecution();

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value(
              _args: unknown,
              contextValue: unknown,
              info: { fieldName: string },
            ) {
              expect(contextValue).to.deep.equal({ marker: 'context' });
              return `${info.fieldName}:sync`;
            },
          },
          contextValue: { marker: 'context' },
        }),
      ),
    ).toDeepEqual({ data: { value: 'value:sync' } });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve('async');
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: 'async' } });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve(true);
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: 'true' } });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve(false);
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: 'false' } });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve(9);
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: '9' } });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve(10n);
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: '10' } });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve(null);
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: null } });

    const resolvedError = await Promise.resolve(
      generated.execute({
        rootValue: {
          value() {
            return Promise.resolve(new Error('async error value'));
          },
        },
      }),
    );
    expect(resolvedError.errors?.[0]?.message).to.equal('async error value');
    expectJSON(resolvedError.data).toDeepEqual({ value: null });

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve({ valueOf: () => 'async object' });
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: 'async object' } });

    const asyncCoercionError = await Promise.resolve(
      generated.execute({
        rootValue: {
          value() {
            return Promise.resolve({ valueOf: () => Object.create(null) });
          },
        },
      }),
    );
    expect(asyncCoercionError.errors?.[0]?.message).to.equal(
      'String cannot represent value: { valueOf: [function valueOf] }',
    );
    expectJSON(asyncCoercionError.data).toDeepEqual({ value: null });

    const rejected = await Promise.resolve(
      generated.execute({
        rootValue: {
          value() {
            return Promise.reject(new Error('async failed'));
          },
        },
      }),
    );
    expect(rejected.errors?.[0]?.message).to.equal('async failed');
    expectJSON(rejected.data).toDeepEqual({ value: null });

    const thrown = await Promise.resolve(
      generated.execute({
        rootValue: {
          value() {
            throw new Error('sync failed');
          },
        },
      }),
    );
    expect(thrown.errors?.[0]?.message).to.equal('sync failed');
    expectJSON(thrown.data).toDeepEqual({ value: null });

    const errorValue = await Promise.resolve(
      generated.execute({
        rootValue: { value: new Error('error value') },
      }),
    );
    expect(errorValue.errors?.[0]?.message).to.equal('error value');
    expectJSON(errorValue.data).toDeepEqual({ value: null });
  });

  it('exercises root execution abort and async lifecycle branches', async () => {
    const generated = await createRootStringCoverageExecution();
    const calls: Array<string> = [];
    let abortListener: (() => void) | undefined;
    const passiveAbortSignal = {
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
    } as unknown as AbortSignal;

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value() {
              return Promise.resolve('signal');
            },
          },
          abortSignal: passiveAbortSignal,
        }),
      ),
    ).toDeepEqual({ data: { value: 'signal' } });
    expect(calls).to.deep.equal([
      'throwIfAborted',
      'addEventListener',
      'removeEventListener',
    ]);

    const abortReason = new Error('external abort');
    const immediateAbortSignal = {
      reason: abortReason,
      throwIfAborted() {
        calls.push('immediateThrowIfAborted');
      },
      addEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        calls.push('immediateAddEventListener');
        listener();
      },
      removeEventListener(type: string) {
        expect(type).to.equal('abort');
        calls.push('immediateRemoveEventListener');
      },
    } as unknown as AbortSignal;

    try {
      await Promise.resolve(
        generated.execute({
          rootValue: { value: 'aborted' },
          abortSignal: immediateAbortSignal,
        }),
      );
      throw new Error('Expected generated execution to abort.');
    } catch (error) {
      expect(error).to.have.property('message', 'external abort');
    }

    const alreadyAbortedSignal = {
      throwIfAborted() {
        throw new Error('already aborted');
      },
    } as unknown as AbortSignal;
    try {
      await Promise.resolve(
        generated.execute({
          rootValue: { value: 'not reached' },
          abortSignal: alreadyAbortedSignal,
        }),
      );
      throw new Error('Expected generated execution to stop before running.');
    } catch (error) {
      expect(error).to.have.property('message', 'already aborted');
    }

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue: {
            value(
              _args: unknown,
              _contextValue: unknown,
              info: { getAbortSignal: () => AbortSignal | undefined },
            ) {
              info.getAbortSignal();
              return 'resolver signal';
            },
          },
        }),
      ),
    ).toDeepEqual({ data: { value: 'resolver signal' } });

    const catchingAbortSignal = {
      throwIfAborted() {
        calls.push('catchingThrowIfAborted');
      },
      addEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        abortListener = listener;
        calls.push('catchingAddEventListener');
      },
      removeEventListener(type: string, listener: () => void) {
        expect(type).to.equal('abort');
        expect(listener).to.equal(abortListener);
        calls.push('catchingRemoveEventListener');
      },
    } as AbortSignal;
    const caught = await Promise.resolve(
      generated.execute({
        rootValue: {
          value: {
            get then() {
              throw new Error('catch with listener');
            },
          },
        },
        abortSignal: catchingAbortSignal,
      }),
    );
    expect(caught.errors?.[0]?.message).to.equal('catch with listener');
    expect(caught.data).to.equal(null);

    await setImmediate();
  });
});

async function createRootStringCoverageExecution(
  args: unknown = {},
): Promise<CompiledExecution> {
  const module = await importGeneratedCoverageFixture('root-string.mjs');
  return module.createCompiledExecution({
    schema: createRootStringCoverageSchema(),
    ...assertObject(args),
  });
}

async function expectRootStringCreateFailure(args: {
  args?: unknown;
  schemaMode?: RootStringCoverageSchemaMode;
}): Promise<void> {
  const module = await importGeneratedCoverageFixture('root-string.mjs');
  expect(() =>
    module.createCompiledExecution({
      schema: createRootStringCoverageSchema(args.schemaMode),
      ...assertObject(args.args ?? {}),
    }),
  ).to.throw('Generated execution is incompatible');
}

async function executeRootStringValue(
  generated: CompiledExecution,
  value: unknown,
): Promise<ExecutionResult> {
  return Promise.resolve(
    generated.execute({
      rootValue: { value },
    }),
  );
}

async function importGeneratedCoverageFixture(
  filename: string,
): Promise<GeneratedExecutionModule> {
  return import(
    pathToFileURL(path.join(generatedCoverageFixtureDir, filename)).href
  );
}

function assertObject(value: unknown): { [key: string]: unknown } {
  assert(value !== null && typeof value === 'object');
  return value as { [key: string]: unknown };
}
