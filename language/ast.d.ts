import type { Kind } from './kinds.js';
import type { Source } from './source.js';
import type { TokenKind } from './tokenKind.js';
/**
 * Contains a range of UTF-8 character offsets and token references that
 * identify the region of the source from which the AST derived.
 */
export declare class Location {
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
  constructor(startToken: Token, endToken: Token, source: Source);
  get [Symbol.toStringTag](): string;
  toJSON(): {
    start: number;
    end: number;
  };
}
/**
 * Represents a range of characters represented by a lexical token
 * within a Source.
 */
export declare class Token {
  /**
   * The kind of Token.
   */
  readonly kind: TokenKind;
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
    kind: TokenKind,
    start: number,
    end: number,
    line: number,
    column: number,
    value?: string,
  );
  get [Symbol.toStringTag](): string;
  toJSON(): {
    kind: TokenKind;
    value?: string;
    line: number;
    column: number;
  };
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
  | InputObjectTypeExtensionNode
  | NonNullAssertionNode
  | ErrorBoundaryNode
  | ListNullabilityOperatorNode;
/**
 * Utility type listing all nodes indexed by their kind.
 */
export type ASTKindToNode = {
  [NodeT in ASTNode as NodeT['kind']]: NodeT;
};
/**
 * @internal
 */
export declare const QueryDocumentKeys: {
  [NodeT in ASTNode as NodeT['kind']]: ReadonlyArray<keyof NodeT>;
};
/**
 * @internal
 */
export declare function isNode(maybeNode: any): maybeNode is ASTNode;
/** Name */
export interface NameNode {
  readonly kind: Kind.NAME;
  readonly loc?: Location | undefined;
  readonly value: string;
}
/** Document */
export interface DocumentNode {
  readonly kind: Kind.DOCUMENT;
  readonly loc?: Location | undefined;
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
  readonly kind: Kind.OPERATION_DEFINITION;
  readonly loc?: Location | undefined;
  readonly operation: OperationTypeNode;
  readonly name?: NameNode | undefined;
  readonly variableDefinitions?:
    | ReadonlyArray<VariableDefinitionNode>
    | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  readonly selectionSet: SelectionSetNode;
}
export declare enum OperationTypeNode {
  QUERY = 'query',
  MUTATION = 'mutation',
  SUBSCRIPTION = 'subscription',
}
export interface VariableDefinitionNode {
  readonly kind: Kind.VARIABLE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly variable: VariableNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}
export interface VariableNode {
  readonly kind: Kind.VARIABLE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
}
export interface SelectionSetNode {
  kind: Kind.SELECTION_SET;
  loc?: Location | undefined;
  selections: ReadonlyArray<SelectionNode>;
}
export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;
export interface FieldNode {
  readonly kind: Kind.FIELD;
  readonly loc?: Location | undefined;
  readonly alias?: NameNode | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode> | undefined;
  readonly nullabilityAssertion?: NullabilityAssertionNode | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  readonly selectionSet?: SelectionSetNode | undefined;
}
export type NullabilityAssertionNode =
  | NonNullAssertionNode
  | ErrorBoundaryNode
  | ListNullabilityOperatorNode;
export interface ListNullabilityOperatorNode {
  readonly kind: Kind.LIST_NULLABILITY_OPERATOR;
  readonly loc?: Location | undefined;
  readonly nullabilityAssertion?: NullabilityAssertionNode | undefined;
}
export interface NonNullAssertionNode {
  readonly kind: Kind.NON_NULL_ASSERTION;
  readonly loc?: Location | undefined;
  readonly nullabilityAssertion?: ListNullabilityOperatorNode | undefined;
}
export interface ErrorBoundaryNode {
  readonly kind: Kind.ERROR_BOUNDARY;
  readonly loc?: Location | undefined;
  readonly nullabilityAssertion?: ListNullabilityOperatorNode | undefined;
}
export interface ArgumentNode {
  readonly kind: Kind.ARGUMENT;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ValueNode;
}
export interface ConstArgumentNode {
  readonly kind: Kind.ARGUMENT;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}
