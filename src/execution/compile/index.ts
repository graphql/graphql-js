/**
 * Compile GraphQL operations for repeated execution.
 * @packageDocumentation
 */

import { inspect } from '../../jsutils/inspect.ts';
import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';
import { isObjectLike } from '../../jsutils/isObjectLike.ts';
import { isPromise, isPromiseLike } from '../../jsutils/isPromise.ts';
import { addPath, pathToArray } from '../../jsutils/Path.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';
import { locatedError } from '../../error/locatedError.ts';

import type {
  FieldNode,
  SubscriptionOperationDefinitionNode,
} from '../../language/ast.ts';
import { isSubscriptionOperationDefinitionNode } from '../../language/predicates.ts';

import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../../type/definition.ts';

import { buildResolveInfo } from '../buildResolveInfo.ts';
import { cancellablePromise } from '../cancellablePromise.ts';
import type { FieldDetailsList } from '../collectFields.ts';
import { createSharedExecutionContext } from '../createSharedExecutionContext.ts';
import type {
  CompiledExecutionArgs,
  CompileExecutionArgs,
  RootSelectionSetExecutor,
  ValidatedExecutionArgs,
  ValidatedSubscriptionArgs,
} from '../ExecutionArgs.ts';
import { EMPTY_VARIABLE_VALUES } from '../ExecutionArgs.ts';
import type { ExecutionResult } from '../Executor.ts';
import type { ExperimentalIncrementalExecutionResults } from '../incremental/IncrementalExecutor.ts';
import { mapAsyncIterable } from '../mapAsyncIterable.ts';
import type { VariableValuesOrErrors } from '../values.ts';

import { buildValidatedExecutionArgs } from './buildValidatedExecutionArgs.ts';
import { CompiledExecutor } from './CompiledExecutor.ts';
import type { CompiledExecutionState } from './compileExecutionState.ts';
import {
  compileExecutionState,
  isExecutionErrors,
} from './compileExecutionState.ts';
import type { CompiledVariableValues } from './compileVariableValues.ts';
import { compileVariableValues } from './compileVariableValues.ts';
import { getCompiledArgumentValues } from './getCompiledArgumentValues.ts';
import { getCompiledVariableValues } from './getCompiledVariableValues.ts';

export type {
  CompiledExecutionArgs,
  CompileExecutionArgs,
  RootSelectionSetExecutor,
} from '../ExecutionArgs.ts';

/**
 * Compiled execution operation with reusable validation and field collection.
 * @category Execution
 */
export interface CompiledExecution {
  /** Execute the operation. */
  execute: (args?: CompiledExecutionArgs) => PromiseOrValue<ExecutionResult>;
  /** Execute the operation with incremental delivery enabled. */
  experimentalExecuteIncrementally: (
    args?: CompiledExecutionArgs,
  ) => PromiseOrValue<
    ExecutionResult | ExperimentalIncrementalExecutionResults
  >;
  /** @internal */
  executeIgnoringIncremental: (
    args?: CompiledExecutionArgs,
  ) => PromiseOrValue<
    ExecutionResult | ExperimentalIncrementalExecutionResults
  >;
}

/**
 * Compiled subscription operation with reusable validation and field collection.
 * @category Execution
 */
export interface CompiledSubscription extends CompiledExecution {
  /** Execute the subscription operation once for a single source event. */
  executeSubscriptionEvent: (
    args: ValidatedSubscriptionArgs,
  ) => PromiseOrValue<ExecutionResult>;
  /** Create the subscription source event stream. */
  createSourceEventStream: (
    args: ValidatedSubscriptionArgs,
  ) => PromiseOrValue<AsyncIterable<unknown> | ExecutionResult>;
  /** Map a source event stream to execution results. */
  mapSourceToResponseEvent: (
    args: ValidatedSubscriptionArgs,
    sourceEventStream: AsyncIterable<unknown>,
    rootSelectionSetExecutor?: RootSelectionSetExecutor,
  ) => AsyncGenerator<ExecutionResult, void, void> | ExecutionResult;
  /** Run the full subscription pipeline. */
  subscribe: (
    args?: CompiledExecutionArgs,
  ) => PromiseOrValue<
    AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
  >;
}

