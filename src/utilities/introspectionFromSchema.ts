/** @category Introspection */

import { invariant } from '../jsutils/invariant';

import { parse } from '../language/parser';

import type { GraphQLSchema } from '../type/schema';

import { executeSync } from '../execution/execute';

import type {
  IntrospectionOptions,
  IntrospectionQuery,
} from './getIntrospectionQuery';
import { getIntrospectionQuery } from './getIntrospectionQuery';

/**
 * Build an IntrospectionQuery from a GraphQLSchema
 *
 * IntrospectionQuery is useful for utilities that care about type and field
 * relationships, but do not need to traverse through those relationships.
 *
 * This is the inverse of buildClientSchema. The primary use case is outside
 * of the server context, for instance when doing schema comparisons.
 * @param schema - GraphQL schema to use.
 * @param options - Optional configuration for this operation.
 * @returns Introspection result data for the schema.
 * @example
 * ```ts
 * // Include schema metadata using the default introspection options.
 * import { buildSchema, introspectionFromSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   scalar Url @specifiedBy(url: "https://url.spec.whatwg.org/")
 *
 *   type Query {
 *     homepage: Url
 *   }
 * `);
 *
 * const introspection = introspectionFromSchema(schema);
 * const urlType = introspection.__schema.types.find((type) => type.name === 'Url');
 *
 * urlType.specifiedByURL; // => 'https://url.spec.whatwg.org/'
 * ```
 * @example
 * ```ts
 * // This variant disables optional introspection metadata.
 * import { buildSchema, introspectionFromSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   scalar Url @specifiedBy(url: "https://url.spec.whatwg.org/")
 *
 *   type Query {
 *     homepage: Url
 *   }
 * `);
 *
 * const introspection = introspectionFromSchema(schema, {
 *   descriptions: false,
 *   specifiedByUrl: false,
 *   directiveIsRepeatable: false,
 *   schemaDescription: false,
 *   inputValueDeprecation: false,
 *   experimentalDirectiveDeprecation: false,
 *   oneOf: false,
 * });
 * const urlType = introspection.__schema.types.find((type) => type.name === 'Url');
 * const deprecatedDirective = introspection.__schema.directives.find(
 *   (directive) => directive.name === 'deprecated',
 * );
 *
 * urlType.specifiedByURL; // => undefined
 * urlType.description; // => undefined
 * introspection.__schema.description; // => undefined
 * deprecatedDirective.isRepeatable; // => undefined
 * ```
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
    experimentalDirectiveDeprecation: true,
    oneOf: true,
    ...options,
  };

  const document = parse(getIntrospectionQuery(optionsWithDefaults));
  const result = executeSync({ schema, document });
  invariant(!result.errors && result.data);
  return result.data as any;
}
