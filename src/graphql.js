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
import { execute } from './execution/execute';
import type { GraphQLSchema } from './type/schema';
// import type { ExecutionResult } from './execution/execute';

type onNextBlock = (next: mixed) => void;
type onErrorBlock = (error: Error, isContinued: ?boolean) => void;
type onEndBlock = (info: ?mixed) => void;

type UniversalCallbackFunction =
  (onNext: onNextBlock, onError: onErrorBlock, onEnd: onEndBlock) => void;

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
export function graphql$UCCF(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): UniversalCallbackFunction {

  return function (onNext, onError) {
    const source = new Source(requestString || '', 'GraphQL request');
    const documentAST = parse(source);
    const validationErrors = validate(schema, documentAST);
    if (validationErrors.length > 0) {
      onNext({ errors: validationErrors });
      return;
    }
    try {
      // !!!:
      // Currently, although graphql$UCCF adopts UCC design, the graphql$UCCF is
      // not reactive due to the upstream (execute) isn't reactive (as Promise).
      // We'll refactor `execute()` later.
      execute(
        schema,
        documentAST,
        rootValue,
        contextValue,
        variableValues,
        operationName
      ).then(data => {
        onNext(data);
      }, error => {
        onError(error);
      });
    } catch (error) {
      onNext({ errors: [ error ] });
    }
  };
}

/**
 * Turn a UCC function into a Promise.
 *
 * @see https://gist.github.com/xareelee/e85c8b2134ff1805ab1ab2f1c8a037ce
 */
function promisify(uccf) {
  return function (...args: any[]) {
    return new Promise((resolve, reject) => {
      uccf(...args)(
        x => resolve(x),
        err => reject(err),
        end => resolve(end)
      );
    });
  };
}

/**
 * We export `graphql` as a Promise from `graphql$UCCF`.
 *
 * @see graphql$UCCF
 */
export const graphql = promisify(graphql$UCCF);