interface CompiledSubscriptionState extends CompiledExecutionState {
  operation: SubscriptionOperationDefinitionNode;
}

const compiledDefaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
    if (isObjectLike(value) && typeof value.__typename === 'string') {
      return value.__typename;
    }

    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults: Array<PromiseLike<boolean>> = [];

    try {
      for (let i = 0; i < possibleTypes.length; i++) {
        const type = possibleTypes[i];

        if (type.isTypeOf) {
          const isTypeOfResult = type.isTypeOf(value, contextValue, info);

          if (isPromiseLike(isTypeOfResult)) {
            promisedIsTypeOfResults[i] = isTypeOfResult;
          } else if (isTypeOfResult) {
            if (promisedIsTypeOfResults.length) {
              info.getAsyncHelpers().track(promisedIsTypeOfResults);
            }
            return type.name;
          }
        }
      }
    } catch (error) {
      if (promisedIsTypeOfResults.length) {
        info.getAsyncHelpers().track(promisedIsTypeOfResults);
      }
      throw error;
    }

    if (promisedIsTypeOfResults.length) {
      return info
        .getAsyncHelpers()
        .promiseAll(promisedIsTypeOfResults)
        .then((isTypeOfResults) => {
          for (let i = 0; i < isTypeOfResults.length; i++) {
            if (isTypeOfResults[i]) {
              return possibleTypes[i].name;
            }
          }
        });
    }
  };

const compiledDefaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return property.call(source, args, contextValue, info);
      }
      return property;
    }
  };

const defaultResolvers = {
  fieldResolver: compiledDefaultFieldResolver,
  typeResolver: compiledDefaultTypeResolver,
  subscribeFieldResolver: compiledDefaultFieldResolver,
};

/**
 * Compiles a GraphQL execution operation for repeated execution.
 * @param args - Static execution arguments to compile.
 * @returns A compiled execution operation, or validation errors.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { compileExecution } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 * const compiled = compileExecution({
 *   schema,
 *   document: parse('{ greeting }'),
 * });
 *
 * assert('execute' in compiled);
 *
 * const result = await compiled.execute({
 *   rootValue: { greeting: 'Hello' },
 * });
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 * @category Execution
 */
export function compileExecution(
  args: CompileExecutionArgs,
): ReadonlyArray<GraphQLError> | CompiledExecution {
  const compiledExecution = compileExecutionState(args);
  if (isExecutionErrors(compiledExecution)) {
    return compiledExecution;
  }
  return new CompiledExecutionImpl(compiledExecution);
}

/**
 * Compiles a GraphQL subscription operation for repeated subscription work.
 * @param args - Static execution arguments to compile.
 * @returns A compiled subscription operation, or validation errors.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { compileSubscription } from 'graphql/execution';
 *
 * async function* greetings() {
 *   yield { greeting: 'Hello' };
 * }
 *
 * const schema = buildSchema(`
 *   type Query {
 *     noop: String
 *   }
 *
 *   type Subscription {
 *     greeting: String
 *   }
 * `);
 * const compiled = compileSubscription({
 *   schema,
 *   document: parse('subscription { greeting }'),
 * });
 *
 * assert('subscribe' in compiled);
 *
 * const result = await compiled.subscribe({
 *   rootValue: { greeting: () => greetings() },
 * });
 * assert('next' in result);
 * ```
 * @category Execution
 */
export function compileSubscription(
  args: CompileExecutionArgs,
): ReadonlyArray<GraphQLError> | CompiledSubscription {
  const compiledExecution = compileExecutionState(args);
  if (isExecutionErrors(compiledExecution)) {
    return compiledExecution;
  }
  assertSubscriptionCompiledExecution(compiledExecution);
  return new CompiledSubscriptionImpl(compiledExecution);
}

