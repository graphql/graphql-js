/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../utils/invariant';
import { formatError } from '../error';
import type { GraphQLError, GraphQLFormattedError } from '../error/index';
import { GraphQLSchema } from './schema';
import { allRules } from './allRules';

/**
 * The result of schema validation. `isValid` is true if validation is
 * successful. `errors` is null if no errors occurred, and is a non-empty array
 * if any validation errors occurred.
 */
type ValidationResult = {
  isValid: boolean;
  errors: ?Array<GraphQLFormattedError>;
}

/**
 * Checks an input type system for conformance to the "Type System"
 * section of the spec.
 */
export function validateSchema(
  schema: GraphQLSchema,
  argRules: ?Array<(context: ValidationContext) => ?Array<GraphQLError>>
): ValidationResult {
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

  var isValid = errors.length === 0;
  return { isValid, errors: isValid ? null : errors.map(formatError) };
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
