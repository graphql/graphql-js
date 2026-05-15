/** @category Request Pipeline */

import { isPromise } from './jsutils/isPromise.ts';
import type { PromiseOrValue } from './jsutils/PromiseOrValue.ts';

import { ensureGraphQLError } from './error/ensureGraphQLError.ts';
import type { GraphQLError } from './error/GraphQLError.ts';

import type { DocumentNode } from './language/ast.ts';
import type { ParseOptions } from './language/parser.ts';
import type { Source } from './language/source.ts';

import type { GraphQLSchema } from './type/schema.ts';
import { validateSchema } from './type/validate.ts';

import type { ValidationOptions } from './validation/validate.ts';
import type { ValidationRule } from './validation/ValidationContext.ts';

import type { ExecutionArgs } from './execution/execute.ts';
import type { ExecutionResult } from './execution/Executor.ts';

import type { GraphQLHarness } from './harness.ts';
import { defaultHarness } from './harness.ts';

/**
 * Describes the input object accepted by `graphql` and `graphqlSync`.
 *
 * These arguments describe the full parse, validate, and execute lifecycle for
 * a GraphQL request. They include parser options, validation options, execution
 * options, and an optional harness for replacing pipeline stages.
 *
 * `graphql` and `graphqlSync` do not support incremental delivery (`@defer` and
 * `@stream`); use `experimentalExecuteIncrementally` after parsing and
 * validating when incremental delivery is required.
 */
export interface GraphQLArgs
  extends ParseOptions, ValidationOptions, Omit<ExecutionArgs, 'document'> {
  /**
   * Custom parse, validate, execute, and subscribe functions for this request
   * pipeline.
   */
  harness?: GraphQLHarness | undefined;
  /**
   * A GraphQL language-formatted string or source object representing the
   * requested operation.
   */
  source: string | Source;
  /** Validation rules to use instead of the specified rules. */
  rules?: ReadonlyArray<ValidationRule> | undefined;
}

/**
 * Parses, validates, and executes a GraphQL document against a schema.
 *
 * This is the primary entry point for fulfilling GraphQL operations. Use this
 * when you want a single-call request lifecycle that returns a promise in all
 * cases.
 *
 * More sophisticated GraphQL servers, such as those which persist queries, may
 * wish to separate the validation and execution phases to a static-time tooling
 * step and a server runtime step.
 * @param args - Request execution arguments, including schema and source.
 * @returns A promise that resolves to an execution result or validation errors.
 * @example
 * ```ts
 * // Execute a complete asynchronous request with variables.
 * import { graphql, buildSchema } from 'graphql';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting(name: String!): String
 *   }
 * `);
 *
 * const result = await graphql({
 *   schema,
 *   source: 'query SayHello($name: String!) { greeting(name: $name) }',
 *   rootValue: {
 *     greeting: ({ name }) => `Hello, ${name}!`,
 *   },
 *   variableValues: { name: 'Ada' },
 *   operationName: 'SayHello',
 * });
 *
 * result; // => { data: { greeting: 'Hello, Ada!' } }
 * ```
 * @example
 * ```ts
 * // This variant supplies context plus custom field and type resolvers.
 * import { graphql, buildSchema } from 'graphql';
 *
 * const schema = buildSchema(`
 *   interface Named {
 *     name: String!
 *   }
 *
 *   type User implements Named {
 *     name: String!
 *   }
 *
 *   type Query {
 *     viewer: Named
 *   }
 * `);
 *
 * const result = await graphql({
 *   schema,
 *   source: '{ viewer { __typename name } }',
 *   rootValue: { viewer: { kind: 'user', name: 'Ada' } },
 *   contextValue: { locale: 'en' },
 *   fieldResolver: (source, _args, context, info) => {
 *     context.locale; // => 'en'
 *     return source[info.fieldName];
 *   },
 *   typeResolver: (value) => {
 *     return value.kind === 'user' ? 'User' : undefined;
 *   },
 * });
 *
 * result; // => { data: { viewer: { __typename: 'User', name: 'Ada' } } }
 * ```
 * @example
 * ```ts
 * // This variant customizes the request pipeline with a harness.
 * import { buildSchema, defaultHarness, graphql } from 'graphql';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const stages = [];
 * const abortController = new AbortController();
 * const harness = {
 *   parse: (...args) => {
 *     stages.push('parse');
 *     return defaultHarness.parse(...args);
 *   },
 *   validate: (...args) => {
 *     stages.push('validate');
 *     return defaultHarness.validate(...args);
 *   },
 *   execute: (...args) => {
 *     stages.push('execute');
 *     return defaultHarness.execute(...args);
 *   },
 *   subscribe: (...args) => {
 *     stages.push('subscribe');
 *     return defaultHarness.subscribe(...args);
 *   },
 * };
 *
 * const result = await graphql({
 *   schema,
 *   source: '{ greeting }',
 *   rootValue: { greeting: 'Hello' },
 *   rules: [],
 *   maxErrors: 25,
 *   hideSuggestions: true,
 *   noLocation: true,
 *   abortSignal: abortController.signal,
 *   harness,
 * });
 *
 * result; // => { data: { greeting: 'Hello' } }
 * stages; // => ['parse', 'validate', 'execute']
 * ```
 * @category Request Pipeline
 */
