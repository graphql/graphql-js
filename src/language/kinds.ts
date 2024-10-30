/**
 * The set of allowed kind values for AST nodes.
 */
export const Kind = {
  /** Name */
  NAME: 'Name' as const,

  /** Document */
  DOCUMENT: 'Document' as const,
  OPERATION_DEFINITION: 'OperationDefinition' as const,
  VARIABLE_DEFINITION: 'VariableDefinition' as const,
  SELECTION_SET: 'SelectionSet' as const,
  FIELD: 'Field' as const,
  ARGUMENT: 'Argument' as const,
  FRAGMENT_ARGUMENT: 'FragmentArgument' as const,

  /** Fragments */
  FRAGMENT_SPREAD: 'FragmentSpread' as const,
  INLINE_FRAGMENT: 'InlineFragment' as const,
  FRAGMENT_DEFINITION: 'FragmentDefinition' as const,

  /** Values */
  VARIABLE: 'Variable' as const,
  INT: 'IntValue' as const,
  FLOAT: 'FloatValue' as const,
  STRING: 'StringValue' as const,
  BOOLEAN: 'BooleanValue' as const,
  NULL: 'NullValue' as const,
  ENUM: 'EnumValue' as const,
  LIST: 'ListValue' as const,
  OBJECT: 'ObjectValue' as const,
  OBJECT_FIELD: 'ObjectField' as const,

  /** Directives */
  DIRECTIVE: 'Directive' as const,

  /** Types */
  NAMED_TYPE: 'NamedType' as const,
  LIST_TYPE: 'ListType' as const,
  NON_NULL_TYPE: 'NonNullType' as const,

  /** Type System Definitions */
  SCHEMA_DEFINITION: 'SchemaDefinition' as const,
  OPERATION_TYPE_DEFINITION: 'OperationTypeDefinition' as const,

  /** Type Definitions */
  SCALAR_TYPE_DEFINITION: 'ScalarTypeDefinition' as const,
  OBJECT_TYPE_DEFINITION: 'ObjectTypeDefinition' as const,
  FIELD_DEFINITION: 'FieldDefinition' as const,
  INPUT_VALUE_DEFINITION: 'InputValueDefinition' as const,
  INTERFACE_TYPE_DEFINITION: 'InterfaceTypeDefinition' as const,
  UNION_TYPE_DEFINITION: 'UnionTypeDefinition' as const,
  ENUM_TYPE_DEFINITION: 'EnumTypeDefinition' as const,
  ENUM_VALUE_DEFINITION: 'EnumValueDefinition' as const,
  INPUT_OBJECT_TYPE_DEFINITION: 'InputObjectTypeDefinition' as const,

  /** Directive Definitions */
  DIRECTIVE_DEFINITION: 'DirectiveDefinition' as const,

  /** Type System Extensions */
  SCHEMA_EXTENSION: 'SchemaExtension' as const,

  /** Type Extensions */
  SCALAR_TYPE_EXTENSION: 'ScalarTypeExtension' as const,
  OBJECT_TYPE_EXTENSION: 'ObjectTypeExtension' as const,
  INTERFACE_TYPE_EXTENSION: 'InterfaceTypeExtension' as const,
  UNION_TYPE_EXTENSION: 'UnionTypeExtension' as const,
  ENUM_TYPE_EXTENSION: 'EnumTypeExtension' as const,
  INPUT_OBJECT_TYPE_EXTENSION: 'InputObjectTypeExtension' as const,
};
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Kind = (typeof Kind)[keyof typeof Kind];
