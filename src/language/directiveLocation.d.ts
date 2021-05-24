/**
 * The set of allowed directive location values.
 */
export const DirectiveLocation: Readonly<{
  /** Request Definitions */
  readonly QUERY: 'QUERY';
  readonly MUTATION: 'MUTATION';
  readonly SUBSCRIPTION: 'SUBSCRIPTION';
  readonly FIELD: 'FIELD';
  readonly FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION';
  readonly FRAGMENT_SPREAD: 'FRAGMENT_SPREAD';
  readonly INLINE_FRAGMENT: 'INLINE_FRAGMENT';
  readonly VARIABLE_DEFINITION: 'VARIABLE_DEFINITION';
  /** Type System Definitions */
  readonly SCHEMA: 'SCHEMA';
  readonly SCALAR: 'SCALAR';
  readonly OBJECT: 'OBJECT';
  readonly FIELD_DEFINITION: 'FIELD_DEFINITION';
  readonly ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION';
  readonly INTERFACE: 'INTERFACE';
  readonly UNION: 'UNION';
  readonly ENUM: 'ENUM';
  readonly ENUM_VALUE: 'ENUM_VALUE';
  readonly INPUT_OBJECT: 'INPUT_OBJECT';
  readonly INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION';
}>;
/**
 * The enum type representing the directive location values.
 */
export type DirectiveLocationEnum =
  typeof DirectiveLocation[keyof typeof DirectiveLocation];
