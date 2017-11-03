/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLError } from '../error';

/**
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 */
export function validateSchema(
  schema: GraphQLSchema,
): Array<GraphQLError> {
  if (schema.__valid === true) {
    return [];
  }
  const errors = [];

  // TODO actually validate the schema

  if (errors.length === 0) {
    schema.__valid = true;
  }
  return errors;
}

export function assertValidSchema(
  schema: GraphQLSchema,
): void {
  console.error(
    'The schema has to be validated by calling `validateSchema()` before ' +
      'usage.',
  );
}