/** Fragments */
export interface FragmentSpreadNode {
  readonly kind: Kind.FRAGMENT_SPREAD;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
}
export interface InlineFragmentNode {
  readonly kind: Kind.INLINE_FRAGMENT;
  readonly loc?: Location | undefined;
  readonly typeCondition?: NamedTypeNode | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  readonly selectionSet: SelectionSetNode;
}
export interface FragmentDefinitionNode {
  readonly kind: Kind.FRAGMENT_DEFINITION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  /** @deprecated variableDefinitions will be removed in v17.0.0 */
  readonly variableDefinitions?:
    | ReadonlyArray<VariableDefinitionNode>
    | undefined;
  readonly typeCondition: NamedTypeNode;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
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
  readonly kind: Kind.INT;
  readonly loc?: Location | undefined;
  readonly value: string;
}
export interface FloatValueNode {
  readonly kind: Kind.FLOAT;
  readonly loc?: Location | undefined;
  readonly value: string;
}
export interface StringValueNode {
  readonly kind: Kind.STRING;
  readonly loc?: Location | undefined;
  readonly value: string;
  readonly block?: boolean | undefined;
}
export interface BooleanValueNode {
  readonly kind: Kind.BOOLEAN;
  readonly loc?: Location | undefined;
  readonly value: boolean;
}
export interface NullValueNode {
  readonly kind: Kind.NULL;
  readonly loc?: Location | undefined;
}
export interface EnumValueNode {
  readonly kind: Kind.ENUM;
  readonly loc?: Location | undefined;
  readonly value: string;
}
export interface ListValueNode {
  readonly kind: Kind.LIST;
  readonly loc?: Location | undefined;
  readonly values: ReadonlyArray<ValueNode>;
}
export interface ConstListValueNode {
  readonly kind: Kind.LIST;
  readonly loc?: Location | undefined;
  readonly values: ReadonlyArray<ConstValueNode>;
}
export interface ObjectValueNode {
  readonly kind: Kind.OBJECT;
  readonly loc?: Location | undefined;
  readonly fields: ReadonlyArray<ObjectFieldNode>;
}
export interface ConstObjectValueNode {
  readonly kind: Kind.OBJECT;
  readonly loc?: Location | undefined;
  readonly fields: ReadonlyArray<ConstObjectFieldNode>;
}
export interface ObjectFieldNode {
  readonly kind: Kind.OBJECT_FIELD;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ValueNode;
}
export interface ConstObjectFieldNode {
  readonly kind: Kind.OBJECT_FIELD;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}
/** Directives */
export interface DirectiveNode {
  readonly kind: Kind.DIRECTIVE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode> | undefined;
}
export interface ConstDirectiveNode {
  readonly kind: Kind.DIRECTIVE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ConstArgumentNode> | undefined;
}
/** Type Reference */
export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;
export interface NamedTypeNode {
  readonly kind: Kind.NAMED_TYPE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
}
export interface ListTypeNode {
  readonly kind: Kind.LIST_TYPE;
  readonly loc?: Location | undefined;
  readonly type: TypeNode;
}
export interface NonNullTypeNode {
  readonly kind: Kind.NON_NULL_TYPE;
  readonly loc?: Location | undefined;
  readonly type: NamedTypeNode | ListTypeNode;
}
/** Type System Definition */
export type TypeSystemDefinitionNode =
  | SchemaDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode;
export interface SchemaDefinitionNode {
  readonly kind: Kind.SCHEMA_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly operationTypes: ReadonlyArray<OperationTypeDefinitionNode>;
}
export interface OperationTypeDefinitionNode {
  readonly kind: Kind.OPERATION_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
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
  readonly kind: Kind.SCALAR_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}
export interface ObjectTypeDefinitionNode {
  readonly kind: Kind.OBJECT_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}
export interface FieldDefinitionNode {
  readonly kind: Kind.FIELD_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode> | undefined;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}
export interface InputValueDefinitionNode {
  readonly kind: Kind.INPUT_VALUE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}
export interface InterfaceTypeDefinitionNode {
  readonly kind: Kind.INTERFACE_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}
export interface UnionTypeDefinitionNode {
  readonly kind: Kind.UNION_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly types?: ReadonlyArray<NamedTypeNode> | undefined;
}
export interface EnumTypeDefinitionNode {
  readonly kind: Kind.ENUM_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode> | undefined;
}
export interface EnumValueDefinitionNode {
  readonly kind: Kind.ENUM_VALUE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}
export interface InputObjectTypeDefinitionNode {
  readonly kind: Kind.INPUT_OBJECT_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode> | undefined;
}
/** Directive Definitions */
export interface DirectiveDefinitionNode {
  readonly kind: Kind.DIRECTIVE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode> | undefined;
  readonly repeatable: boolean;
  readonly locations: ReadonlyArray<NameNode>;
}
/** Type System Extensions */
export type TypeSystemExtensionNode = SchemaExtensionNode | TypeExtensionNode;
export interface SchemaExtensionNode {
  readonly kind: Kind.SCHEMA_EXTENSION;
  readonly loc?: Location | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly operationTypes?:
    | ReadonlyArray<OperationTypeDefinitionNode>
    | undefined;
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
  readonly kind: Kind.SCALAR_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}
export interface ObjectTypeExtensionNode {
  readonly kind: Kind.OBJECT_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}
export interface InterfaceTypeExtensionNode {
  readonly kind: Kind.INTERFACE_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}
export interface UnionTypeExtensionNode {
  readonly kind: Kind.UNION_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly types?: ReadonlyArray<NamedTypeNode> | undefined;
}
export interface EnumTypeExtensionNode {
  readonly kind: Kind.ENUM_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode> | undefined;
}
export interface InputObjectTypeExtensionNode {
  readonly kind: Kind.INPUT_OBJECT_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode> | undefined;
}