class CompiledExecutionImpl implements CompiledExecution {
  protected _compiledExecution: CompiledExecutionState;
  private _compiledVariableValues: CompiledVariableValues;
  private _variableValuesCache: WeakMap<
    { readonly [variable: string]: unknown },
    Map<number, VariableValuesOrErrors>
  >;

  constructor(compiledExecution: CompiledExecutionState) {
    this._compiledExecution = compiledExecution;
    this._compiledVariableValues = compileVariableValues(
      compiledExecution.schema,
      compiledExecution.variableDefinitions,
      compiledExecution.hideSuggestions,
    );
    this._variableValuesCache = new WeakMap();
  }

  execute(args: CompiledExecutionArgs = {}): PromiseOrValue<ExecutionResult> {
    return this.executeWithValidatedArgs(args, (validatedExecutionArgs) =>
      new CompiledExecutor(
        validatedExecutionArgs,
        'throw',
      ).executeRootSelectionSet(),
    );
  }

  experimentalExecuteIncrementally(
    args: CompiledExecutionArgs = {},
  ): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
    return this.executeWithValidatedArgs(args, (validatedExecutionArgs) =>
      new CompiledExecutor(
        validatedExecutionArgs,
        'incremental',
      ).executeRootSelectionSet(),
    );
  }

  executeIgnoringIncremental(
    args: CompiledExecutionArgs = {},
  ): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
    return this.executeWithValidatedArgs(args, (validatedExecutionArgs) =>
      new CompiledExecutor(
        validatedExecutionArgs,
        'ignore',
      ).executeRootSelectionSet(),
    );
  }

  protected getValidatedExecutionArgs(
    args: CompiledExecutionArgs = {},
  ): ReadonlyArray<GraphQLError> | ValidatedExecutionArgs {
    const variableValuesOrErrors = this.getVariableValues(args);
    if (variableValuesOrErrors.errors) {
      return variableValuesOrErrors.errors;
    }

    return buildValidatedExecutionArgs(
      this._compiledExecution,
      args,
      variableValuesOrErrors.variableValues,
      defaultResolvers,
    );
  }

  protected withCompiledFieldCollectors<T extends ValidatedExecutionArgs>(
    validatedExecutionArgs: T,
  ): T {
    if (validatedExecutionArgs.fieldCollectors !== this._compiledExecution) {
      return {
        ...validatedExecutionArgs,
        fieldCollectors: this._compiledExecution,
      };
    }
    return validatedExecutionArgs;
  }

  private executeWithValidatedArgs<T>(
    args: CompiledExecutionArgs,
    execute: (
      validatedExecutionArgs: ValidatedExecutionArgs,
    ) => PromiseOrValue<T>,
  ): PromiseOrValue<T | ExecutionResult> {
    const validatedExecutionArgs = this.getValidatedExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
      return { errors: validatedExecutionArgs };
    }
    return execute(validatedExecutionArgs);
  }

  private getVariableValues(
    args: CompiledExecutionArgs,
  ): VariableValuesOrErrors {
    const rawVariableValues = args.variableValues ?? EMPTY_VARIABLE_VALUES;
    const maxCoercionErrors = args.options?.maxCoercionErrors ?? 50;
    let variableValuesByMaxErrors =
      this._variableValuesCache.get(rawVariableValues);
    if (variableValuesByMaxErrors === undefined) {
      variableValuesByMaxErrors = new Map();
      this._variableValuesCache.set(
        rawVariableValues,
        variableValuesByMaxErrors,
      );
    }

    let variableValuesOrErrors =
      variableValuesByMaxErrors.get(maxCoercionErrors);
    if (variableValuesOrErrors === undefined) {
      variableValuesOrErrors = getCompiledVariableValues(
        this._compiledVariableValues,
        rawVariableValues,
        maxCoercionErrors,
      );
      variableValuesByMaxErrors.set(maxCoercionErrors, variableValuesOrErrors);
    }
    return variableValuesOrErrors;
  }
}

