/** @category Kinds */

/** The set of allowed directive location values. */
export const DirectiveLocation = {
  // Request Definitions
  /** Directive location for query operations. */
  QUERY: 'QUERY' as const,
  /** Directive location for mutation operations. */
  MUTATION: 'MUTATION' as const,
  /** Directive location for subscription operations. */
  SUBSCRIPTION: 'SUBSCRIPTION' as const,
  /** Directive location for field selections. */
  FIELD: 'FIELD' as const,
  /** Directive location for fragment definitions. */
  FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION' as const,
  /** Directive location for fragment spreads. */
  FRAGMENT_SPREAD: 'FRAGMENT_SPREAD' as const,
  /** Directive location for inline fragments. */
  INLINE_FRAGMENT: 'INLINE_FRAGMENT' as const,
  /** Directive location for variable definitions. */
  VARIABLE_DEFINITION: 'VARIABLE_DEFINITION' as const,
  /** Directive location for fragment variable definitions. */
  FRAGMENT_VARIABLE_DEFINITION: 'FRAGMENT_VARIABLE_DEFINITION' as const,
  // Type System Definitions
  /** Directive location for schema definitions and extensions. */
  SCHEMA: 'SCHEMA' as const,
  /** Directive location for scalar type definitions and extensions. */
  SCALAR: 'SCALAR' as const,
  /** Directive location for object type definitions and extensions. */
  OBJECT: 'OBJECT' as const,
  /** Directive location for field definitions. */
  FIELD_DEFINITION: 'FIELD_DEFINITION' as const,
  /** Directive location for argument definitions. */
  ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION' as const,
  /** Directive location for interface type definitions and extensions. */
  INTERFACE: 'INTERFACE' as const,
  /** Directive location for union type definitions and extensions. */
  UNION: 'UNION' as const,
  /** Directive location for enum type definitions and extensions. */
  ENUM: 'ENUM' as const,
  /** Directive location for enum value definitions. */
  ENUM_VALUE: 'ENUM_VALUE' as const,
  /** Directive location for input object type definitions and extensions. */
  INPUT_OBJECT: 'INPUT_OBJECT' as const,
  /** Directive location for input object field definitions. */
  INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION' as const,
  /** Directive location for directive definitions and extensions. */
  DIRECTIVE_DEFINITION: 'DIRECTIVE_DEFINITION' as const,
} as const;

/** The set of allowed directive location values. */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DirectiveLocation =
  (typeof DirectiveLocation)[keyof typeof DirectiveLocation];
