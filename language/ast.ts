import type { Kind } from './kinds.ts';
import type { Source } from './source.ts';
import type { TokenKindEnum } from './tokenKind.ts';
/**
 * Contains a range of UTF-8 character offsets and token references that
 * identify the region of the source from which the AST derived.
 */

export class Location {
  /**
   * The character offset at which this Node begins.
   */
  readonly start: number;
  /**
   * The character offset at which this Node ends.
   */

  readonly end: number;
  /**
   * The Token at which this Node begins.
   */

  readonly startToken: Token;
  /**
   * The Token at which this Node ends.
   */

  readonly endToken: Token;
  /**
   * The Source document the AST represents.
   */

  readonly source: Source;

  constructor(startToken: Token, endToken: Token, source: Source) {
    this.start = startToken.start;
    this.end = endToken.end;
    this.startToken = startToken;
    this.endToken = endToken;
    this.source = source;
  }

  toJSON(): {
    start: number;
    end: number;
  } {
    return {
      start: this.start,
      end: this.end,
    };
  }

  get [Symbol.toStringTag]() {
    return 'Location';
  }
}
/**
 * Represents a range of characters represented by a lexical token
 * within a Source.
 */

export class Token {
  /**
   * The kind of Token.
   */
  readonly kind: TokenKindEnum;
  /**
   * The character offset at which this Node begins.
   */

  readonly start: number;
  /**
   * The character offset at which this Node ends.
   */

  readonly end: number;
  /**
   * The 1-indexed line number on which this Token appears.
   */

  readonly line: number;
  /**
   * The 1-indexed column number at which this Token begins.
   */

  readonly column: number;
  /**
   * For non-punctuation tokens, represents the interpreted value of the token.
   *
   * Note: is undefined for punctuation tokens, but typed as string for
   * convenience in the parser.
   */

  readonly value: string;
  /**
   * Tokens exist as nodes in a double-linked-list amongst all tokens
   * including ignored tokens. <SOF> is always the first node and <EOF>
   * the last.
   */

  readonly prev: Token | null;
  readonly next: Token | null;

  constructor(
    kind: TokenKindEnum,
    start: number,
    end: number,
    line: number,
    column: number,
    value?: string,
  ) {
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.line = line;
    this.column = column; // eslint-disable-next-line @typescript-eslint/no-non-null-assertion

    this.value = value!;
    this.prev = null;
    this.next = null;
  }

  toJSON(): {
    kind: TokenKindEnum;
    value?: string;
    line: number;
    column: number;
  } {
    return {
      kind: this.kind,
      value: this.value,
      line: this.line,
      column: this.column,
    };
  }

  get [Symbol.toStringTag]() {
    return 'Token';
  }
}
/**
 * The list of all possible AST node types.
 */

export type ASTNode =
  | NameNode
  | DocumentNode
  | OperationDefinitionNode
  | VariableDefinitionNode
  | VariableNode
  | SelectionSetNode
  | FieldNode
  | ArgumentNode
  | FragmentSpreadNode
  | InlineFragmentNode
  | FragmentDefinitionNode
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ListValueNode
  | ObjectValueNode
  | ObjectFieldNode
  | DirectiveNode
  | NamedTypeNode
  | ListTypeNode
  | NonNullTypeNode
  | SchemaDefinitionNode
  | OperationTypeDefinitionNode
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | FieldDefinitionNode
  | InputValueDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | EnumValueDefinitionNode
  | InputObjectTypeDefinitionNode
  | DirectiveDefinitionNode
  | SchemaExtensionNode
  | ScalarTypeExtensionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeExtensionNode
  | UnionTypeExtensionNode
  | EnumTypeExtensionNode
  | InputObjectTypeExtensionNode;
/**
 * Utility type listing all nodes indexed by their kind.
 */

