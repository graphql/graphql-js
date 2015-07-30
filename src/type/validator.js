/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import type { GraphQLError } from '../error/GraphQLError';
import { GraphQLSchema } from './schema';
import { allRules } from './allRules';

/**
 * Checks an input type schema for conformance to the "Type System"
 * section of the spec, returning an array of errors describing any encountered
 * issues rendering the schema invalid.
 *
 * If the schema is valid, an empty array is returned.
 */
export function validateSchema(
  schema: GraphQLSchema,
  argRules: ?Array<(context: ValidationContext) => ?Array<GraphQLError>>
): Array<GraphQLError> {
  invariant(schema, 'Must provide schema');
  var context = new ValidationContext(schema);
  var errors = [];
  var rules = argRules || allRules;

  for (var ii = 0; ii < rules.length; ++ii) {
    var newErrors = rules[ii](context);
    if (newErrors) {
      errors.push.apply(errors, newErrors);
    }
  }

  return errors;
}

export class ValidationContext {
  _schema: GraphQLSchema;

  constructor(schema: GraphQLSchema) {
    this._schema = schema;
  }

  getSchema(): GraphQLSchema {
    return this._schema;
  }
}
