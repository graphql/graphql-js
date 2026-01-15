import { devAssert } from '../jsutils/devAssert';
import { inspect } from '../jsutils/inspect';
import { instanceOf } from '../jsutils/instanceOf';
import type { Maybe } from '../jsutils/Maybe';
import { toObjMap } from '../jsutils/toObjMap';

import type {
  ServiceCapabilityNode,
  ServiceDefinitionNode,
  ServiceExtensionNode,
} from '../language/ast';

/**
 * Test if the given value is a GraphQL service.
 */
export function isService(service: unknown): service is GraphQLService {
  return instanceOf(service, GraphQLService);
}

export function assertService(service: unknown): GraphQLService {
  if (!isService(service)) {
    throw new Error(
      `Expected ${inspect(service)} to be a GraphQL service definition.`,
    );
  }
  return service;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLServiceExtensions {
  [attributeName: string]: unknown;
}

/**
 * A service capability describes a feature supported by the GraphQL service
 * but not directly expressible via the type system.
 */
export interface GraphQLCapability {
  /** The capability identifier (a qualified name like "graphql.operationDescriptions") */
  identifier: string;
  /** Optional description of the capability */
  description: Maybe<string>;
  /** Optional string value for the capability */
  value: Maybe<string>;
  /** The original AST node */
  astNode: Maybe<ServiceCapabilityNode>;
}

export interface GraphQLCapabilityConfig {
  /** The capability identifier (a qualified name like "graphql.operationDescriptions") */
  identifier: string;
  /** Optional description of the capability */
  description?: Maybe<string>;
  /** Optional string value for the capability */
  value?: Maybe<string>;
  /** The original AST node */
  astNode?: Maybe<ServiceCapabilityNode>;
}

/**
 * GraphQL Service Definition
 *
 * A GraphQL service is defined in terms of the capabilities that it offers
 * which are external to the schema.
 */
export class GraphQLService {
  description: Maybe<string>;
  capabilities: ReadonlyArray<GraphQLCapability>;
  extensions: Readonly<GraphQLServiceExtensions>;
  astNode: Maybe<ServiceDefinitionNode>;
  extensionASTNodes: ReadonlyArray<ServiceExtensionNode>;

  constructor(config: Readonly<GraphQLServiceConfig>) {
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    const capabilities = config.capabilities ?? [];
    devAssert(
      Array.isArray(capabilities),
      'Service capabilities must be an Array.',
    );

    this.capabilities = capabilities.map((cap) => ({
      identifier: cap.identifier,
      description: cap.description ?? null,
      value: cap.value ?? null,
      astNode: cap.astNode ?? null,
    }));
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLService';
  }

  /**
   * Get a capability by its identifier.
   */
  getCapability(identifier: string): GraphQLCapability | undefined {
    return this.capabilities.find((cap) => cap.identifier === identifier);
  }

  /**
   * Check if the service has a capability with the given identifier.
   */
  hasCapability(identifier: string): boolean {
    return this.capabilities.some((cap) => cap.identifier === identifier);
  }

  toConfig(): GraphQLServiceNormalizedConfig {
    return {
      description: this.description,
      capabilities: this.capabilities.map((cap) => ({
        identifier: cap.identifier,
        description: cap.description,
        value: cap.value,
        astNode: cap.astNode,
      })),
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  toString(): string {
    return 'service';
  }

  toJSON(): string {
    return this.toString();
  }
}

export interface GraphQLServiceConfig {
  description?: Maybe<string>;
  capabilities?: Maybe<ReadonlyArray<GraphQLCapabilityConfig>>;
  extensions?: Maybe<Readonly<GraphQLServiceExtensions>>;
  astNode?: Maybe<ServiceDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<ServiceExtensionNode>>;
}

interface GraphQLServiceNormalizedConfig extends GraphQLServiceConfig {
  capabilities: ReadonlyArray<GraphQLCapability>;
  extensions: Readonly<GraphQLServiceExtensions>;
  extensionASTNodes: ReadonlyArray<ServiceExtensionNode>;
}
