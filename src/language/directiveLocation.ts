/**
 * The set of allowed directive location values.
 */
export const DirectiveLocation = {
  /** Request Definitions */
  QUERY: 'QUERY' as const,
  MUTATION: 'MUTATION' as const,
  SUBSCRIPTION: 'SUBSCRIPTION' as const,
  FIELD: 'FIELD' as const,
  FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION' as const,
  FRAGMENT_SPREAD: 'FRAGMENT_SPREAD' as const,
  INLINE_FRAGMENT: 'INLINE_FRAGMENT' as const,
  VARIABLE_DEFINITION: 'VARIABLE_DEFINITION' as const,
  /** Type System Definitions */
  SCHEMA: 'SCHEMA' as const,
  SCALAR: 'SCALAR' as const,
  OBJECT: 'OBJECT' as const,
  FIELD_DEFINITION: 'FIELD_DEFINITION' as const,
  ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION' as const,
  INTERFACE: 'INTERFACE' as const,
  UNION: 'UNION' as const,
  ENUM: 'ENUM' as const,
  ENUM_VALUE: 'ENUM_VALUE' as const,
  INPUT_OBJECT: 'INPUT_OBJECT' as const,
  INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION' as const,
  FRAGMENT_VARIABLE_DEFINITION: 'FRAGMENT_VARIABLE_DEFINITION' as const,
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DirectiveLocation =
  (typeof DirectiveLocation)[keyof typeof DirectiveLocation];
