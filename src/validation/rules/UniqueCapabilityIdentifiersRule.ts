import { GraphQLError } from '../../error/GraphQLError';

import type {
  ServiceCapabilityNode,
  StringValueNode,
} from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique capability identifiers
 *
 * A GraphQL document is only valid if all service capabilities have unique identifiers.
 */
export function UniqueCapabilityIdentifiersRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingCapabilities = new Set<string>();

  // Collect existing capabilities from the schema
  const service = schema?.getService();
  if (service) {
    for (const capability of service.capabilities) {
      existingCapabilities.add(capability.identifier);
    }
  }

  const knownCapabilityIdentifiers = new Map<string, Array<StringValueNode>>();

  function checkCapabilityUniqueness(
    capabilities: ReadonlyArray<ServiceCapabilityNode> | undefined,
  ): void {
    if (!capabilities) {
      return;
    }

    for (const capability of capabilities) {
      const identifier = capability.identifier.value;

      if (existingCapabilities.has(identifier)) {
        context.reportError(
          new GraphQLError(
            `Capability "${identifier}" already exists in the schema. It cannot be redefined.`,
            { nodes: capability.identifier },
          ),
        );
        continue;
      }

      const knownNodes = knownCapabilityIdentifiers.get(identifier);
      if (knownNodes) {
        context.reportError(
          new GraphQLError(
            `There can be only one capability named "${identifier}".`,
            { nodes: [...knownNodes, capability.identifier] },
          ),
        );
      } else {
        knownCapabilityIdentifiers.set(identifier, [capability.identifier]);
      }
    }
  }

  return {
    ServiceDefinition(node) {
      checkCapabilityUniqueness(node.capabilities);
      return false;
    },
    ServiceExtension(node) {
      checkCapabilityUniqueness(node.capabilities);
      return false;
    },
  };
}