export function graphql(args: GraphQLArgs): Promise<ExecutionResult> {
  // Always return a Promise for a consistent API.
  return new Promise((resolve) => resolve(graphqlImpl(args)));
}

/**
 * Parses, validates, and executes a GraphQL document synchronously.
 *
 * This function guarantees that execution completes synchronously, or throws an
 * error, assuming that all field resolvers are also synchronous. It throws when
 * any resolver returns a promise.
 * @param args - Request execution arguments, including schema and source.
 * @returns Completed execution output, or request errors if parsing or
 * validation fails.
 * @example
 * ```ts
 * // Execute a complete synchronous request with variables.
 * import { graphqlSync, buildSchema } from 'graphql';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting(name: String!): String
 *   }
 * `);
 *
 * const result = graphqlSync({
 *   schema,
 *   source: 'query SayHello($name: String!) { greeting(name: $name) }',
 *   rootValue: {
 *     greeting: ({ name }) => `Hello, ${name}!`,
 *   },
 *   variableValues: { name: 'Ada' },
 *   operationName: 'SayHello',
 * });
 *
 * result; // => { data: { greeting: 'Hello, Ada!' } }
 * ```
 * @example
 * ```ts
 * // This variant uses a synchronous custom field resolver and context.
 * import { graphqlSync, buildSchema } from 'graphql';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 *
 * const result = graphqlSync({
 *   schema,
 *   source: '{ greeting }',
 *   fieldResolver: (_source, _args, contextValue) => {
 *     return contextValue.defaultGreeting;
 *   },
 *   contextValue: { defaultGreeting: 'Hello' },
 * });
 *
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 * @category Request Pipeline
 */
export function graphqlSync(args: GraphQLArgs): ExecutionResult {
  const result = graphqlImpl(args);

  // Assert that the execution was synchronous.
  if (isPromise(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

function graphqlImpl(args: GraphQLArgs): PromiseOrValue<ExecutionResult> {
  const harness = args.harness ?? defaultHarness;
  const { schema, source } = args;

  // Validate Schema
  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    return { errors: schemaValidationErrors };
  }

  // Parse
  let document;
  try {
    document = harness.parse(source, args);
  } catch (syntaxError) {
    return { errors: [ensureGraphQLError(syntaxError)] };
  }

  if (isPromise(document)) {
    return document.then(
      (resolvedDocument) =>
        validateAndExecute(harness, args, schema, resolvedDocument),
      (syntaxError: unknown) => ({ errors: [ensureGraphQLError(syntaxError)] }),
    );
  }

  return validateAndExecute(harness, args, schema, document);
}

function validateAndExecute(
  harness: GraphQLHarness,
  args: GraphQLArgs,
  schema: GraphQLSchema,
  document: DocumentNode,
): PromiseOrValue<ExecutionResult> {
  // Validate
  const validationResult = harness.validate(schema, document, args.rules, args);

  if (isPromise(validationResult)) {
    return validationResult.then((resolvedValidationResult) =>
      checkValidationAndExecute(
        harness,
        args,
        resolvedValidationResult,
        document,
      ),
    );
  }

  return checkValidationAndExecute(harness, args, validationResult, document);
}

function checkValidationAndExecute(
  harness: GraphQLHarness,
  args: GraphQLArgs,
  validationResult: ReadonlyArray<GraphQLError>,
  document: DocumentNode,
): PromiseOrValue<ExecutionResult> {
  if (validationResult.length > 0) {
    return { errors: validationResult };
  }

  // Execute
  return harness.execute({ ...args, document });
}