class CompiledSubscriptionImpl
  extends CompiledExecutionImpl
  implements CompiledSubscription
{
  executeSubscriptionEvent(
    validatedExecutionArgs: ValidatedSubscriptionArgs,
  ): PromiseOrValue<ExecutionResult> {
    return new CompiledExecutor(
      this.withCompiledFieldCollectors(validatedExecutionArgs),
      'throw',
    ).executeRootSelectionSet(false);
  }

  createSourceEventStream(
    validatedExecutionArgs: ValidatedSubscriptionArgs,
  ): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
    return createCompiledSourceEventStream(
      this.withCompiledFieldCollectors(validatedExecutionArgs),
    );
  }

  mapSourceToResponseEvent(
    validatedExecutionArgs: ValidatedSubscriptionArgs,
    sourceEventStream: AsyncIterable<unknown>,
    rootSelectionSetExecutor?: RootSelectionSetExecutor,
  ): AsyncGenerator<ExecutionResult, void, void> | ExecutionResult {
    return mapCompiledSourceToResponseEvent(
      this.withCompiledFieldCollectors(validatedExecutionArgs),
      sourceEventStream,
      rootSelectionSetExecutor ?? this.executeSubscriptionEvent.bind(this),
    );
  }

  subscribe(
    args: CompiledExecutionArgs = {},
  ): PromiseOrValue<
    AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
  > {
    const validatedExecutionArgs = this.getValidatedSubscriptionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
      return { errors: validatedExecutionArgs };
    }

    const resultOrStream = createCompiledSourceEventStream(
      validatedExecutionArgs,
    );

    if (isPromise(resultOrStream)) {
      return resultOrStream.then((resolvedResultOrStream) =>
        isAsyncIterable(resolvedResultOrStream)
          ? mapCompiledSourceToResponseEvent(
              validatedExecutionArgs,
              resolvedResultOrStream,
              this.executeSubscriptionEvent.bind(this),
            )
          : resolvedResultOrStream,
      );
    }

    return isAsyncIterable(resultOrStream)
      ? mapCompiledSourceToResponseEvent(
          validatedExecutionArgs,
          resultOrStream,
          this.executeSubscriptionEvent.bind(this),
        )
      : resultOrStream;
  }

  private getValidatedSubscriptionArgs(
    args: CompiledExecutionArgs,
  ): ReadonlyArray<GraphQLError> | ValidatedSubscriptionArgs {
    const validatedExecutionArgs = this.getValidatedExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
      return validatedExecutionArgs;
    }
    // CompiledSubscriptionImpl is only constructed for subscription operations.
    return validatedExecutionArgs as ValidatedSubscriptionArgs;
  }
}

function createCompiledSourceEventStream(
  validatedExecutionArgs: ValidatedSubscriptionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  if (!('operation' in validatedExecutionArgs)) {
    throw new GraphQLError(
      'Passing ExecutionArgs to createSourceEventStream() was removed in graphql-js@17.0.0; call validateSubscriptionArgs() first and pass the result instead, or use subscribe() for the full subscription pipeline.',
    );
  }

  try {
    const eventStream = executeCompiledSubscription(validatedExecutionArgs);
    if (isPromise(eventStream)) {
      return eventStream.then(undefined, (error: unknown) => ({
        errors: [ensureGraphQLError(error)],
      }));
    }

    return eventStream;
  } catch (error) {
    return { errors: [ensureGraphQLError(error)] };
  }
}

