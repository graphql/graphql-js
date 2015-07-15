/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { Source } from './language/source';
import { parse } from './language/parser';
import { validateDocument } from './validator';
import { execute } from './executor/executor';
import { formatError } from './error';
import type { GraphQLFormattedError } from './error/formatError';
import type { GraphQLSchema } from './type/schema';


/**
 * This is the primary entry point function for fulfilling GraphQL operations
 * by parsing, validating, and executing a GraphQL document along side a
 * GraphQL schema.
 *
 * More sophisticated GraphQL servers, such as those which persist queries,
 * may wish to separate the validation and execution phases to a static time
 * tooling step, and a server runtime step.
 */
export function graphql(
  schema: GraphQLSchema,
  requestString: string,
  rootObject?: ?any,
  variableValues?: ?{[key: string]: string},
  operationName?: ?string
): Promise<GraphQLResult> {
  return new Promise(resolve => {
    var source = new Source(requestString || '', 'GraphQL request');
    var ast = parse(source);
    var validationErrors = validateDocument(schema, ast);
    if (validationErrors.length > 0) {
      resolve({
        errors: validationErrors.map(formatError)
      });
    } else {
      resolve(
        execute(
          schema,
          rootObject,
          ast,
          operationName,
          variableValues
        ).then(result => {
          if (result.errors) {
            return {
              data: result.data,
              errors: result.errors.map(formatError)
            };
          }
          return result;
        })
      );
    }
  }).catch(error => {
    return { errors: [ formatError(error) ] };
  });
}

/**
 * The result of a GraphQL parse, validation and execution.
 *
 * `data` is the result of a successful execution of the query.
 * `errors` is included when any errors occurred as a non-empty array.
 */
type GraphQLResult = {
  data?: ?Object;
  errors?: Array<GraphQLFormattedError>;
}