export interface ASTKindToNode {
  Name: NameNode;
  Document: DocumentNode;
  OperationDefinition: OperationDefinitionNode;
  VariableDefinition: VariableDefinitionNode;
  Variable: VariableNode;
  SelectionSet: SelectionSetNode;
  Field: FieldNode;
  Argument: ArgumentNode;
  FragmentSpread: FragmentSpreadNode;
  InlineFragment: InlineFragmentNode;
  FragmentDefinition: FragmentDefinitionNode;
  IntValue: IntValueNode;
  FloatValue: FloatValueNode;
  StringValue: StringValueNode;
  BooleanValue: BooleanValueNode;
  NullValue: NullValueNode;
  EnumValue: EnumValueNode;
  ListValue: ListValueNode;
  ObjectValue: ObjectValueNode;
  ObjectField: ObjectFieldNode;
  Directive: DirectiveNode;
  NamedType: NamedTypeNode;
  ListType: ListTypeNode;
  NonNullType: NonNullTypeNode;
  SchemaDefinition: SchemaDefinitionNode;
  OperationTypeDefinition: OperationTypeDefinitionNode;
  ScalarTypeDefinition: ScalarTypeDefinitionNode;
  ObjectTypeDefinition: ObjectTypeDefinitionNode;
  FieldDefinition: FieldDefinitionNode;
  InputValueDefinition: InputValueDefinitionNode;
  InterfaceTypeDefinition: InterfaceTypeDefinitionNode;
  UnionTypeDefinition: UnionTypeDefinitionNode;
  EnumTypeDefinition: EnumTypeDefinitionNode;
  EnumValueDefinition: EnumValueDefinitionNode;
  InputObjectTypeDefinition: InputObjectTypeDefinitionNode;
  DirectiveDefinition: DirectiveDefinitionNode;
  SchemaExtension: SchemaExtensionNode;
  ScalarTypeExtension: ScalarTypeExtensionNode;
  ObjectTypeExtension: ObjectTypeExtensionNode;
  InterfaceTypeExtension: InterfaceTypeExtensionNode;
  UnionTypeExtension: UnionTypeExtensionNode;
  EnumTypeExtension: EnumTypeExtensionNode;
  InputObjectTypeExtension: InputObjectTypeExtensionNode;
}
/**
 * @internal
 */

export const QueryDocumentKeys: {
  [P in keyof ASTKindToNode]: ReadonlyArray<keyof ASTKindToNode[P]>;
} = {
  Name: [],
  Document: ['definitions'],
  OperationDefinition: [
    'name',
    'variableDefinitions',
    'directives',
    'selectionSet',
  ],
  VariableDefinition: ['variable', 'type', 'defaultValue', 'directives'],
  Variable: ['name'],
  SelectionSet: ['selections'],
  Field: ['alias', 'name', 'arguments', 'directives', 'selectionSet'],
  Argument: ['name', 'value'],
  FragmentSpread: ['name', 'directives'],
  InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
  FragmentDefinition: [
    'name', // Note: fragment variable definitions are deprecated and will removed in v17.0.0
    'variableDefinitions',
    'typeCondition',
    'directives',
    'selectionSet',
  ],
  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ['values'],
  ObjectValue: ['fields'],
  ObjectField: ['name', 'value'],
  Directive: ['name', 'arguments'],
  NamedType: ['name'],
  ListType: ['type'],
  NonNullType: ['type'],
  SchemaDefinition: ['description', 'directives', 'operationTypes'],
  OperationTypeDefinition: ['type'],
  ScalarTypeDefinition: ['description', 'name', 'directives'],
  ObjectTypeDefinition: [
    'description',
    'name',
    'interfaces',
    'directives',
    'fields',
  ],
  FieldDefinition: ['description', 'name', 'arguments', 'type', 'directives'],
  InputValueDefinition: [
    'description',
    'name',
    'type',
    'defaultValue',
    'directives',
  ],
  InterfaceTypeDefinition: [
    'description',
    'name',
    'interfaces',
    'directives',
    'fields',
  ],
  UnionTypeDefinition: ['description', 'name', 'directives', 'types'],
  EnumTypeDefinition: ['description', 'name', 'directives', 'values'],
  EnumValueDefinition: ['description', 'name', 'directives'],
  InputObjectTypeDefinition: ['description', 'name', 'directives', 'fields'],
  DirectiveDefinition: ['description', 'name', 'arguments', 'locations'],
  SchemaExtension: ['directives', 'operationTypes'],
  ScalarTypeExtension: ['name', 'directives'],
  ObjectTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
  InterfaceTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
  UnionTypeExtension: ['name', 'directives', 'types'],
  EnumTypeExtension: ['name', 'directives', 'values'],
  InputObjectTypeExtension: ['name', 'directives', 'fields'],
};
const kindValues = new Set<string>(Object.keys(QueryDocumentKeys));
/**
 * @internal
 */

