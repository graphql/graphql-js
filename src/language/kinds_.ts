/** @category Kinds */

/* eslint-disable @typescript-eslint/no-redeclare */

/** AST kind for name nodes. */
export const NAME = 'Name';
/** Type of the `Kind.NAME` AST kind value. */
export type NAME = typeof NAME;

/** AST kind for document nodes. */
export const DOCUMENT = 'Document';
/** Type of the `Kind.DOCUMENT` AST kind value. */
export type DOCUMENT = typeof DOCUMENT;

/** AST kind for operation definition nodes. */
export const OPERATION_DEFINITION = 'OperationDefinition';
/** Type of the `Kind.OPERATION_DEFINITION` AST kind value. */
export type OPERATION_DEFINITION = typeof OPERATION_DEFINITION;

/** AST kind for variable definition nodes. */
export const VARIABLE_DEFINITION = 'VariableDefinition';
/** Type of the `Kind.VARIABLE_DEFINITION` AST kind value. */
export type VARIABLE_DEFINITION = typeof VARIABLE_DEFINITION;

/** AST kind for selection set nodes. */
export const SELECTION_SET = 'SelectionSet';
/** Type of the `Kind.SELECTION_SET` AST kind value. */
export type SELECTION_SET = typeof SELECTION_SET;

/** AST kind for field selection nodes. */
export const FIELD = 'Field';
/** Type of the `Kind.FIELD` AST kind value. */
export type FIELD = typeof FIELD;

/** AST kind for argument nodes. */
export const ARGUMENT = 'Argument';
/** Type of the `Kind.ARGUMENT` AST kind value. */
export type ARGUMENT = typeof ARGUMENT;

/** AST kind for fragment argument nodes. */
export const FRAGMENT_ARGUMENT = 'FragmentArgument';
/** Type of the `Kind.FRAGMENT_ARGUMENT` AST kind value. */
export type FRAGMENT_ARGUMENT = typeof FRAGMENT_ARGUMENT;

/** AST kind for fragment spread nodes. */
export const FRAGMENT_SPREAD = 'FragmentSpread';
/** Type of the `Kind.FRAGMENT_SPREAD` AST kind value. */
export type FRAGMENT_SPREAD = typeof FRAGMENT_SPREAD;

/** AST kind for inline fragment nodes. */
export const INLINE_FRAGMENT = 'InlineFragment';
/** Type of the `Kind.INLINE_FRAGMENT` AST kind value. */
export type INLINE_FRAGMENT = typeof INLINE_FRAGMENT;

/** AST kind for fragment definition nodes. */
export const FRAGMENT_DEFINITION = 'FragmentDefinition';
/** Type of the `Kind.FRAGMENT_DEFINITION` AST kind value. */
export type FRAGMENT_DEFINITION = typeof FRAGMENT_DEFINITION;

/** AST kind for variable reference nodes. */
export const VARIABLE = 'Variable';
/** Type of the `Kind.VARIABLE` AST kind value. */
export type VARIABLE = typeof VARIABLE;

/** AST kind for integer value nodes. */
export const INT = 'IntValue';
/** Type of the `Kind.INT` AST kind value. */
export type INT = typeof INT;

/** AST kind for floating-point value nodes. */
export const FLOAT = 'FloatValue';
/** Type of the `Kind.FLOAT` AST kind value. */
export type FLOAT = typeof FLOAT;

/** AST kind for string value nodes. */
export const STRING = 'StringValue';
/** Type of the `Kind.STRING` AST kind value. */
export type STRING = typeof STRING;

/** AST kind for boolean value nodes. */
export const BOOLEAN = 'BooleanValue';
/** Type of the `Kind.BOOLEAN` AST kind value. */
export type BOOLEAN = typeof BOOLEAN;

/** AST kind for null value nodes. */
export const NULL = 'NullValue';
/** Type of the `Kind.NULL` AST kind value. */
export type NULL = typeof NULL;

/** AST kind for enum value nodes. */
export const ENUM = 'EnumValue';
/** Type of the `Kind.ENUM` AST kind value. */
export type ENUM = typeof ENUM;

/** AST kind for list value nodes. */
export const LIST = 'ListValue';
/** Type of the `Kind.LIST` AST kind value. */
export type LIST = typeof LIST;

/** AST kind for object value nodes. */
export const OBJECT = 'ObjectValue';
/** Type of the `Kind.OBJECT` AST kind value. */
export type OBJECT = typeof OBJECT;

