/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { GraphQLSchema } from './schema';
import type { GraphQLError } from '../error/GraphQLError';

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
export function validateSchema(
  schema: GraphQLSchema,
): $ReadOnlyArray<GraphQLError> {
  // First check to ensure the provided value is in fact a GraphQLSchema.
  if (!(schema instanceof GraphQLSchema)) {
    if (!schema) {
      throw new Error('Must provide schema.');
    }

    // Provide as descriptive an error as possible when attempting to use a
    // schema cross-realm.
    if (Object.getPrototypeOf(schema).constructor.name === 'GraphQLSchema') {
      throw new Error(`Cannot use a GraphQLSchema from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`);
    } else {
      throw new Error(
        'Schema must be an instance of GraphQLSchema. ' +
          `Received: ${String(schema)}`,
      );
    }
  }

  // If this Schema has already been validated, return the previous results.
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }

  // Validate the schema, producing a list of errors.
  const errors = [];

  // TODO actually validate the schema

  // Persist the results of validation before returning to ensure validation
  // does not run multiple times for this schema.
  schema.__validationErrors = errors;
  return errors;
}

/**
 * Utility function which asserts a schema is valid by throwing an error if
 * it is invalid.
 */
export function assertValidSchema(schema: GraphQLSchema): void {
  const errors = validateSchema(schema);
  if (errors.length !== 0) {
    throw new Error(errors.map(error => error.message).join('\n\n'));
  }
}
