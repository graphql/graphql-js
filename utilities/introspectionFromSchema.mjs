/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import invariant from '../jsutils/invariant';
import { getIntrospectionQuery } from './introspectionQuery';
import { execute } from '../execution/execute';
import { parse } from '../language/parser';

/**
 * Build an IntrospectionQuery from a GraphQLSchema
 *
 * IntrospectionQuery is useful for utilities that care about type and field
 * relationships, but do not need to traverse through those relationships.
 *
 * This is the inverse of buildClientSchema. The primary use case is outside
 * of the server context, for instance when doing schema comparisons.
 */
export function introspectionFromSchema(schema, options) {
  var queryAST = parse(getIntrospectionQuery(options));
  var result = execute(schema, queryAST);
  !(!result.then && !result.errors && result.data) ? invariant(0) : void 0;
  return result.data;
}