/** AST kind for object field nodes. */
export const OBJECT_FIELD = 'ObjectField';
/** Type of the `Kind.OBJECT_FIELD` AST kind value. */
export type OBJECT_FIELD = typeof OBJECT_FIELD;

/** AST kind for directive nodes. */
export const DIRECTIVE = 'Directive';
/** Type of the `Kind.DIRECTIVE` AST kind value. */
export type DIRECTIVE = typeof DIRECTIVE;

/** AST kind for named type reference nodes. */
export const NAMED_TYPE = 'NamedType';
/** Type of the `Kind.NAMED_TYPE` AST kind value. */
export type NAMED_TYPE = typeof NAMED_TYPE;

/** AST kind for list type reference nodes. */
export const LIST_TYPE = 'ListType';
/** Type of the `Kind.LIST_TYPE` AST kind value. */
export type LIST_TYPE = typeof LIST_TYPE;

/** AST kind for non-null type reference nodes. */
export const NON_NULL_TYPE = 'NonNullType';
/** Type of the `Kind.NON_NULL_TYPE` AST kind value. */
export type NON_NULL_TYPE = typeof NON_NULL_TYPE;

/** AST kind for schema definition nodes. */
export const SCHEMA_DEFINITION = 'SchemaDefinition';
/** Type of the `Kind.SCHEMA_DEFINITION` AST kind value. */
export type SCHEMA_DEFINITION = typeof SCHEMA_DEFINITION;

/** AST kind for operation type definition nodes. */
export const OPERATION_TYPE_DEFINITION = 'OperationTypeDefinition';
/** Type of the `Kind.OPERATION_TYPE_DEFINITION` AST kind value. */
export type OPERATION_TYPE_DEFINITION = typeof OPERATION_TYPE_DEFINITION;

/** AST kind for scalar type definition nodes. */
export const SCALAR_TYPE_DEFINITION = 'ScalarTypeDefinition';
/** Type of the `Kind.SCALAR_TYPE_DEFINITION` AST kind value. */
export type SCALAR_TYPE_DEFINITION = typeof SCALAR_TYPE_DEFINITION;

/** AST kind for object type definition nodes. */
export const OBJECT_TYPE_DEFINITION = 'ObjectTypeDefinition';
/** Type of the `Kind.OBJECT_TYPE_DEFINITION` AST kind value. */
export type OBJECT_TYPE_DEFINITION = typeof OBJECT_TYPE_DEFINITION;

/** AST kind for field definition nodes. */
export const FIELD_DEFINITION = 'FieldDefinition';
/** Type of the `Kind.FIELD_DEFINITION` AST kind value. */
export type FIELD_DEFINITION = typeof FIELD_DEFINITION;

/** AST kind for input value definition nodes. */
export const INPUT_VALUE_DEFINITION = 'InputValueDefinition';
/** Type of the `Kind.INPUT_VALUE_DEFINITION` AST kind value. */
export type INPUT_VALUE_DEFINITION = typeof INPUT_VALUE_DEFINITION;

/** AST kind for interface type definition nodes. */
export const INTERFACE_TYPE_DEFINITION = 'InterfaceTypeDefinition';
/** Type of the `Kind.INTERFACE_TYPE_DEFINITION` AST kind value. */
export type INTERFACE_TYPE_DEFINITION = typeof INTERFACE_TYPE_DEFINITION;

/** AST kind for union type definition nodes. */
export const UNION_TYPE_DEFINITION = 'UnionTypeDefinition';
/** Type of the `Kind.UNION_TYPE_DEFINITION` AST kind value. */
export type UNION_TYPE_DEFINITION = typeof UNION_TYPE_DEFINITION;

/** AST kind for enum type definition nodes. */
export const ENUM_TYPE_DEFINITION = 'EnumTypeDefinition';

/** AST kind for enum value definition nodes. */
export const ENUM_VALUE_DEFINITION = 'EnumValueDefinition';
/** Type of the `Kind.ENUM_VALUE_DEFINITION` AST kind value. */
export type ENUM_VALUE_DEFINITION = typeof ENUM_VALUE_DEFINITION;

/** AST kind for input object type definition nodes. */
export const INPUT_OBJECT_TYPE_DEFINITION = 'InputObjectTypeDefinition';
/** Type of the `Kind.INPUT_OBJECT_TYPE_DEFINITION` AST kind value. */
export type INPUT_OBJECT_TYPE_DEFINITION = typeof INPUT_OBJECT_TYPE_DEFINITION;

