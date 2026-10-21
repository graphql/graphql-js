/** @category Request Pipeline */
import type { ParseOptions } from "./language/parser.js";
import type { Source } from "./language/source.js";
import type { ValidationOptions } from "./validation/validate.js";
import type { ValidationRule } from "./validation/ValidationContext.js";
import type { ExecutionArgs } from "./execution/ExecutionArgs.js";
import type { ExecutionResult } from "./execution/Executor.js";
import type { GraphQLHarness } from "./harness.js";
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
export interface GraphQLArgs extends ParseOptions, ValidationOptions, Omit<ExecutionArgs, 'document'> {
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
 * }); // => { data: { greeting: 'Hello, Ada!' } }
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
 * }); // => { data: { viewer: { __typename: 'User', name: 'Ada' } } }
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
 * }); // => { data: { greeting: 'Hello' } }
 * stages; // => ['parse', 'validate', 'execute']
 * ```
 * @category Request Pipeline
 */
export declare function graphql(args: GraphQLArgs): Promise<ExecutionResult>;
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
 * }); // => { data: { greeting: 'Hello, Ada!' } }
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
 * }); // => { data: { greeting: 'Hello' } }
 * ```
 * @category Request Pipeline
 */
export declare function graphqlSync(args: GraphQLArgs): ExecutionResult;
