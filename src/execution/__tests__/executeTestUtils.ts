import { assert } from 'chai';

import { expectEqualPromisesOrValuesOrAsyncIterables } from '../../__testUtils__/expectEqualPromisesOrValuesOrAsyncIterables.ts';
import {
  expectMatchingAsyncIterables,
  expectMatchingAsyncIterablesConcurrently,
} from '../../__testUtils__/expectMatchingAsyncIterables.ts';
import type { MatchingOutcome } from '../../__testUtils__/expectMatchingValues.ts';
import {
  captureMatchingValue,
  expectMatchingOutcomes,
  expectMatchingValues,
} from '../../__testUtils__/expectMatchingValues.ts';
import { createReplayableAsyncIterablePair } from '../../__testUtils__/replayableIterables.ts';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';
import { isPromise } from '../../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { GraphQLError } from '../../error/GraphQLError.ts';

import type { VariableDefinitionNode } from '../../language/ast.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { compileVariableValues } from '../compile/compileVariableValues.ts';
import { getCompiledVariableValues } from '../compile/getCompiledVariableValues.ts';
import { compileExecution, compileSubscription } from '../compile/index.ts';
import type { ExecutionArgs } from '../execute.ts';
import {
  createSourceEventStream as originalCreateSourceEventStream,
  execute as originalExecute,
  executeIgnoringIncremental as originalExecuteIgnoringIncremental,
  executeSubscriptionEvent as originalExecuteSubscriptionEvent,
  executeSync as originalExecuteSync,
  experimentalExecuteIncrementally as originalExperimentalExecuteIncrementally,
  mapSourceToResponseEvent as originalMapSourceToResponseEvent,
  subscribe as originalSubscribe,
  validateSubscriptionArgs as originalValidateSubscriptionArgs,
} from '../execute.ts';
import type { ValidatedSubscriptionArgs } from '../ExecutionArgs.ts';
import type { ExecutionResult } from '../Executor.ts';
import type {
  ExperimentalIncrementalExecutionResults,
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../incremental/IncrementalExecutor.ts';
import { legacyExecuteIncrementally } from '../legacyIncremental/legacyExecuteIncrementally.ts';
import type { VariableValuesOrErrors } from '../values.ts';
import { getVariableValues as originalGetVariableValues } from '../values.ts';

type CompiledExecutionMethod =
  | 'execute'
  | 'executeIgnoringIncremental'
  | 'experimentalExecuteIncrementally';

type IncrementalExecutionResult =
  | ExecutionResult
  | ExperimentalIncrementalExecutionResults;

type SubscriptionResult =
  | AsyncGenerator<ExecutionResult, void, void>
  | ExecutionResult;

type SourceEventStreamResult =
  | AsyncGenerator<unknown, void, void>
  | ExecutionResult;

type RootSelectionSetExecutor = NonNullable<
  Parameters<typeof originalMapSourceToResponseEvent>[2]
>;

export type IncrementalExecutionPayload =
  | InitialIncrementalExecutionResult
  | SubsequentIncrementalExecutionResult;

export type ExecutionArgsInput = ExecutionArgs | (() => ExecutionArgs);

const subscriptionExecutionArgs = new WeakMap<
  ValidatedSubscriptionArgs,
  ExecutionArgs
>();

export function execute(
  args: ExecutionArgsInput,
): PromiseOrValue<ExecutionResult> {
  return expectMatchingExecutionResults([
    () => originalExecute(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
  ]);
}

export function executeSync(args: ExecutionArgsInput): ExecutionResult {
  return expectMatchingExecutionResults([
    () => originalExecuteSync(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
  ]) as ExecutionResult;
}

export function executeWithAllMethods(
  args: ExecutionArgsInput,
): PromiseOrValue<ExecutionResult> {
  return expectMatchingExecutionResults([
    () => originalExecute(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
    () => originalExecuteIgnoringIncremental(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'executeIgnoringIncremental'),
    () => originalExperimentalExecuteIncrementally(getExecutionArgs(args)),
    () =>
      executeCompiled(
        getExecutionArgs(args),
        'experimentalExecuteIncrementally',
      ),
    () => legacyExecuteIncrementally(getExecutionArgs(args)),
  ]);
}

export function executeSyncWithAllMethods(
  args: ExecutionArgsInput,
): ExecutionResult {
  return expectMatchingExecutionResults([
    () => originalExecuteSync(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
    () => originalExecuteIgnoringIncremental(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'executeIgnoringIncremental'),
    () => originalExperimentalExecuteIncrementally(getExecutionArgs(args)),
    () =>
      executeCompiled(
        getExecutionArgs(args),
        'experimentalExecuteIncrementally',
      ),
    () => legacyExecuteIncrementally(getExecutionArgs(args)),
  ]) as ExecutionResult;
}

export function subscribe(
  args: ExecutionArgsInput,
): PromiseOrValue<SubscriptionResult> {
  return expectEqualPromisesOrValuesOrAsyncIterables<ExecutionResult>([
    () => originalSubscribe(getExecutionArgs(args)),
    () => {
      const executionArgs = getExecutionArgs(args);
      try {
        const compiledSubscription = compileSubscription(executionArgs);
        return 'subscribe' in compiledSubscription
          ? compiledSubscription.subscribe(executionArgs)
          : { errors: compiledSubscription };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Expected subscription operation.'
        ) {
          throw error;
        }
        return { errors: [error] } as ExecutionResult;
      }
    },
  ]);
}

export function validateSubscriptionArgs(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ValidatedSubscriptionArgs {
  const result = originalValidateSubscriptionArgs(args);
  if ('schema' in result) {
    setSubscriptionExecutionArgs(result, args);
  }
  return result;
}

export function createSourceEventStream(
  validatedSubscriptionArgs: ValidatedSubscriptionArgs,
): PromiseOrValue<SourceEventStreamResult> {
  return expectEqualPromisesOrValuesOrAsyncIterables<unknown>([
    () => originalCreateSourceEventStream(validatedSubscriptionArgs),
    () => {
      const subscriptionArgs = getSubscriptionExecutionArgs(
        validatedSubscriptionArgs,
      );
      const compiledSubscription = compileSubscription(subscriptionArgs);
      return 'createSourceEventStream' in compiledSubscription
        ? compiledSubscription.createSourceEventStream(
            validatedSubscriptionArgs,
          )
        : { errors: compiledSubscription };
    },
  ]) as PromiseOrValue<SourceEventStreamResult>;
}

export function executeSubscriptionEvent(
  args: ValidatedSubscriptionArgs,
): PromiseOrValue<ExecutionResult> {
  const subscriptionArgs = getSubscriptionExecutionArgs(args);

  return expectMatchingExecutionResults([
    () => originalExecuteSubscriptionEvent(args),
    () => {
      const compiledSubscription = compileSubscription(subscriptionArgs);
      return 'executeSubscriptionEvent' in compiledSubscription
        ? compiledSubscription.executeSubscriptionEvent(args)
        : { errors: compiledSubscription };
    },
  ]);
}

export function mapSourceToResponseEvent(
  validatedSubscriptionArgs: ValidatedSubscriptionArgs,
  sourceEventStream: AsyncIterable<unknown>,
  rootSelectionSetExecutor?: RootSelectionSetExecutor,
): AsyncGenerator<ExecutionResult, void, void> | ExecutionResult {
  const [recordingSourceEventStream, replaySourceEventStream] =
    createReplayableAsyncIterablePair(sourceEventStream);
  const subscriptionArgs = getSubscriptionExecutionArgs(
    validatedSubscriptionArgs,
  );
  const wrappedRootSelectionSetExecutor =
    rootSelectionSetExecutor === undefined
      ? undefined
      : (eventArgs: ValidatedSubscriptionArgs) => {
          setSubscriptionExecutionArgs(eventArgs, {
            ...subscriptionArgs,
            rootValue: eventArgs.rootValue,
          });
          return rootSelectionSetExecutor(eventArgs);
        };

  const result = originalMapSourceToResponseEvent(
    validatedSubscriptionArgs,
    recordingSourceEventStream,
    wrappedRootSelectionSetExecutor,
  );
  const compiledSubscription = compileSubscription(subscriptionArgs);
  const compiledResult =
    'mapSourceToResponseEvent' in compiledSubscription
      ? compiledSubscription.mapSourceToResponseEvent(
          validatedSubscriptionArgs,
          replaySourceEventStream,
          wrappedRootSelectionSetExecutor,
        )
      : { errors: compiledSubscription };

  if (!isAsyncIterable(result)) {
    assert(!isAsyncIterable(compiledResult));
    const comparedResult = expectMatchingExecutionResults([
      () => result,
      () => compiledResult,
    ]);
    assert(!isPromise(comparedResult));
    return comparedResult;
  }

  assert(isAsyncIterable(compiledResult));
  return expectMatchingAsyncIterables([result, compiledResult]);
}

function setSubscriptionExecutionArgs(
  validatedSubscriptionArgs: ValidatedSubscriptionArgs,
  args: ExecutionArgs,
): void {
  subscriptionExecutionArgs.set(validatedSubscriptionArgs, args);
}

function getSubscriptionExecutionArgs(
  validatedSubscriptionArgs: ValidatedSubscriptionArgs,
): ExecutionArgs {
  const args = subscriptionExecutionArgs.get(validatedSubscriptionArgs);
  assert(
    args !== undefined,
    'Expected subscription args validated by the execution test helper.',
  );
  return args;
}

export function experimentalExecuteIncrementally(
  args: ExecutionArgsInput,
): PromiseOrValue<IncrementalExecutionResult> {
  const result = originalExperimentalExecuteIncrementally(
    getExecutionArgs(args),
  );
  const compiledResult = executeCompiled(
    getExecutionArgs(args),
    'experimentalExecuteIncrementally',
  );

  if (isPromise(result) || isPromise(compiledResult)) {
    return Promise.allSettled([
      Promise.resolve(result),
      Promise.resolve(compiledResult),
    ]).then(([settledResult, settledCompiledResult]) => {
      const resultOutcome: MatchingOutcome<IncrementalExecutionResult> =
        settledResult.status === 'fulfilled'
          ? { kind: 'value', value: settledResult.value }
          : { kind: 'error', error: settledResult.reason };
      const compiledResultOutcome: MatchingOutcome<IncrementalExecutionResult> =
        settledCompiledResult.status === 'fulfilled'
          ? { kind: 'value', value: settledCompiledResult.value }
          : { kind: 'error', error: settledCompiledResult.reason };
      if (
        resultOutcome.kind === 'error' ||
        compiledResultOutcome.kind === 'error'
      ) {
        return expectMatchingOutcomes([resultOutcome, compiledResultOutcome]);
      }
      return compareIncrementalExecutionResult(
        resultOutcome.value,
        compiledResultOutcome.value,
      );
    });
  }

  return compareIncrementalExecutionResult(result, compiledResult);
}

export function executeIncrementally(
  args: ExecutionArgsInput,
): PromiseOrValue<IncrementalExecutionResult> {
  return experimentalExecuteIncrementally(args);
}

export async function completeExecution(
  args: ExecutionArgsInput,
): Promise<ExecutionResult | ReadonlyArray<IncrementalExecutionPayload>> {
  return collectIncrementalResults(
    await experimentalExecuteIncrementally(args),
  );
}

export async function completeDirectly(
  args: ExecutionArgs,
): Promise<ExecutionResult | ReadonlyArray<IncrementalExecutionPayload>> {
  return collectIncrementalResults(
    await originalExperimentalExecuteIncrementally(args),
  );
}

export function getVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  options?: {
    maxErrors?: number;
    hideSuggestions?: boolean;
  },
): VariableValuesOrErrors {
  return expectMatchingValues([
    () => originalGetVariableValues(schema, varDefNodes, inputs, options),
    () => {
      const compiled = compileVariableValues(
        schema,
        varDefNodes,
        options?.hideSuggestions ?? false,
      );
      return getCompiledVariableValues(
        compiled,
        inputs,
        options?.maxErrors ?? 50,
      );
    },
  ]);
}

function expectMatchingExecutionResults(
  items: ReadonlyArray<() => PromiseOrValue<unknown>>,
): PromiseOrValue<ExecutionResult> {
  const outcomes = items.map(captureMatchingValue);

  if (
    outcomes.some(
      (outcome) => outcome.kind === 'value' && isPromise(outcome.value),
    )
  ) {
    return Promise.all(
      outcomes.map((outcome): Promise<MatchingOutcome<unknown>> => {
        if (outcome.kind === 'error') {
          return Promise.resolve(outcome);
        }

        const value = outcome.value;
        if (!isPromise(value)) {
          return Promise.resolve({ kind: 'value', value });
        }

        return Promise.resolve(value).then(
          (resolved) => ({ kind: 'value', value: resolved }) as const,
          (error: unknown) => ({ kind: 'error', error }) as const,
        );
      }),
    ).then(compareExecutionResultOutcomes);
  }

  return compareExecutionResultOutcomes(
    outcomes.map((outcome) => {
      if (outcome.kind === 'error') {
        return outcome;
      }
      assert(!isPromise(outcome.value));
      return { kind: 'value', value: outcome.value };
    }),
  );
}

function compareExecutionResultOutcomes(
  outcomes: ReadonlyArray<MatchingOutcome<unknown>>,
): ExecutionResult {
  if (outcomes.some((outcome) => outcome.kind === 'error')) {
    expectMatchingOutcomes(outcomes);
    assert(false, 'Expected matching errors to throw.');
  }

  const results = outcomes.map((outcome) => {
    assert(outcome.kind === 'value');
    assert(
      !isIncrementalExecutionResult(outcome.value),
      'Received an incremental execution result.',
    );
    assert(
      typeof outcome.value === 'object' && outcome.value !== null,
      'Received an invalid result.',
    );
    return outcome.value;
  });
  const [firstResult] = results;
  assert(firstResult !== undefined, 'Expected at least one execution result.');

  expectMatchingValues(
    results.map((result) => () => {
      const normalized: {
        data?: unknown;
        errors?: true;
        extensions?: unknown;
      } = {};
      if ('data' in result) {
        normalized.data = result.data;
      }
      if ('errors' in result && result.errors !== undefined) {
        normalized.errors = true;
      }
      if ('extensions' in result && result.extensions !== undefined) {
        normalized.extensions = result.extensions;
      }
      return normalized;
    }),
  );
  return firstResult;
}

function executeCompiled(
  args: ExecutionArgs,
  method: CompiledExecutionMethod,
): PromiseOrValue<IncrementalExecutionResult> {
  const compiledExecution = compileExecution(args);
  if ('execute' in compiledExecution) {
    return compiledExecution[method](args);
  }
  return { errors: compiledExecution };
}

function getExecutionArgs(args: ExecutionArgsInput): ExecutionArgs {
  return typeof args === 'function' ? args() : args;
}

async function collectIncrementalResults(
  result: IncrementalExecutionResult,
): Promise<ExecutionResult | ReadonlyArray<IncrementalExecutionPayload>> {
  if (!isIncrementalExecutionResult(result)) {
    return result;
  }

  const results: Array<IncrementalExecutionPayload> = [result.initialResult];
  for await (const patch of result.subsequentResults) {
    results.push(patch);
  }
  return results;
}

function compareIncrementalExecutionResult(
  result: IncrementalExecutionResult,
  compiledResult: IncrementalExecutionResult,
): IncrementalExecutionResult {
  if (!isIncrementalExecutionResult(result)) {
    assert(
      !isIncrementalExecutionResult(compiledResult),
      'Received an invalid mixture of execution results and incremental execution results.',
    );
    return expectMatchingValues([() => result, () => compiledResult]);
  }

  assert(
    isIncrementalExecutionResult(compiledResult),
    'Received an invalid mixture of execution results and incremental execution results.',
  );
  expectMatchingValues([
    () => normalizeIncrementalPayloads([result.initialResult]),
    () => normalizeIncrementalPayloads([compiledResult.initialResult]),
  ]);

  const expectedPayloads: Array<IncrementalExecutionPayload> = [
    result.initialResult,
  ];
  const actualPayloads: Array<IncrementalExecutionPayload> = [
    compiledResult.initialResult,
  ];
  return {
    initialResult: result.initialResult,
    subsequentResults: expectMatchingAsyncIterablesConcurrently(
      [result.subsequentResults, compiledResult.subsequentResults],
      (payloadBatches) => {
        const [expectedSubsequentPayloads, actualSubsequentPayloads] =
          payloadBatches;
        assert(expectedSubsequentPayloads !== undefined);
        assert(actualSubsequentPayloads !== undefined);
        expectMatchingValues([
          () =>
            normalizeIncrementalPayloads([
              ...expectedPayloads,
              ...expectedSubsequentPayloads,
            ]),
          () =>
            normalizeIncrementalPayloads([
              ...actualPayloads,
              ...actualSubsequentPayloads,
            ]),
        ]);
      },
    ),
  };
}

function isIncrementalExecutionResult(
  result: unknown,
): result is ExperimentalIncrementalExecutionResults {
  return (
    typeof result === 'object' && result !== null && 'initialResult' in result
  );
}

function normalizeIncrementalPayloads(
  payloads: ReadonlyArray<IncrementalExecutionPayload>,
): unknown {
  const pendingIds = new Map<string, string>();
  const pending: Array<unknown> = [];
  const incremental: Array<unknown> = [];
  const streamIncremental = new Map<
    string,
    {
      id: string;
      subPath?: ReadonlyArray<string | number>;
      errors?: Array<GraphQLError>;
      items: Array<unknown>;
      extensions?: unknown;
    }
  >();
  const completed: Array<unknown> = [];
  let initial: unknown;
  let finalHasNext = false;

  for (const payload of payloads) {
    if ('data' in payload) {
      initial =
        payload.errors === undefined
          ? { data: payload.data }
          : { data: payload.data, errors: sortErrors(payload.errors) };
    }

    if (payload.pending !== undefined) {
      for (const pendingResult of payload.pending) {
        const id = normalizePendingId(pendingResult);
        const normalizedPending =
          pendingResult.label === undefined
            ? { id, path: pendingResult.path }
            : { id, path: pendingResult.path, label: pendingResult.label };
        pending.push(normalizedPending);
      }
    }

    if ('incremental' in payload && payload.incremental !== undefined) {
      for (const incrementalResult of payload.incremental) {
        if ('items' in incrementalResult) {
          const id = normalizeKnownId(incrementalResult.id);
          const key = comparableKey({
            id,
            subPath: incrementalResult.subPath,
            extensions: incrementalResult.extensions,
          });
          let normalizedStreamIncremental = streamIncremental.get(key);
          if (normalizedStreamIncremental === undefined) {
            normalizedStreamIncremental =
              incrementalResult.subPath === undefined
                ? { id, items: [] }
                : { id, subPath: incrementalResult.subPath, items: [] };
            if (incrementalResult.extensions !== undefined) {
              normalizedStreamIncremental.extensions =
                incrementalResult.extensions;
            }
            streamIncremental.set(key, normalizedStreamIncremental);
          }
          normalizedStreamIncremental.items.push(...incrementalResult.items);
          if (incrementalResult.errors !== undefined) {
            (normalizedStreamIncremental.errors ??= []).push(
              ...incrementalResult.errors,
            );
          }
          continue;
        }

        const normalizedIncremental: { [key: string]: unknown } = {
          ...incrementalResult,
          id: normalizeKnownId(incrementalResult.id),
        };
        if (incrementalResult.errors !== undefined) {
          normalizedIncremental.errors = sortErrors(incrementalResult.errors);
        }
        incremental.push(normalizedIncremental);
      }
    }

    if ('completed' in payload && payload.completed !== undefined) {
      for (const completedResult of payload.completed) {
        const normalizedCompleted =
          completedResult.errors === undefined
            ? { id: normalizeKnownId(completedResult.id) }
            : {
                id: normalizeKnownId(completedResult.id),
                errors: sortErrors(completedResult.errors),
              };
        completed.push(normalizedCompleted);
      }
    }

    finalHasNext = !payload.hasNext;
  }

  for (const incrementalResult of streamIncremental.values()) {
    const normalizedIncremental: { [key: string]: unknown } = {
      ...incrementalResult,
    };
    if (incrementalResult.errors !== undefined) {
      normalizedIncremental.errors = sortErrors(incrementalResult.errors);
    }
    incremental.push(normalizedIncremental);
  }

  assert(initial !== undefined, 'Expected an initial incremental payload.');
  return {
    initial,
    pending: sortComparableValues(pending),
    incremental: sortComparableValues(incremental),
    completed: sortComparableValues(completed),
    finalHasNext,
  };

  function normalizePendingId(pendingResult: {
    id: string;
    path: ReadonlyArray<string | number>;
    label?: string | undefined;
  }): string {
    const normalizedId = comparableKey({
      path: pendingResult.path,
      label: pendingResult.label,
    });
    pendingIds.set(pendingResult.id, normalizedId);
    return normalizedId;
  }

  function normalizeKnownId(id: string): string {
    return pendingIds.get(id) ?? id;
  }
}

function sortErrors(
  errors: ReadonlyArray<GraphQLError>,
): ReadonlyArray<{ message: string }> {
  return Array.from(new Set(errors.map((error) => error.message)))
    .sort()
    .map((message) => ({ message }));
}

function sortComparableValues<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...values].sort((a, b) =>
    comparableKey(a).localeCompare(comparableKey(b)),
  );
}

function comparableKey(value: unknown): string {
  return JSON.stringify(value);
}
