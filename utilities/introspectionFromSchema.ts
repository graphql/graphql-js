import { invariant } from '../jsutils/invariant.ts';
import { parse } from '../language/parser.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import { executeSync } from '../execution/execute.ts';
import type {
  IntrospectionOptions,
  IntrospectionQuery,
} from './getIntrospectionQuery.ts';
import { getIntrospectionQuery } from './getIntrospectionQuery.ts';
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
    ...options,
  };
  const document = parse(getIntrospectionQuery(optionsWithDefaults));
  const result = executeSync({ schema, document });
  (result.errors == null && result.data != null) || invariant(false);
  return result.data as any;
}
