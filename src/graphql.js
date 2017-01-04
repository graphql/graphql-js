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
import { validate } from './validation/validate';
import type { GraphQLSchema } from './type/schema';
import type { ExecutionResult } from './execution/execute';

import { execute } from './execution/execute-origin';
import { executeRx } from './execution/execute-rx';
import { Observable } from 'rxjs/Rx';


export function graphql(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): Promise<ExecutionResult> {
  const mode = process.env.RUN_MODE;
  if (mode === 'Rx') {
    return graphqlRx(schema, requestString, rootValue,
      contextValue, variableValues, operationName).toPromise();
  }
  return graphqlOri(schema, requestString, rootValue,
    contextValue, variableValues, operationName);
}

/**
 * This is the primary entry point function for fulfilling GraphQL operations
 * by parsing, validating, and executing a GraphQL document along side a
 * GraphQL schema.
 *
 * More sophisticated GraphQL servers, such as those which persist queries,
 * may wish to separate the validation and execution phases to a static time
 * tooling step, and a server runtime step.
 *
 * schema:
 *    The GraphQL type system to use when validating and executing a query.
 * requestString:
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
 */
export function graphqlOri(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): Promise<ExecutionResult> {
  return new Promise(resolve => {
    const source = new Source(requestString || '', 'GraphQL request');
    const documentAST = parse(source);
    const validationErrors = validate(schema, documentAST);
    if (validationErrors.length > 0) {
      resolve({ errors: validationErrors });
    } else {
      resolve(
        execute(
          schema,
          documentAST,
          rootValue,
          contextValue,
          variableValues,
          operationName
        )
      );
    }
  }).then(undefined, error => {
    return { errors: [ error ] };
  });
}

export function graphqlRx(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): rxjs$Observable<ExecutionResult> {
  return Observable.defer(() => {
    try {
      const source = new Source(requestString || '', 'GraphQL request');
      const documentAST = parse(source);
      const validationErrors = validate(schema, documentAST);
      if (validationErrors.length > 0) {
        return Observable.of({ errors: validationErrors });
      }

      return executeRx(
        schema,
        documentAST,
        rootValue,
        contextValue,
        variableValues,
        operationName
      ).catch(error => {
        return Observable.of({ errors: [ error ] });
      });
    } catch (error) {
      return Observable.of({ errors: [ error ] });
    }
  });
}
