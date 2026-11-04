import type { Maybe } from '../jsutils/Maybe';

import { GraphQLSchema } from '../type/schema';
import type { GraphQLCapabilityConfig } from '../type/service';
import { GraphQLService } from '../type/service';

export interface WithServiceCapabilitiesOptions {
  /** Optional description for the service */
  description?: Maybe<string>;
  /** Capabilities to include in the service */
  capabilities: ReadonlyArray<GraphQLCapabilityConfig>;
}

/**
 * Creates a new schema with a custom service containing the provided capabilities.
 *
 * This is useful when introspecting a remote GraphQL service's `__service` field
 * and wanting to represent those capabilities in the local schema representation.
 *
 * Example:
 *
 * ```ts
 * const remoteCapabilities = await fetchRemoteServiceCapabilities();
 * const schemaWithCapabilities = withServiceCapabilities(schema, {
 *   description: 'Remote service capabilities',
 *   capabilities: remoteCapabilities,
 * });
 * ```
 *
 * When `printSchema()` is called on the resulting schema, it will include
 * the service block with the provided capabilities.
 */
export function withServiceCapabilities(
  schema: GraphQLSchema,
  options: WithServiceCapabilitiesOptions,
): GraphQLSchema {
  const service = new GraphQLService({
    description: options.description,
    capabilities: options.capabilities,
  });

  const config = schema.toConfig();

  return new GraphQLSchema({
    ...config,
    service,
  });
}
