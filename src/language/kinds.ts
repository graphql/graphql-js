/** @category Kinds */

/** The set of allowed kind values for AST nodes. */
enum Kind {
  /** AST kind for name nodes. */
  NAME = 'Name',

  /** AST kind for document nodes. */
  DOCUMENT = 'Document',
  /** AST kind for operation definition nodes. */
  OPERATION_DEFINITION = 'OperationDefinition',
  /** AST kind for variable definition nodes. */
  VARIABLE_DEFINITION = 'VariableDefinition',
  /** AST kind for selection set nodes. */
  SELECTION_SET = 'SelectionSet',
  /** AST kind for field selection nodes. */
  FIELD = 'Field',
  /** AST kind for argument nodes. */
  ARGUMENT = 'Argument',

  /** AST kind for fragment spread nodes. */
  FRAGMENT_SPREAD = 'FragmentSpread',
  /** AST kind for inline fragment nodes. */
  INLINE_FRAGMENT = 'InlineFragment',
  /** AST kind for fragment definition nodes. */
  FRAGMENT_DEFINITION = 'FragmentDefinition',

  /** AST kind for variable reference nodes. */
  VARIABLE = 'Variable',
  /** AST kind for integer value nodes. */
  INT = 'IntValue',
  /** AST kind for floating-point value nodes. */
  FLOAT = 'FloatValue',
  /** AST kind for string value nodes. */
  STRING = 'StringValue',
  /** AST kind for boolean value nodes. */
  BOOLEAN = 'BooleanValue',
  /** AST kind for null value nodes. */
  NULL = 'NullValue',
  /** AST kind for enum value nodes. */
  ENUM = 'EnumValue',
  /** AST kind for list value nodes. */
  LIST = 'ListValue',
  /** AST kind for object value nodes. */
  OBJECT = 'ObjectValue',
  /** AST kind for object field nodes. */
  OBJECT_FIELD = 'ObjectField',

  /** AST kind for directive nodes. */
  DIRECTIVE = 'Directive',

  /** AST kind for named type reference nodes. */
  NAMED_TYPE = 'NamedType',
  /** AST kind for list type reference nodes. */
  LIST_TYPE = 'ListType',
  /** AST kind for non-null type reference nodes. */
  NON_NULL_TYPE = 'NonNullType',

  /** AST kind for schema definition nodes. */
  SCHEMA_DEFINITION = 'SchemaDefinition',
  /** AST kind for operation type definition nodes. */
  OPERATION_TYPE_DEFINITION = 'OperationTypeDefinition',

  /** AST kind for scalar type definition nodes. */
  SCALAR_TYPE_DEFINITION = 'ScalarTypeDefinition',
  /** AST kind for object type definition nodes. */
  OBJECT_TYPE_DEFINITION = 'ObjectTypeDefinition',
  /** AST kind for field definition nodes. */
  FIELD_DEFINITION = 'FieldDefinition',
  /** AST kind for input value definition nodes. */
  INPUT_VALUE_DEFINITION = 'InputValueDefinition',
  /** AST kind for interface type definition nodes. */
  INTERFACE_TYPE_DEFINITION = 'InterfaceTypeDefinition',
  /** AST kind for union type definition nodes. */
  UNION_TYPE_DEFINITION = 'UnionTypeDefinition',
  /** AST kind for enum type definition nodes. */
  ENUM_TYPE_DEFINITION = 'EnumTypeDefinition',
  /** AST kind for enum value definition nodes. */
  ENUM_VALUE_DEFINITION = 'EnumValueDefinition',
  /** AST kind for input object type definition nodes. */
  INPUT_OBJECT_TYPE_DEFINITION = 'InputObjectTypeDefinition',

  /** AST kind for directive definition nodes. */
  DIRECTIVE_DEFINITION = 'DirectiveDefinition',

  /** AST kind for schema extension nodes. */
  SCHEMA_EXTENSION = 'SchemaExtension',
  /** AST kind for directive extension nodes. */
  DIRECTIVE_EXTENSION = 'DirectiveExtension',

  /** AST kind for scalar type extension nodes. */
  SCALAR_TYPE_EXTENSION = 'ScalarTypeExtension',
  /** AST kind for object type extension nodes. */
  OBJECT_TYPE_EXTENSION = 'ObjectTypeExtension',
  /** AST kind for interface type extension nodes. */
  INTERFACE_TYPE_EXTENSION = 'InterfaceTypeExtension',
  /** AST kind for union type extension nodes. */
  UNION_TYPE_EXTENSION = 'UnionTypeExtension',
  /** AST kind for enum type extension nodes. */
  ENUM_TYPE_EXTENSION = 'EnumTypeExtension',
  /** AST kind for input object type extension nodes. */
  INPUT_OBJECT_TYPE_EXTENSION = 'InputObjectTypeExtension',

  /** AST kind for type coordinate nodes. */
  TYPE_COORDINATE = 'TypeCoordinate',
  /** AST kind for member coordinate nodes. */
  MEMBER_COORDINATE = 'MemberCoordinate',
  /** AST kind for argument coordinate nodes. */
  ARGUMENT_COORDINATE = 'ArgumentCoordinate',
  /** AST kind for directive coordinate nodes. */
  DIRECTIVE_COORDINATE = 'DirectiveCoordinate',
  /** AST kind for directive argument coordinate nodes. */
  DIRECTIVE_ARGUMENT_COORDINATE = 'DirectiveArgumentCoordinate',
}
export { Kind };

/**
 * Legacy alias for the enum type representing the possible kind values of AST
 * nodes. This is retained for backwards compatibility; use `Kind` instead
 * because KindEnum will be removed in v17.
 * @deprecated Please use `Kind`. Will be removed in v17.
 */
export type KindEnum = typeof Kind;
