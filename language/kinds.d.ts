/**
 * The set of allowed kind values for AST nodes.
 */
export declare const Kind: Readonly<{
  /** Name */
  readonly NAME: 'Name';
  /** Document */
  readonly DOCUMENT: 'Document';
  readonly OPERATION_DEFINITION: 'OperationDefinition';
  readonly VARIABLE_DEFINITION: 'VariableDefinition';
  readonly SELECTION_SET: 'SelectionSet';
  readonly FIELD: 'Field';
  readonly ARGUMENT: 'Argument';
  /** Fragments */
  readonly FRAGMENT_SPREAD: 'FragmentSpread';
  readonly INLINE_FRAGMENT: 'InlineFragment';
  readonly FRAGMENT_DEFINITION: 'FragmentDefinition';
  /** Values */
  readonly VARIABLE: 'Variable';
  readonly INT: 'IntValue';
  readonly FLOAT: 'FloatValue';
  readonly STRING: 'StringValue';
  readonly BOOLEAN: 'BooleanValue';
  readonly NULL: 'NullValue';
  readonly ENUM: 'EnumValue';
  readonly LIST: 'ListValue';
  readonly OBJECT: 'ObjectValue';
  readonly OBJECT_FIELD: 'ObjectField';
  /** Directives */
  readonly DIRECTIVE: 'Directive';
  /** Types */
  readonly NAMED_TYPE: 'NamedType';
  readonly LIST_TYPE: 'ListType';
  readonly NON_NULL_TYPE: 'NonNullType';
  /** Type System Definitions */
  readonly SCHEMA_DEFINITION: 'SchemaDefinition';
  readonly OPERATION_TYPE_DEFINITION: 'OperationTypeDefinition';
  /** Type Definitions */
  readonly SCALAR_TYPE_DEFINITION: 'ScalarTypeDefinition';
  readonly OBJECT_TYPE_DEFINITION: 'ObjectTypeDefinition';
  readonly FIELD_DEFINITION: 'FieldDefinition';
  readonly INPUT_VALUE_DEFINITION: 'InputValueDefinition';
  readonly INTERFACE_TYPE_DEFINITION: 'InterfaceTypeDefinition';
  readonly UNION_TYPE_DEFINITION: 'UnionTypeDefinition';
  readonly ENUM_TYPE_DEFINITION: 'EnumTypeDefinition';
  readonly ENUM_VALUE_DEFINITION: 'EnumValueDefinition';
  readonly INPUT_OBJECT_TYPE_DEFINITION: 'InputObjectTypeDefinition';
  /** Directive Definitions */
  readonly DIRECTIVE_DEFINITION: 'DirectiveDefinition';
  /** Type System Extensions */
  readonly SCHEMA_EXTENSION: 'SchemaExtension';
  /** Type Extensions */
  readonly SCALAR_TYPE_EXTENSION: 'ScalarTypeExtension';
  readonly OBJECT_TYPE_EXTENSION: 'ObjectTypeExtension';
  readonly INTERFACE_TYPE_EXTENSION: 'InterfaceTypeExtension';
  readonly UNION_TYPE_EXTENSION: 'UnionTypeExtension';
  readonly ENUM_TYPE_EXTENSION: 'EnumTypeExtension';
  readonly INPUT_OBJECT_TYPE_EXTENSION: 'InputObjectTypeExtension';
}>;
/**
 * The enum type representing the possible kind values of AST nodes.
 */
export declare type KindEnum = typeof Kind[keyof typeof Kind];
