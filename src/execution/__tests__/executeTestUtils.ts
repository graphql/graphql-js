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

import { inspect } from '../../jsutils/inspect.ts';
import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';
import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isObjectLike } from '../../jsutils/isObjectLike.ts';
import { isPromise, isPromiseLike } from '../../jsutils/isPromise.ts';
import { pathToArray } from '../../jsutils/Path.ts';
import { printPathArray } from '../../jsutils/printPathArray.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';
import { locatedError } from '../../error/locatedError.ts';

import type { VariableDefinitionNode } from '../../language/ast.ts';
import { parse } from '../../language/parser.ts';

import {
  GraphQLNonNull,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../../type/definition.ts';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../../type/introspection.ts';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars.ts';
import type { GraphQLSchema } from '../../type/schema.ts';
import { validateDefaultInput } from '../../type/validate.ts';

import { validateInputValue } from '../../utilities/validateInputValue.ts';

import { cancellablePromise } from '../cancellablePromise.ts';
import { collectIteratorPromises } from '../collectIteratorPromises.ts';
import { compileArgumentValues } from '../compile/compileArgumentValues.ts';
import { compileCollectFields } from '../compile/compileCollectFields.ts';
import {
  CompiledExecutionRunner,
  CompiledExecutor,
} from '../compile/CompiledExecutor.ts';
import {
  compileExecutionState,
  isExecutionErrors,
} from '../compile/compileExecutionState.ts';
import {
  compileFieldExecutionPlan,
  compileFieldResolver,
} from '../compile/compileFieldExecutionPlan.ts';
import { compileVariableValues } from '../compile/compileVariableValues.ts';
import { getCompiledArgumentValues } from '../compile/getCompiledArgumentValues.ts';
import { getCompiledVariableValues } from '../compile/getCompiledVariableValues.ts';
import { compileExecution, compileSubscription } from '../compile/index.ts';
import { createSharedExecutionContext } from '../createSharedExecutionContext.ts';
import {
  createSourceEventStream as originalCreateSourceEventStream,
  defaultFieldResolver,
  defaultTypeResolver,
  execute as originalExecute,
  executeIgnoringIncremental as originalExecuteIgnoringIncremental,
  executeSubscriptionEvent as originalExecuteSubscriptionEvent,
  executeSync as originalExecuteSync,
  experimentalExecuteIncrementally as originalExperimentalExecuteIncrementally,
  mapSourceToResponseEvent as originalMapSourceToResponseEvent,
  subscribe as originalSubscribe,
  validateSubscriptionArgs as originalValidateSubscriptionArgs,
} from '../execute.ts';
import type {
  ExecutionArgs,
  ValidatedSubscriptionArgs,
} from '../ExecutionArgs.ts';
import { EMPTY_VARIABLE_VALUES } from '../ExecutionArgs.ts';
import type { ExecutionResult } from '../Executor.ts';
import { generateExecution, generateSubscription } from '../generate/index.ts';
import type {
  ExperimentalIncrementalExecutionResults,
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../incremental/IncrementalExecutor.ts';
import { legacyExecuteIncrementally } from '../legacyIncremental/legacyExecuteIncrementally.ts';
import { mapAsyncIterable } from '../mapAsyncIterable.ts';
import { returnIteratorCatchingErrors } from '../returnIteratorCatchingErrors.ts';
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

// Number of implementations compared by these test helpers.
export const COMPARISON_COUNT = 3;

export function execute(
  args: ExecutionArgsInput,
): PromiseOrValue<ExecutionResult> {
  return expectMatchingExecutionResults([
    () => originalExecute(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
    () => executeGenerated(getExecutionArgs(args), 'execute'),
  ]);
}

export function executeSync(args: ExecutionArgsInput): ExecutionResult {
  return expectMatchingExecutionResults([
    () => originalExecuteSync(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
    () => executeGenerated(getExecutionArgs(args), 'execute'),
  ]) as ExecutionResult;
}

export function executeWithAllMethods(
  args: ExecutionArgsInput,
): PromiseOrValue<ExecutionResult> {
  return expectMatchingExecutionResults([
    () => originalExecute(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'execute'),
    () => executeGenerated(getExecutionArgs(args), 'execute'),
    () => originalExecuteIgnoringIncremental(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'executeIgnoringIncremental'),
    () =>
      executeGenerated(getExecutionArgs(args), 'executeIgnoringIncremental'),
    () => originalExperimentalExecuteIncrementally(getExecutionArgs(args)),
    () =>
      executeCompiled(
        getExecutionArgs(args),
        'experimentalExecuteIncrementally',
      ),
    () =>
      executeGenerated(
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
    () => executeGenerated(getExecutionArgs(args), 'execute'),
    () => originalExecuteIgnoringIncremental(getExecutionArgs(args)),
    () => executeCompiled(getExecutionArgs(args), 'executeIgnoringIncremental'),
    () =>
      executeGenerated(getExecutionArgs(args), 'executeIgnoringIncremental'),
    () => originalExperimentalExecuteIncrementally(getExecutionArgs(args)),
    () =>
      executeCompiled(
        getExecutionArgs(args),
        'experimentalExecuteIncrementally',
      ),
    () =>
      executeGenerated(
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
    () => subscribeGenerated(getExecutionArgs(args)),
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
    () => {
      const subscriptionArgs = getSubscriptionExecutionArgs(
        validatedSubscriptionArgs,
      );
      const generatedSubscription =
        createGeneratedSubscription(subscriptionArgs);
      return 'createSourceEventStream' in generatedSubscription
        ? generatedSubscription.createSourceEventStream(
            validatedSubscriptionArgs,
          )
        : { errors: generatedSubscription };
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
    () => {
      const generatedSubscription =
        createGeneratedSubscription(subscriptionArgs);
      return 'executeSubscriptionEvent' in generatedSubscription
        ? generatedSubscription.executeSubscriptionEvent(args)
        : { errors: generatedSubscription };
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
  const generatedSubscription = createGeneratedSubscription(subscriptionArgs);
  const generatedResult =
    'mapSourceToResponseEvent' in generatedSubscription
      ? generatedSubscription.mapSourceToResponseEvent(
          validatedSubscriptionArgs,
          replaySourceEventStream,
          wrappedRootSelectionSetExecutor,
        )
      : { errors: generatedSubscription };

  if (!isAsyncIterable(result)) {
    assert(!isAsyncIterable(compiledResult));
    assert(!isAsyncIterable(generatedResult));
    const comparedResult = expectMatchingExecutionResults([
      () => result,
      () => compiledResult,
      () => generatedResult,
    ]);
    assert(!isPromise(comparedResult));
    return comparedResult;
  }

  assert(isAsyncIterable(compiledResult));
  assert(isAsyncIterable(generatedResult));
  return expectMatchingAsyncIterables([
    result,
    compiledResult,
    generatedResult,
  ]);
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
  const generatedResult = executeGenerated(
    getExecutionArgs(args),
    'experimentalExecuteIncrementally',
  );
  const results = [result, compiledResult, generatedResult];

  if (results.some(isPromise)) {
    return Promise.allSettled(
      results.map((item) => Promise.resolve(item)),
    ).then((settledResults) => {
      const outcomes: Array<MatchingOutcome<IncrementalExecutionResult>> =
        settledResults.map((settledResult) =>
          settledResult.status === 'fulfilled'
            ? { kind: 'value', value: settledResult.value }
            : { kind: 'error', error: settledResult.reason },
        );
      if (outcomes.some((outcome) => outcome.kind === 'error')) {
        return expectMatchingOutcomes(outcomes);
      }
      return compareIncrementalExecutionResults(
        outcomes.map((outcome) => {
          assert(outcome.kind === 'value');
          return outcome.value;
        }),
      );
    });
  }

  return compareIncrementalExecutionResults(
    results.map((item) => {
      assert(!isPromise(item));
      return item;
    }),
  );
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

function executeGenerated(
  args: ExecutionArgs,
  method: CompiledExecutionMethod,
): PromiseOrValue<IncrementalExecutionResult> {
  const generatedExecutionSource = generateExecution(args);
  if (typeof generatedExecutionSource !== 'string') {
    if (isStaticGenerationBoundaryErrors(generatedExecutionSource)) {
      return executeCompiled(args, method);
    }
    return { errors: generatedExecutionSource };
  }

  const createCompiledExecution = getGeneratedExecutionFactory(
    generatedExecutionSource,
  );
  const generatedExecution = createCompiledExecution(args);
  if ('execute' in generatedExecution) {
    return generatedExecution[method](args);
  }
  return { errors: generatedExecution };
}

function isStaticGenerationBoundaryErrors(
  errors: ReadonlyArray<unknown>,
): boolean {
  return (
    errors.length === 1 &&
    errors[0] instanceof GraphQLError &&
    errors[0].message ===
      'Operation cannot be fully represented as static generated source.'
  );
}

function subscribeGenerated(
  args: ExecutionArgs,
): PromiseOrValue<SubscriptionResult> {
  try {
    const generatedSubscription = createGeneratedSubscription(args);
    return 'subscribe' in generatedSubscription
      ? generatedSubscription.subscribe(args)
      : { errors: generatedSubscription };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Expected subscription operation.'
    ) {
      throw error;
    }
    return { errors: [error] } as ExecutionResult;
  }
}

function createGeneratedSubscription(
  args: ExecutionArgs,
): ReturnType<typeof compileSubscription> {
  const generatedSubscriptionSource = generateSubscription(args);
  if (typeof generatedSubscriptionSource !== 'string') {
    if (isStaticGenerationBoundaryErrors(generatedSubscriptionSource)) {
      return compileSubscription(args);
    }
    if (
      generatedSubscriptionSource.some(
        (error) => error.message === 'Expected subscription operation.',
      )
    ) {
      throw new GraphQLError('Expected subscription operation.');
    }
    return generatedSubscriptionSource;
  }

  const createCompiledSubscription = getGeneratedSubscriptionFactory(
    generatedSubscriptionSource,
  );
  return createCompiledSubscription(args);
}

type GeneratedExecutionFactory = (
  args: ExecutionArgs,
) => ReturnType<typeof compileExecution>;

type GeneratedSubscriptionFactory = (
  args: ExecutionArgs,
) => ReturnType<typeof compileSubscription>;

const generatedExecutionFactoryCache = new Map<
  string,
  GeneratedExecutionFactory
>();

const generatedSubscriptionFactoryCache = new Map<
  string,
  GeneratedSubscriptionFactory
>();

const generatedExecutionDeps = {
  compileExecution,
  compileSubscription,
  isObjectLike,
  inspect,
  pathToArray,
  isPromiseLike,
  printPathArray,
  ensureGraphQLError,
  GraphQLError,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  locatedError,
  defaultFieldResolver,
  defaultTypeResolver,
  compileExecutionState,
  EMPTY_VARIABLE_VALUES,
  isExecutionErrors,
  parse,
  CompiledExecutor,
  cancellablePromise,
  createSharedExecutionContext,
  mapAsyncIterable,
  collectIteratorPromises,
  compileArgumentValues,
  compileCollectFields,
  compileFieldExecutionPlan,
  compileFieldResolver,
  compileVariableValues,
  getCompiledVariableValues,
  getCompiledArgumentValues,
  CompiledExecutionRunner,
  returnIteratorCatchingErrors,
  isAsyncIterable,
  isIterableObject,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  validateDefaultInput,
  validateInputValue,
};

function getGeneratedExecutionFactory(
  source: string,
): GeneratedExecutionFactory {
  let factory = generatedExecutionFactoryCache.get(source);
  if (factory === undefined) {
    const transformedSource = source
      .replace(/^import[\s\S]*?;\n/gm, '')
      .replace(
        'export function createCompiledExecution(args) {',
        'function createCompiledExecution(args) {',
      )
      .replace('\nexport default createCompiledExecution;\n', '\n');
    const wrappedSource = `"use strict";
const {
  compileExecution,
  isObjectLike,
  inspect,
  pathToArray,
  isPromiseLike,
  printPathArray,
  ensureGraphQLError,
  GraphQLError,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  locatedError,
  defaultFieldResolver,
  defaultTypeResolver,
  compileExecutionState,
  EMPTY_VARIABLE_VALUES,
  isExecutionErrors,
  parse,
  CompiledExecutor,
  createSharedExecutionContext,
  collectIteratorPromises,
  compileArgumentValues,
  compileCollectFields,
  compileFieldExecutionPlan,
  compileFieldResolver,
  compileVariableValues,
  getCompiledVariableValues,
  getCompiledArgumentValues,
  CompiledExecutionRunner,
  returnIteratorCatchingErrors,
  isAsyncIterable,
  isIterableObject,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  validateDefaultInput,
  validateInputValue,
} = __deps;
${transformedSource}
return createCompiledExecution;`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const createFactory = new Function('__deps', wrappedSource) as (
      deps: typeof generatedExecutionDeps,
    ) => GeneratedExecutionFactory;
    factory = createFactory(generatedExecutionDeps);
    generatedExecutionFactoryCache.set(source, factory);
  }
  return factory;
}

function getGeneratedSubscriptionFactory(
  source: string,
): GeneratedSubscriptionFactory {
  let factory = generatedSubscriptionFactoryCache.get(source);
  if (factory === undefined) {
    const transformedSource = source
      .replace(/^import[\s\S]*?;\n/gm, '')
      .replace(
        'export function createCompiledSubscription(args) {',
        'function createCompiledSubscription(args) {',
      )
      .replace('\nexport default createCompiledSubscription;\n', '\n');
    const wrappedSource = `"use strict";
const {
  compileExecution,
  compileSubscription,
  isObjectLike,
  inspect,
  pathToArray,
  isPromiseLike,
  printPathArray,
  ensureGraphQLError,
  GraphQLError,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  locatedError,
  defaultFieldResolver,
  defaultTypeResolver,
  compileExecutionState,
  EMPTY_VARIABLE_VALUES,
  isExecutionErrors,
  parse,
  CompiledExecutor,
  cancellablePromise,
  createSharedExecutionContext,
  mapAsyncIterable,
  collectIteratorPromises,
  compileArgumentValues,
  compileCollectFields,
  compileFieldExecutionPlan,
  compileFieldResolver,
  compileVariableValues,
  getCompiledVariableValues,
  getCompiledArgumentValues,
  CompiledExecutionRunner,
  returnIteratorCatchingErrors,
  isAsyncIterable,
  isIterableObject,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  validateDefaultInput,
  validateInputValue,
} = __deps;
${transformedSource}
return createCompiledSubscription;`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const createFactory = new Function('__deps', wrappedSource) as (
      deps: typeof generatedExecutionDeps,
    ) => GeneratedSubscriptionFactory;
    factory = createFactory(generatedExecutionDeps);
    generatedSubscriptionFactoryCache.set(source, factory);
  }
  return factory;
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

function compareIncrementalExecutionResults(
  results: ReadonlyArray<IncrementalExecutionResult>,
): IncrementalExecutionResult {
  const [firstResult] = results;
  assert(firstResult !== undefined, 'Expected at least one execution result.');

  if (!isIncrementalExecutionResult(firstResult)) {
    for (const result of results) {
      assert(
        !isIncrementalExecutionResult(result),
        'Received an invalid mixture of execution results and incremental execution results.',
      );
    }
    return expectMatchingValues(results.map((result) => () => result));
  }

  const incrementalResults = results.map((result) => {
    assert(
      isIncrementalExecutionResult(result),
      'Received an invalid mixture of execution results and incremental execution results.',
    );
    return result;
  });
  expectMatchingValues(
    incrementalResults.map(
      (result) => () => normalizeIncrementalPayloads([result.initialResult]),
    ),
  );

  const payloadsByResult: Array<Array<IncrementalExecutionPayload>> =
    incrementalResults.map((result) => [result.initialResult]);
  return {
    initialResult: firstResult.initialResult,
    subsequentResults: expectMatchingAsyncIterablesConcurrently(
      incrementalResults.map((result) => result.subsequentResults),
      (payloadBatches) => {
        for (let i = 0; i < payloadBatches.length; i++) {
          const payloads = payloadsByResult[i];
          const subsequentPayloads = payloadBatches[i];
          assert(payloads !== undefined);
          assert(subsequentPayloads !== undefined);
          payloads.push(...subsequentPayloads);
        }
        expectMatchingValues(
          payloadsByResult.map(
            (payloads) => () => normalizeIncrementalPayloads(payloads),
          ),
        );
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