function mapCompiledSourceToResponseEvent(
  validatedExecutionArgs: ValidatedSubscriptionArgs,
  sourceEventStream: AsyncIterable<unknown>,
  rootSelectionSetExecutor: RootSelectionSetExecutor,
): AsyncGenerator<ExecutionResult, void, void> {
  function mapFn(payload: unknown): PromiseOrValue<ExecutionResult> {
    const perEventExecutionArgs: ValidatedSubscriptionArgs = {
      ...validatedExecutionArgs,
      rootValue: payload,
    };
    return rootSelectionSetExecutor(perEventExecutionArgs);
  }

  const externalAbortSignal = validatedExecutionArgs.externalAbortSignal;
  if (externalAbortSignal) {
    const generator = mapAsyncIterable(sourceEventStream, mapFn);
    return {
      ...generator,
      next: () => cancellablePromise(generator.next(), externalAbortSignal),
    };
  }
  return mapAsyncIterable(sourceEventStream, mapFn);
}

function executeCompiledSubscription(
  validatedExecutionArgs: ValidatedSubscriptionArgs,
): PromiseOrValue<AsyncIterable<unknown>> {
  const {
    schema,
    rootValue,
    contextValue,
    operation,
    variableValues,
    externalAbortSignal,
  } = validatedExecutionArgs;

  const rootType = schema.getSubscriptionType();
  if (rootType == null) {
    throw new GraphQLError(
      'Schema is not configured to execute subscription operation.',
      { nodes: operation },
    );
  }

  const { groupedFieldSet } =
    validatedExecutionArgs.fieldCollectors.collectRootFields(
      variableValues,
      rootType,
    );

  const firstRootField = groupedFieldSet.entries().next();
  if (firstRootField.done === true) {
    throw new GraphQLError('Subscription operation must select a field.');
  }
  const [responseName, fieldDetailsList] = firstRootField.value;
  const firstFieldDetails = fieldDetailsList[0];
  const firstNode = firstFieldDetails.node;
  const compiledFieldPlan = firstFieldDetails.compiledFieldPlan;
  const fieldName = firstNode.name.value;
  const fieldNodes = toNodes(fieldDetailsList);
  if (compiledFieldPlan === undefined) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: fieldNodes },
    );
  }
  const fieldDef = compiledFieldPlan.fieldDef;

  const sharedExecutionContext =
    createSharedExecutionContext(externalAbortSignal);
  const path = addPath(undefined, responseName, rootType.name);
  const info = buildResolveInfo(
    validatedExecutionArgs,
    fieldDef,
    fieldNodes,
    rootType,
    path,
    sharedExecutionContext.getAbortSignal,
    sharedExecutionContext.getAsyncHelpers,
  );

  try {
    const args = getCompiledArgumentValues(
      compiledFieldPlan.compiledArgumentValues,
      variableValues,
    );

    const resolveFn =
      fieldDef.subscribe ?? validatedExecutionArgs.subscribeFieldResolver;
    const result = resolveFn(rootValue, args, contextValue, info);

    if (isPromiseLike(result)) {
      const promisedResult = Promise.resolve(result);
      const promise = externalAbortSignal
        ? cancellablePromise(promisedResult, externalAbortSignal)
        : promisedResult;
      return promise
        .then(assertEventStream)
        .then(undefined, (error: unknown) => {
          throw locatedError(error, fieldNodes, pathToArray(path));
        });
    }
    return assertEventStream(result);
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
  }
}

function assertEventStream(result: unknown): AsyncIterable<unknown> {
  if (result instanceof Error) {
    throw result;
  }

  if (!isAsyncIterable(result)) {
    throw new GraphQLError(
      'Subscription field must return Async Iterable. ' +
        `Received: ${inspect(result)}.`,
    );
  }

  return result;
}

function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}

function assertSubscriptionCompiledExecution(
  compiledExecution: CompiledExecutionState,
): asserts compiledExecution is CompiledSubscriptionState {
  if (!isSubscriptionOperationDefinitionNode(compiledExecution.operation)) {
    throw new GraphQLError('Expected subscription operation.');
  }
}
