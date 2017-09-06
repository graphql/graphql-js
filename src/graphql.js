/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { parse } from './language/parser';
import { validate } from './validation/validate';
import { execute } from './execution/execute';
import type { Source } from './language/source';
import type { GraphQLFieldResolver } from './type/definition';
import type { GraphQLSchema } from './type/schema';
import type { ExecutionResult } from './execution/execute';

/**
 * This is the primary entry point function for fulfilling GraphQL operations
 * by parsing, validating, and executing a GraphQL document along side a
 * GraphQL schema.
 *
 * More sophisticated GraphQL servers, such as those which persist queries,
 * may wish to separate the validation and execution phases to a static time
 * tooling step, and a server runtime step.
 *
 * Accepts either an object with named arguments, or individual arguments:
 *
 * schema:
 *    The GraphQL type system to use when validating and executing a query.
 * source:
 *    A GraphQL language formatted string representing the requested operation.
 * rootValue:
 *    The value provided as the first argument to resolver functions on the top
 *    level type (e.g. the query object type).
 * variableValues:
 *    A mapping of variable name to runtime value to use for all variables
 *    defined in the requestString.
 * operationName:
 *    The name of the operation to use if requestString contains multiple
 *    possible operations. Can be omitted if requestString contains only
 *    one operation.
 * fieldResolver:
 *    A resolver function to use when one is not provided by the schema.
 *    If not provided, the default field resolver is used (which looks for a
 *    value or method on the source value with the field's name).
 */
declare function graphql({|
  schema: GraphQLSchema,
  source: string | Source,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>
|}, ..._: []): Promise<ExecutionResult>;
/* eslint-disable no-redeclare */
declare function graphql(
  schema: GraphQLSchema,
  source: Source | string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>
): Promise<ExecutionResult>;
export function graphql(
  argsOrSchema,
  source,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver
) {
  // Extract arguments from object args if provided.
  const args = arguments.length === 1 ? argsOrSchema : undefined;
  const schema = args ? args.schema : argsOrSchema;
  return args ?
    graphqlImpl(
      schema,
      args.source,
      args.rootValue,
      args.contextValue,
      args.variableValues,
      args.operationName,
      args.fieldResolver
    ) :
    graphqlImpl(
      schema,
      source,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver
    );
}

function graphqlImpl(
  schema,
  source,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver
) {
  return new Promise(resolve => {
    // Parse
    let document;
    try {
      document = parse(source);
    } catch (syntaxError) {
      return resolve({ errors: [ syntaxError ]});
    }

    // Validate
    const validationErrors = validate(schema, document);
    if (validationErrors.length > 0) {
      return resolve({ errors: validationErrors });
    }

    // Execute
    resolve(
      execute(
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver
      )
    );
  });
}
