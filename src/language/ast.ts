import type { Source } from './source';
import type { TokenKindEnum } from './tokenKind';

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

  toJSON(): { start: number; end: number } {
    return { start: this.start, end: this.end };
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
   */
  readonly value: string | void;

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
    prev: Token | null,
    value?: string,
  ) {
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.line = line;
    this.column = column;
    this.value = value;
    this.prev = prev;
    this.next = null;
  }

  toJSON(): {
    kind: TokenKindEnum;
    value: string | void;
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
}

/**
 * @internal
 */
export function isNode(maybeNode: unknown): maybeNode is ASTNode {
  return maybeNode != null && typeof maybeNode.kind === 'string';
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
export type ASTKindToNode = {
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
};

// Name

export type NameNode = {
  readonly kind: 'Name';
  readonly loc?: Location;
  readonly value: string;
};

// Document

export type DocumentNode = {
  readonly kind: 'Document';
  readonly loc?: Location;
  readonly definitions: ReadonlyArray<DefinitionNode>;
};

export type DefinitionNode =
  | ExecutableDefinitionNode
  | TypeSystemDefinitionNode
  | TypeSystemExtensionNode;

export type ExecutableDefinitionNode =
  | OperationDefinitionNode
  | FragmentDefinitionNode;

export type OperationDefinitionNode = {
  readonly kind: 'OperationDefinition';
  readonly loc?: Location;
  readonly operation: OperationTypeNode;
  readonly name?: NameNode;
  readonly variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet: SelectionSetNode;
};

export type OperationTypeNode = 'query' | 'mutation' | 'subscription';

export type VariableDefinitionNode = {
  readonly kind: 'VariableDefinition';
  readonly loc?: Location;
  readonly variable: VariableNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type VariableNode = {
  readonly kind: 'Variable';
  readonly loc?: Location;
  readonly name: NameNode;
};

export type SelectionSetNode = {
  kind: 'SelectionSet';
  loc?: Location;
  selections: ReadonlyArray<SelectionNode>;
};

export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;

export type FieldNode = {
  readonly kind: 'Field';
  readonly loc?: Location;
  readonly alias?: NameNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode>;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet?: SelectionSetNode;
};

export type ArgumentNode = {
  readonly kind: 'Argument';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
};

export type ConstArgumentNode = {
  readonly kind: 'Argument';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ConstValueNode;
};

// Fragments

export type FragmentSpreadNode = {
  readonly kind: 'FragmentSpread';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
};

export type InlineFragmentNode = {
  readonly kind: 'InlineFragment';
  readonly loc?: Location;
  readonly typeCondition?: NamedTypeNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet: SelectionSetNode;
};

export type FragmentDefinitionNode = {
  readonly kind: 'FragmentDefinition';
  readonly loc?: Location;
  readonly name: NameNode;
  // Note: fragment variable definitions are deprecated and will removed in v17.0.0
  readonly variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  readonly typeCondition: NamedTypeNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly selectionSet: SelectionSetNode;
};

// Values

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

export type IntValueNode = {
  readonly kind: 'IntValue';
  readonly loc?: Location;
  readonly value: string;
};

export type FloatValueNode = {
  readonly kind: 'FloatValue';
  readonly loc?: Location;
  readonly value: string;
};

export type StringValueNode = {
  readonly kind: 'StringValue';
  readonly loc?: Location;
  readonly value: string;
  readonly block?: boolean;
};

export type BooleanValueNode = {
  readonly kind: 'BooleanValue';
  readonly loc?: Location;
  readonly value: boolean;
};

export type NullValueNode = {
  readonly kind: 'NullValue';
  readonly loc?: Location;
};

export type EnumValueNode = {
  readonly kind: 'EnumValue';
  readonly loc?: Location;
  readonly value: string;
};

export type ListValueNode = {
  readonly kind: 'ListValue';
  readonly loc?: Location;
  readonly values: ReadonlyArray<ValueNode>;
};

export type ConstListValueNode = {
  readonly kind: 'ListValue';
  readonly loc?: Location;
  readonly values: ReadonlyArray<ConstValueNode>;
};

export type ObjectValueNode = {
  readonly kind: 'ObjectValue';
  readonly loc?: Location;
  readonly fields: ReadonlyArray<ObjectFieldNode>;
};

export type ConstObjectValueNode = {
  readonly kind: 'ObjectValue';
  readonly loc?: Location;
  readonly fields: ReadonlyArray<ConstObjectFieldNode>;
};

export type ObjectFieldNode = {
  readonly kind: 'ObjectField';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
};

export type ConstObjectFieldNode = {
  readonly kind: 'ObjectField';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ConstValueNode;
};

// Directives

export type DirectiveNode = {
  readonly kind: 'Directive';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode>;
};

export type ConstDirectiveNode = {
  readonly kind: 'Directive';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ConstArgumentNode>;
};

// Type Reference

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

export type NamedTypeNode = {
  readonly kind: 'NamedType';
  readonly loc?: Location;
  readonly name: NameNode;
};

export type ListTypeNode = {
  readonly kind: 'ListType';
  readonly loc?: Location;
  readonly type: TypeNode;
};

export type NonNullTypeNode = {
  readonly kind: 'NonNullType';
  readonly loc?: Location;
  readonly type: NamedTypeNode | ListTypeNode;
};

// Type System Definition

export type TypeSystemDefinitionNode =
  | SchemaDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode;

export type SchemaDefinitionNode = {
  readonly kind: 'SchemaDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly operationTypes: ReadonlyArray<OperationTypeDefinitionNode>;
};

export type OperationTypeDefinitionNode = {
  readonly kind: 'OperationTypeDefinition';
  readonly loc?: Location;
  readonly operation: OperationTypeNode;
  readonly type: NamedTypeNode;
};

// Type Definition

export type TypeDefinitionNode =
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | InputObjectTypeDefinitionNode;

export type ScalarTypeDefinitionNode = {
  readonly kind: 'ScalarTypeDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type ObjectTypeDefinitionNode = {
  readonly kind: 'ObjectTypeDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
};

export type FieldDefinitionNode = {
  readonly kind: 'FieldDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode>;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type InputValueDefinitionNode = {
  readonly kind: 'InputValueDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type InterfaceTypeDefinitionNode = {
  readonly loc?: Location;
  readonly kind: 'InterfaceTypeDefinition';
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
};

export type UnionTypeDefinitionNode = {
  readonly kind: 'UnionTypeDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly types?: ReadonlyArray<NamedTypeNode>;
};

export type EnumTypeDefinitionNode = {
  readonly kind: 'EnumTypeDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode>;
};

export type EnumValueDefinitionNode = {
  readonly kind: 'EnumValueDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type InputObjectTypeDefinitionNode = {
  readonly kind: 'InputObjectTypeDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode>;
};

// Directive Definitions

export type DirectiveDefinitionNode = {
  readonly kind: 'DirectiveDefinition';
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode>;
  readonly repeatable: boolean;
  readonly locations: ReadonlyArray<NameNode>;
};

// Type System Extensions

export type TypeSystemExtensionNode = SchemaExtensionNode | TypeExtensionNode;

export type SchemaExtensionNode = {
  readonly kind: 'SchemaExtension';
  readonly loc?: Location;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly operationTypes?: ReadonlyArray<OperationTypeDefinitionNode>;
};

// Type Extensions

export type TypeExtensionNode =
  | ScalarTypeExtensionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeExtensionNode
  | UnionTypeExtensionNode
  | EnumTypeExtensionNode
  | InputObjectTypeExtensionNode;

export type ScalarTypeExtensionNode = {
  readonly kind: 'ScalarTypeExtension';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type ObjectTypeExtensionNode = {
  readonly kind: 'ObjectTypeExtension';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
};

export type InterfaceTypeExtensionNode = {
  readonly kind: 'InterfaceTypeExtension';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
};

export type UnionTypeExtensionNode = {
  readonly kind: 'UnionTypeExtension';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly types?: ReadonlyArray<NamedTypeNode>;
};

export type EnumTypeExtensionNode = {
  readonly kind: 'EnumTypeExtension';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode>;
};

export type InputObjectTypeExtensionNode = {
  readonly kind: 'InputObjectTypeExtension';
  readonly loc?: Location;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode>;
};
