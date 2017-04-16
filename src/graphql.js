/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { GraphQLSchema } from './type/schema';
import type { ExecutionResult } from './execution/execute';

import { graphql as graphqlOri } from './graphql-origin';
import { graphql as graphqlRx } from './graphql-rx';
import { graphql as graphqlMost } from './graphql-most';

// Use `RUN_MODE` to run tests. For example:
//
//     RUN_MODE=Rx yarn run testonly
const mode = process.env.RUN_MODE;
if (process.env.RUN_MODE === 'Rx') {
  console.log('============');
  console.log('RUN_MODE: Rx');
  console.log('============');
} else if (process.env.RUN_MODE === 'Most') {
  console.log('==============');
  console.log('RUN_MODE: Most');
  console.log('==============');
}

export function graphql(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): Promise<ExecutionResult> {
  if (mode === 'Rx') {
    return graphqlRx(schema, requestString, rootValue,
      contextValue, variableValues, operationName).toPromise();
  }
  if (mode === 'Most') {
    return graphqlMost(schema, requestString, rootValue,
      contextValue, variableValues, operationName)
        .take(1)
        .reduce((_, x) => x, undefined);
  }
  return graphqlOri(schema, requestString, rootValue,
    contextValue, variableValues, operationName);
}

