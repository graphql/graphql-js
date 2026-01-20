import { isObjectLike } from '../jsutils/isObjectLike.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import { GraphQLDisableErrorPropagationDirective } from '../type/directives.js';
import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/index.js';
import { assertValidSchema } from '../type/index.js';
import type { GraphQLSchema } from '../type/schema.js';

import type { FragmentDetails } from './collectFields.js';
import type { ExecutionResult, ValidatedExecutionArgs } from './execute.js';
import {
  createSourceEventStreamImpl,
  executeQueryOrMutationOrSubscriptionEvent,
  mapSourceToResponse,
} from './execute.js';
import { getVariableSignature } from './getVariableSignature.js';
import { getVariableValues } from './values.js';

/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return executeQueryOrMutationOrSubscriptionEvent(validatedExecutionArgs);
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = execute(args);

  // Assert that the execution was synchronous.
  if (isPromise(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

export function executeSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  return executeQueryOrMutationOrSubscriptionEvent(validatedExecutionArgs);
}

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with descriptive
 * errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription resolver
 * logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * Accepts an object with named arguments.
 */
export function subscribe(
  args: ExecutionArgs,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  const resultOrStream = createSourceEventStreamImpl(validatedExecutionArgs);

  if (isPromise(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      mapSourceToResponse(validatedExecutionArgs, resolvedResultOrStream),
    );
  }

  return mapSourceToResponse(validatedExecutionArgs, resultOrStream);
}

/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream.
 *
 * Returns a Promise which resolves to either an AsyncIterable (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to the AsyncIterable for the
 * event stream returned by the resolver.
 *
 * A Source Event Stream represents a sequence of events, each of which triggers
 * a GraphQL execution for that event.
 *
 * This may be useful when hosting the stateful subscription service in a
 * different process or machine than the stateless GraphQL execution engine,
 * or otherwise separating these two steps. For more on this, see the
 * "Supporting Subscriptions at Scale" information in the GraphQL specification.
 */
export function createSourceEventStream(
  args: ExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return createSourceEventStreamImpl(validatedExecutionArgs);
}

export interface ExecutionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  perEventExecutor?: Maybe<
    (
      validatedExecutionArgs: ValidatedExecutionArgs,
    ) => PromiseOrValue<ExecutionResult>
  >;
  hideSuggestions?: Maybe<boolean>;
  abortSignal?: Maybe<AbortSignal>;
  /** Additional execution options. */
  options?: {
    /** Set the maximum number of errors allowed for coercing (defaults to 50). */
    maxCoercionErrors?: number;
  };
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * TODO: consider no longer exporting this function
 * @internal
 */
export function validateExecutionArgs(
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ValidatedExecutionArgs {
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues: rawVariableValues,
    operationName,
    fieldResolver,
    typeResolver,
    subscribeFieldResolver,
    perEventExecutor,
    abortSignal: externalAbortSignal,
    options,
  } = args;

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  let operation: OperationDefinitionNode | undefined;
  const fragmentDefinitions: ObjMap<FragmentDefinitionNode> =
    Object.create(null);
  const fragments: ObjMap<FragmentDetails> = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError(
                'Must provide operation name if query contains multiple operations.',
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION: {
        fragmentDefinitions[definition.name.value] = definition;
        let variableSignatures;
        if (definition.variableDefinitions) {
          variableSignatures = Object.create(null);
          for (const varDef of definition.variableDefinitions) {
            const signature = getVariableSignature(schema, varDef);
            variableSignatures[signature.name] = signature;
          }
        }
        fragments[definition.name.value] = { definition, variableSignatures };
        break;
      }
      default:
      // ignore non-executable definitions
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }

  const variableDefinitions = operation.variableDefinitions ?? [];
  const hideSuggestions = args.hideSuggestions ?? false;

  const variableValuesOrErrors = getVariableValues(
    schema,
    variableDefinitions,
    rawVariableValues ?? {},
    {
      maxErrors: options?.maxCoercionErrors ?? 50,
      hideSuggestions,
    },
  );

  if (variableValuesOrErrors.errors) {
    return variableValuesOrErrors.errors;
  }

  const errorPropagation =
    operation.directives?.find(
      (directive) =>
        directive.name.value === GraphQLDisableErrorPropagationDirective.name,
    ) === undefined;

  return {
    schema,
    fragmentDefinitions,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: variableValuesOrErrors.variableValues,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    perEventExecutor: perEventExecutor ?? executeSubscriptionEvent,
    hideSuggestions,
    errorPropagation,
    externalAbortSignal: externalAbortSignal ?? undefined,
  };
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
    // First, look for `__typename`.
    if (isObjectLike(value) && typeof value.__typename === 'string') {
      return value.__typename;
    }

    // Otherwise, test each possible type.
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults = [];

    for (let i = 0; i < possibleTypes.length; i++) {
      const type = possibleTypes[i];

      if (type.isTypeOf) {
        const isTypeOfResult = type.isTypeOf(value, contextValue, info);

        if (isPromise(isTypeOfResult)) {
          promisedIsTypeOfResults[i] = isTypeOfResult;
        } else if (isTypeOfResult) {
          if (promisedIsTypeOfResults.length) {
            // Explicitly ignore any promise rejections
            Promise.allSettled(promisedIsTypeOfResults)
              /* c8 ignore next 3 */
              .catch(() => {
                // Do nothing
              });
          }
          return type.name;
        }
      }
    }

    if (promisedIsTypeOfResults.length) {
      return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
        for (let i = 0; i < isTypeOfResults.length; i++) {
          if (isTypeOfResults[i]) {
            return possibleTypes[i].name;
          }
        }
      });
    }
  };

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return source[info.fieldName](args, contextValue, info);
      }
      return property;
    }
  };
