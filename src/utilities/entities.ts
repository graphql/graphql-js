import { version } from '../version';

/**
 * A symbol containing the version of the GraphQL.js library
 */
export const GRAPHQL_VERSION_SYMBOL = Symbol.for(version);

/**
 * Applies the GraphQL version symbol to an object.
 * Used as a base class for GraphQL Entity Implementations
 */
export interface GraphQLEntity {
  [GRAPHQL_VERSION_SYMBOL]: undefined;
}

/**
 * Applies the GraphQL version symbol to an object.
 * Used as a base class for GraphQL Entity Implementations
 *
 * @internal
 */
export class GraphQLEntityImpl implements GraphQLEntity {
  readonly [GRAPHQL_VERSION_SYMBOL] = undefined;
}

export enum GraphQLEntityKind {
  SCALAR_TYPE = 'ScalarType',
  OBJECT_TYPE = 'ObjectType',
  INTERFACE_TYPE = 'InterfaceType',
  UNION_TYPE = 'UnionType',
  ENUM_TYPE = 'EnumType',
  INPUT_OBJECT_TYPE = 'InputObjectType',
  LIST_TYPE = 'ListType',
  NON_NULL_TYPE = 'NonNullType',
  DIRECTIVE = 'Directive',
  SCHEMA = 'Schema',
  SOURCE = 'Source',
}

export const GRAPHQL_SCALAR_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.SCALAR_TYPE}`,
);
export const GRAPHQL_OBJECT_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.OBJECT_TYPE}`,
);
export const GRAPHQL_INTERFACE_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.INTERFACE_TYPE}`,
);
export const GRAPHQL_UNION_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.UNION_TYPE}`,
);
export const GRAPHQL_ENUM_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.ENUM_TYPE}`,
);
export const GRAPHQL_INPUT_OBJECT_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.INPUT_OBJECT_TYPE}`,
);
export const GRAPHQL_LIST_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.LIST_TYPE}`,
);
export const GRAPHQL_NON_NULL_TYPE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.NON_NULL_TYPE}`,
);
export const GRAPHQL_DIRECTIVE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.DIRECTIVE}`,
);
export const GRAPHQL_SCHEMA_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.SCHEMA}`,
);
export const GRAPHQL_SOURCE_SYMBOL = Symbol.for(
  `graphql.${GraphQLEntityKind.SOURCE}`,
);

export function isEntity(value: object, entity: GraphQLEntityKind): boolean {
  const symbol = Symbol.for(`graphql.${entity}`);
  return symbol in value;
}

export function ofVersion(value: object): boolean {
  return GRAPHQL_VERSION_SYMBOL in value;
}