export function isNode(maybeNode: any): maybeNode is ASTNode {
  const maybeKind = maybeNode?.kind;
  return typeof maybeKind === 'string' && kindValues.has(maybeKind);
}
/** Name */

export interface NameNode {
  readonly kind: typeof Kind.NAME;
  readonly loc?: Location;
  readonly value: string;
}
/** Document */

export interface DocumentNode {
  readonly kind: typeof Kind.DOCUMENT;
  readonly loc?: Location;
  readonly definitions: ReadonlyArray<DefinitionNode>;
}
export type DefinitionNode =
  | ExecutableDefinitionNode
  | TypeSystemDefinitionNode
  | TypeSystemExtensionNode;
export type ExecutableDefinitionNode =
  | OperationDefinitionNode
  | FragmentDefinitionNode;
export interface OperationDefinitionNode {
  readonly kind: typeof Kind.OPERATION_DEFINITION;
  readonly loc?: Location;
  readonly operation: OperationTypeNode;
  readonly name?: NameNode;
  readonly variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet: SelectionSetNode;
}
export type OperationTypeNode = 'query' | 'mutation' | 'subscription';
export interface VariableDefinitionNode {
  readonly kind: typeof Kind.VARIABLE_DEFINITION;
  readonly loc?: Location;
  readonly variable: VariableNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
export interface VariableNode {
  readonly kind: typeof Kind.VARIABLE;
  readonly loc?: Location;
  readonly name: NameNode;
}
export interface SelectionSetNode {
  kind: typeof Kind.SELECTION_SET;
  loc?: Location;
  selections: ReadonlyArray<SelectionNode>;
}
export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;
export interface FieldNode {
  readonly kind: typeof Kind.FIELD;
  readonly loc?: Location;
  readonly alias?: NameNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode>;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet?: SelectionSetNode;
}
export interface ArgumentNode {
  readonly kind: typeof Kind.ARGUMENT;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
}
export interface ConstArgumentNode {
  readonly kind: 'Argument';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}
/** Fragments */

export interface FragmentSpreadNode {
  readonly kind: typeof Kind.FRAGMENT_SPREAD;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
}
export interface InlineFragmentNode {
  readonly kind: typeof Kind.INLINE_FRAGMENT;
  readonly loc?: Location;
  readonly typeCondition?: NamedTypeNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet: SelectionSetNode;
}
export interface FragmentDefinitionNode {
  readonly kind: typeof Kind.FRAGMENT_DEFINITION;
  readonly loc?: Location;
  readonly name: NameNode;
  /** @deprecated variableDefinitions will be removed in v17.0.0 */

