import { devAssert } from './jsutils/devAssert';
import { isPromise } from './jsutils/isPromise';
import type { Maybe } from './jsutils/Maybe';
import type { PromiseOrValue } from './jsutils/PromiseOrValue';

import { parse } from './language/parser';
import type { Source } from './language/source';

import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from './type/definition';
import type { GraphQLSchema } from './type/schema';
import { validateSchema } from './type/validate';

import { validate } from './validation/validate';

import type { ExecutionResult } from './execution/execute';
import { execute } from './execution/execute';

/**
 * Describes the input object accepted by `graphql` and `graphqlSync`.
 *
 * These arguments describe the full parse, validate, and execute lifecycle for
 * a GraphQL request.
 * @category Request Pipeline
 */
export interface GraphQLArgs {
  /** The GraphQL type system to use when validating and executing a query. */
  schema: GraphQLSchema;
  /**
   * A GraphQL language-formatted string or source object representing the
   * requested operation.
   */
  source: string | Source;
  /**
   * The value provided as the first argument to resolver functions on the top
   * level type, such as the query object type.
   */
  rootValue?: unknown;
  /**
   * Application context value passed to every resolver.
   *
   * Use this for shared request data such as the currently logged in user and
   * connections to databases or other services.
   */
  contextValue?: unknown;
  /** A mapping of variable name to runtime value for variables defined by the operation. */
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  /**
   * The operation to execute when the source contains multiple possible
   * operations. This can be omitted when the source contains only one operation.
   */
  operationName?: Maybe<string>;
  /**
   * A resolver function to use when one is not provided by the schema.
   *
   * If not provided, the default field resolver is used, which looks for a value
   * or method on the source value with the field's name.
   */
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  /**
   * A type resolver function to use when none is provided by the schema.
   *
   * If not provided, the default type resolver is used, which looks for a
   * `__typename` field or alternatively calls the `isTypeOf` method.
   */
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
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
  // Temporary for v15 to v16 migration. Remove in v17
  devAssert(
    arguments.length < 2,
    'graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead.',
  );

  const {
    schema,
    source,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;

  // Validate Schema
  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    return { errors: schemaValidationErrors };
  }

  // Parse
  let document;
  try {
    document = parse(source);
  } catch (syntaxError) {
    return { errors: [syntaxError] };
  }

  // Validate
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return { errors: validationErrors };
  }

  // Execute
  return execute({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
