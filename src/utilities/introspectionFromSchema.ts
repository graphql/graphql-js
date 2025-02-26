import { invariant } from '../jsutils/invariant.js';

import { parse } from '../language/parser.js';

import type { GraphQLSchema } from '../type/schema.js';

import { executeSync } from '../execution/execute.js';

import type {
  IntrospectionOptions,
  IntrospectionQuery,
} from './getIntrospectionQuery.js';
import { getIntrospectionQuery } from './getIntrospectionQuery.js';

/**
 * Build an IntrospectionQuery from a GraphQLSchema
 *
 * IntrospectionQuery is useful for utilities that care about type and field
 * relationships, but do not need to traverse through those relationships.
 *
 * This is the inverse of buildClientSchema. The primary use case is outside
 * of the server context, for instance when doing schema comparisons.
 */
export function introspectionFromSchema(
  schema: GraphQLSchema,
  options?: IntrospectionOptions,
): IntrospectionQuery {
  const optionsWithDefaults = {
    specifiedByUrl: true,
    directiveIsRepeatable: true,
    schemaDescription: true,
    inputValueDeprecation: true,
    oneOf: true,
    ...options,
  };

  const document = parse(getIntrospectionQuery(optionsWithDefaults));
  const result = executeSync({ schema, document });
  invariant(result.errors == null && result.data != null);
  return result.data as any;
}