  readonly variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  readonly typeCondition: NamedTypeNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet: SelectionSetNode;
}
/** Values */

export type ValueNode =
  | VariableNode
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ListValueNode
  | ObjectValueNode;
export type ConstValueNode =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ConstListValueNode
  | ConstObjectValueNode;
export interface IntValueNode {
  readonly kind: typeof Kind.INT;
  readonly loc?: Location;
  readonly value: string;
}
export interface FloatValueNode {
  readonly kind: typeof Kind.FLOAT;
  readonly loc?: Location;
  readonly value: string;
}
export interface StringValueNode {
  readonly kind: typeof Kind.STRING;
  readonly loc?: Location;
  readonly value: string;
  readonly block?: boolean;
}
export interface BooleanValueNode {
  readonly kind: typeof Kind.BOOLEAN;
  readonly loc?: Location;
  readonly value: boolean;
}
export interface NullValueNode {
  readonly kind: typeof Kind.NULL;
  readonly loc?: Location;
}
export interface EnumValueNode {
  readonly kind: typeof Kind.ENUM;
  readonly loc?: Location;
  readonly value: string;
}
export interface ListValueNode {
  readonly kind: typeof Kind.LIST;
  readonly loc?: Location;
  readonly values: ReadonlyArray<ValueNode>;
}
export interface ConstListValueNode {
  readonly kind: 'ListValue';
  readonly loc?: Location;
  readonly values: ReadonlyArray<ConstValueNode>;
}
export interface ObjectValueNode {
  readonly kind: typeof Kind.OBJECT;
  readonly loc?: Location;
  readonly fields: ReadonlyArray<ObjectFieldNode>;
}
export interface ConstObjectValueNode {
  readonly kind: 'ObjectValue';
  readonly loc?: Location;
  readonly fields: ReadonlyArray<ConstObjectFieldNode>;
}
export interface ObjectFieldNode {
  readonly kind: typeof Kind.OBJECT_FIELD;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
}
export interface ConstObjectFieldNode {
  readonly kind: 'ObjectField';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}
/** Directives */

export interface DirectiveNode {
  readonly kind: typeof Kind.DIRECTIVE;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode>;
}
export interface ConstDirectiveNode {
  readonly kind: 'Directive';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ConstArgumentNode>;
}
/** Type Reference */

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;
export interface NamedTypeNode {
  readonly kind: typeof Kind.NAMED_TYPE;
  readonly loc?: Location;
  readonly name: NameNode;
}
export interface ListTypeNode {
  readonly kind: typeof Kind.LIST_TYPE;
  readonly loc?: Location;
  readonly type: TypeNode;
}
export interface NonNullTypeNode {
  readonly kind: typeof Kind.NON_NULL_TYPE;
  readonly loc?: Location;
  readonly type: NamedTypeNode | ListTypeNode;
}
/** Type System Definition */

export type TypeSystemDefinitionNode =
  | SchemaDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode;
export interface SchemaDefinitionNode {
  readonly kind: typeof Kind.SCHEMA_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly operationTypes: ReadonlyArray<OperationTypeDefinitionNode>;
}
export interface OperationTypeDefinitionNode {
  readonly kind: typeof Kind.OPERATION_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly operation: OperationTypeNode;
  readonly type: NamedTypeNode;
}
/** Type Definition */

export type TypeDefinitionNode =
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | InputObjectTypeDefinitionNode;
export interface ScalarTypeDefinitionNode {
  readonly kind: typeof Kind.SCALAR_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
export interface ObjectTypeDefinitionNode {
  readonly kind: typeof Kind.OBJECT_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}
export interface FieldDefinitionNode {
  readonly kind: typeof Kind.FIELD_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode>;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
export interface InputValueDefinitionNode {
  readonly kind: typeof Kind.INPUT_VALUE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
export interface InterfaceTypeDefinitionNode {
  readonly kind: typeof Kind.INTERFACE_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}
export interface UnionTypeDefinitionNode {
  readonly kind: typeof Kind.UNION_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly types?: ReadonlyArray<NamedTypeNode>;
}
export interface EnumTypeDefinitionNode {
  readonly kind: typeof Kind.ENUM_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode>;
}
export interface EnumValueDefinitionNode {
  readonly kind: typeof Kind.ENUM_VALUE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
export interface InputObjectTypeDefinitionNode {
  readonly kind: typeof Kind.INPUT_OBJECT_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode>;
}
/** Directive Definitions */

export interface DirectiveDefinitionNode {
  readonly kind: typeof Kind.DIRECTIVE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode>;
  readonly repeatable: boolean;
  readonly locations: ReadonlyArray<NameNode>;
}
/** Type System Extensions */

export type TypeSystemExtensionNode = SchemaExtensionNode | TypeExtensionNode;
export interface SchemaExtensionNode {
  readonly kind: typeof Kind.SCHEMA_EXTENSION;
  readonly loc?: Location;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly operationTypes?: ReadonlyArray<OperationTypeDefinitionNode>;
}
/** Type Extensions */

export type TypeExtensionNode =
  | ScalarTypeExtensionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeExtensionNode
  | UnionTypeExtensionNode
  | EnumTypeExtensionNode
  | InputObjectTypeExtensionNode;
export interface ScalarTypeExtensionNode {
  readonly kind: typeof Kind.SCALAR_TYPE_EXTENSION;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
export interface ObjectTypeExtensionNode {
  readonly kind: typeof Kind.OBJECT_TYPE_EXTENSION;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}
export interface InterfaceTypeExtensionNode {
  readonly kind: typeof Kind.INTERFACE_TYPE_EXTENSION;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}
export interface UnionTypeExtensionNode {
  readonly kind: typeof Kind.UNION_TYPE_EXTENSION;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly types?: ReadonlyArray<NamedTypeNode>;
}
export interface EnumTypeExtensionNode {
  readonly kind: typeof Kind.ENUM_TYPE_EXTENSION;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode>;
}
export interface InputObjectTypeExtensionNode {
  readonly kind: typeof Kind.INPUT_OBJECT_TYPE_EXTENSION;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode>;
}