/** AST kind for directive definition nodes. */
export const DIRECTIVE_DEFINITION = 'DirectiveDefinition';
/** Type of the `Kind.DIRECTIVE_DEFINITION` AST kind value. */
export type DIRECTIVE_DEFINITION = typeof DIRECTIVE_DEFINITION;

/** AST kind for schema extension nodes. */
export const SCHEMA_EXTENSION = 'SchemaExtension';
/** Type of the `Kind.SCHEMA_EXTENSION` AST kind value. */
export type SCHEMA_EXTENSION = typeof SCHEMA_EXTENSION;

/** AST kind for directive extension nodes. */
export const DIRECTIVE_EXTENSION = 'DirectiveExtension';
/** Type of the `Kind.DIRECTIVE_EXTENSION` AST kind value. */
export type DIRECTIVE_EXTENSION = typeof DIRECTIVE_EXTENSION;

/** AST kind for scalar type extension nodes. */
export const SCALAR_TYPE_EXTENSION = 'ScalarTypeExtension';
/** Type of the `Kind.SCALAR_TYPE_EXTENSION` AST kind value. */
export type SCALAR_TYPE_EXTENSION = typeof SCALAR_TYPE_EXTENSION;

/** AST kind for object type extension nodes. */
export const OBJECT_TYPE_EXTENSION = 'ObjectTypeExtension';
/** Type of the `Kind.OBJECT_TYPE_EXTENSION` AST kind value. */
export type OBJECT_TYPE_EXTENSION = typeof OBJECT_TYPE_EXTENSION;

/** AST kind for interface type extension nodes. */
export const INTERFACE_TYPE_EXTENSION = 'InterfaceTypeExtension';
/** Type of the `Kind.INTERFACE_TYPE_EXTENSION` AST kind value. */
export type INTERFACE_TYPE_EXTENSION = typeof INTERFACE_TYPE_EXTENSION;

/** AST kind for union type extension nodes. */
export const UNION_TYPE_EXTENSION = 'UnionTypeExtension';
/** Type of the `Kind.UNION_TYPE_EXTENSION` AST kind value. */
export type UNION_TYPE_EXTENSION = typeof UNION_TYPE_EXTENSION;

/** AST kind for enum type extension nodes. */
export const ENUM_TYPE_EXTENSION = 'EnumTypeExtension';
/** Type of the `Kind.ENUM_TYPE_EXTENSION` AST kind value. */
export type ENUM_TYPE_EXTENSION = typeof ENUM_TYPE_EXTENSION;

/** AST kind for input object type extension nodes. */
export const INPUT_OBJECT_TYPE_EXTENSION = 'InputObjectTypeExtension';
/** Type of the `Kind.INPUT_OBJECT_TYPE_EXTENSION` AST kind value. */
export type INPUT_OBJECT_TYPE_EXTENSION = typeof INPUT_OBJECT_TYPE_EXTENSION;

/** AST kind for type coordinate nodes. */
export const TYPE_COORDINATE = 'TypeCoordinate';
/** Type of the `Kind.TYPE_COORDINATE` AST kind value. */
export type TYPE_COORDINATE = typeof TYPE_COORDINATE;

/** AST kind for member coordinate nodes. */
export const MEMBER_COORDINATE = 'MemberCoordinate';
/** Type of the `Kind.MEMBER_COORDINATE` AST kind value. */
export type MEMBER_COORDINATE = typeof MEMBER_COORDINATE;

/** AST kind for argument coordinate nodes. */
export const ARGUMENT_COORDINATE = 'ArgumentCoordinate';
/** Type of the `Kind.ARGUMENT_COORDINATE` AST kind value. */
export type ARGUMENT_COORDINATE = typeof ARGUMENT_COORDINATE;

/** AST kind for directive coordinate nodes. */
export const DIRECTIVE_COORDINATE = 'DirectiveCoordinate';
/** Type of the `Kind.DIRECTIVE_COORDINATE` AST kind value. */
export type DIRECTIVE_COORDINATE = typeof DIRECTIVE_COORDINATE;

/** AST kind for directive argument coordinate nodes. */
export const DIRECTIVE_ARGUMENT_COORDINATE = 'DirectiveArgumentCoordinate';
/** Type of the `Kind.DIRECTIVE_ARGUMENT_COORDINATE` AST kind value. */
export type DIRECTIVE_ARGUMENT_COORDINATE =
  typeof DIRECTIVE_ARGUMENT_COORDINATE;
