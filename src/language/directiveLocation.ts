/** @category Kinds */

/** The set of allowed directive location values. */
enum DirectiveLocation {
  /** Directive location for query operations. */
  QUERY = 'QUERY',
  /** Directive location for mutation operations. */
  MUTATION = 'MUTATION',
  /** Directive location for subscription operations. */
  SUBSCRIPTION = 'SUBSCRIPTION',
  /** Directive location for field selections. */
  FIELD = 'FIELD',
  /** Directive location for fragment definitions. */
  FRAGMENT_DEFINITION = 'FRAGMENT_DEFINITION',
  /** Directive location for fragment spreads. */
  FRAGMENT_SPREAD = 'FRAGMENT_SPREAD',
  /** Directive location for inline fragments. */
  INLINE_FRAGMENT = 'INLINE_FRAGMENT',
  /** Directive location for variable definitions. */
  VARIABLE_DEFINITION = 'VARIABLE_DEFINITION',
  /** Directive location for schema definitions and extensions. */
  SCHEMA = 'SCHEMA',
  /** Directive location for scalar type definitions and extensions. */
  SCALAR = 'SCALAR',
  /** Directive location for object type definitions and extensions. */
  OBJECT = 'OBJECT',
  /** Directive location for field definitions. */
  FIELD_DEFINITION = 'FIELD_DEFINITION',
  /** Directive location for argument definitions. */
  ARGUMENT_DEFINITION = 'ARGUMENT_DEFINITION',
  /** Directive location for interface type definitions and extensions. */
  INTERFACE = 'INTERFACE',
  /** Directive location for union type definitions and extensions. */
  UNION = 'UNION',
  /** Directive location for enum type definitions and extensions. */
  ENUM = 'ENUM',
  /** Directive location for enum value definitions. */
  ENUM_VALUE = 'ENUM_VALUE',
  /** Directive location for input object type definitions and extensions. */
  INPUT_OBJECT = 'INPUT_OBJECT',
  /** Directive location for input object field definitions. */
  INPUT_FIELD_DEFINITION = 'INPUT_FIELD_DEFINITION',
  /** Directive location for directive definitions and extensions. */
  DIRECTIVE_DEFINITION = 'DIRECTIVE_DEFINITION',
}
export { DirectiveLocation };

/**
 * Legacy alias for the enum type representing directive location values. This
 * is retained for backwards compatibility; use `DirectiveLocation` instead
 * because DirectiveLocationEnum will be removed in v17.
 * @deprecated Please use `DirectiveLocation`. Will be removed in v17.
 */
export type DirectiveLocationEnum = typeof DirectiveLocation;
