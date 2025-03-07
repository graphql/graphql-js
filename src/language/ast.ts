import type { Kind } from './kinds.js';
import type { Source } from './source.js';
import type { TokenKind } from './tokenKind.js';

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

  get [Symbol.toStringTag]() {
    return 'Location';
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

  // eslint-disable-next-line @typescript-eslint/max-params
  constructor(
    kind: TokenKind,
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
    this.column = column;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.value = value!;
    this.prev = null;
    this.next = null;
  }

  get [Symbol.toStringTag]() {
    return 'Token';
  }

  toJSON(): {
    kind: TokenKind;
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
  | FragmentArgumentNode
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
  [NodeT in ASTNode as NodeT['kind']]: NodeT;
};

/**
 * @internal
 */
export const QueryDocumentKeys: {
  [NodeT in ASTNode as NodeT['kind']]: ReadonlyArray<keyof NodeT>;
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
  FragmentArgument: ['name', 'value'],

  FragmentSpread: [
    'name',
    // Note: Fragment arguments are experimental and may be changed or removed
    // in the future.
    'arguments',
    'directives',
  ],
  InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
  FragmentDefinition: [
    'name',
    // Note: Fragment variables are experimental and may be changed or removed
    // in the future.
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
  readonly loc?: Location | undefined;
  readonly value: string;
}

/** Document */

export interface DocumentNode {
  readonly kind: typeof Kind.DOCUMENT;
  readonly loc?: Location | undefined;
  readonly definitions: ReadonlyArray<DefinitionNode>;
  readonly tokenCount?: number | undefined;
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
  readonly loc?: Location | undefined;
  readonly operation: OperationTypeNode;
  readonly name?: NameNode | undefined;
  readonly variableDefinitions?:
    | ReadonlyArray<VariableDefinitionNode>
    | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  readonly selectionSet: SelectionSetNode;
}

export const OperationTypeNode = {
  QUERY: 'query' as const,
  MUTATION: 'mutation' as const,
  SUBSCRIPTION: 'subscription' as const,
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type OperationTypeNode =
  (typeof OperationTypeNode)[keyof typeof OperationTypeNode];

export interface VariableDefinitionNode {
  readonly kind: typeof Kind.VARIABLE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly variable: VariableNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}

export interface VariableNode {
  readonly kind: typeof Kind.VARIABLE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
}

export interface SelectionSetNode {
  kind: typeof Kind.SELECTION_SET;
  loc?: Location | undefined;
  selections: ReadonlyArray<SelectionNode>;
}

export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;

export interface FieldNode {
  readonly kind: typeof Kind.FIELD;
  readonly loc?: Location | undefined;
  readonly alias?: NameNode | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode> | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  readonly selectionSet?: SelectionSetNode | undefined;
}

export interface ArgumentNode {
  readonly kind: typeof Kind.ARGUMENT;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ValueNode;
}

export interface ConstArgumentNode {
  readonly kind: typeof Kind.ARGUMENT;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}

export interface FragmentArgumentNode {
  readonly kind: typeof Kind.FRAGMENT_ARGUMENT;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ValueNode;
}

/** Fragments */

export interface FragmentSpreadNode {
  readonly kind: typeof Kind.FRAGMENT_SPREAD;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<FragmentArgumentNode> | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
}

export interface InlineFragmentNode {
  readonly kind: typeof Kind.INLINE_FRAGMENT;
  readonly loc?: Location | undefined;
  readonly typeCondition?: NamedTypeNode | undefined;
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  readonly selectionSet: SelectionSetNode;
}

export interface FragmentDefinitionNode {
  readonly kind: typeof Kind.FRAGMENT_DEFINITION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
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
  readonly kind: typeof Kind.INT;
  readonly loc?: Location | undefined;
  readonly value: string;
}

export interface FloatValueNode {
  readonly kind: typeof Kind.FLOAT;
  readonly loc?: Location | undefined;
  readonly value: string;
}

export interface StringValueNode {
  readonly kind: typeof Kind.STRING;
  readonly loc?: Location | undefined;
  readonly value: string;
  readonly block?: boolean | undefined;
}

export interface BooleanValueNode {
  readonly kind: typeof Kind.BOOLEAN;
  readonly loc?: Location | undefined;
  readonly value: boolean;
}

export interface NullValueNode {
  readonly kind: typeof Kind.NULL;
  readonly loc?: Location | undefined;
}

export interface EnumValueNode {
  readonly kind: typeof Kind.ENUM;
  readonly loc?: Location | undefined;
  readonly value: string;
}

export interface ListValueNode {
  readonly kind: typeof Kind.LIST;
  readonly loc?: Location | undefined;
  readonly values: ReadonlyArray<ValueNode>;
}

export interface ConstListValueNode {
  readonly kind: typeof Kind.LIST;
  readonly loc?: Location | undefined;
  readonly values: ReadonlyArray<ConstValueNode>;
}

export interface ObjectValueNode {
  readonly kind: typeof Kind.OBJECT;
  readonly loc?: Location | undefined;
  readonly fields: ReadonlyArray<ObjectFieldNode>;
}

export interface ConstObjectValueNode {
  readonly kind: typeof Kind.OBJECT;
  readonly loc?: Location | undefined;
  readonly fields: ReadonlyArray<ConstObjectFieldNode>;
}

export interface ObjectFieldNode {
  readonly kind: typeof Kind.OBJECT_FIELD;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ValueNode;
}

export interface ConstObjectFieldNode {
  readonly kind: typeof Kind.OBJECT_FIELD;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}

/** Directives */

export interface DirectiveNode {
  readonly kind: typeof Kind.DIRECTIVE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode> | undefined;
}

export interface ConstDirectiveNode {
  readonly kind: typeof Kind.DIRECTIVE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ConstArgumentNode> | undefined;
}

/** Type Reference */

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

export interface NamedTypeNode {
  readonly kind: typeof Kind.NAMED_TYPE;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
}

export interface ListTypeNode {
  readonly kind: typeof Kind.LIST_TYPE;
  readonly loc?: Location | undefined;
  readonly type: TypeNode;
}

export interface NonNullTypeNode {
  readonly kind: typeof Kind.NON_NULL_TYPE;
  readonly loc?: Location | undefined;
  readonly type: NamedTypeNode | ListTypeNode;
}

/** Type System Definition */

export type TypeSystemDefinitionNode =
  | SchemaDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode;

export interface SchemaDefinitionNode {
  readonly kind: typeof Kind.SCHEMA_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly operationTypes: ReadonlyArray<OperationTypeDefinitionNode>;
}

export interface OperationTypeDefinitionNode {
  readonly kind: typeof Kind.OPERATION_TYPE_DEFINITION;
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
  readonly kind: typeof Kind.SCALAR_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}

export interface ObjectTypeDefinitionNode {
  readonly kind: typeof Kind.OBJECT_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}

export interface FieldDefinitionNode {
  readonly kind: typeof Kind.FIELD_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode> | undefined;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}

export interface InputValueDefinitionNode {
  readonly kind: typeof Kind.INPUT_VALUE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}

export interface InterfaceTypeDefinitionNode {
  readonly kind: typeof Kind.INTERFACE_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}

export interface UnionTypeDefinitionNode {
  readonly kind: typeof Kind.UNION_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly types?: ReadonlyArray<NamedTypeNode> | undefined;
}

export interface EnumTypeDefinitionNode {
  readonly kind: typeof Kind.ENUM_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode> | undefined;
}

export interface EnumValueDefinitionNode {
  readonly kind: typeof Kind.ENUM_VALUE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}

export interface InputObjectTypeDefinitionNode {
  readonly kind: typeof Kind.INPUT_OBJECT_TYPE_DEFINITION;
  readonly loc?: Location | undefined;
  readonly description?: StringValueNode | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode> | undefined;
}

/** Directive Definitions */

export interface DirectiveDefinitionNode {
  readonly kind: typeof Kind.DIRECTIVE_DEFINITION;
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
  readonly kind: typeof Kind.SCHEMA_EXTENSION;
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
  readonly kind: typeof Kind.SCALAR_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
}

export interface ObjectTypeExtensionNode {
  readonly kind: typeof Kind.OBJECT_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}

export interface InterfaceTypeExtensionNode {
  readonly kind: typeof Kind.INTERFACE_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly interfaces?: ReadonlyArray<NamedTypeNode> | undefined;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
}

export interface UnionTypeExtensionNode {
  readonly kind: typeof Kind.UNION_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly types?: ReadonlyArray<NamedTypeNode> | undefined;
}

export interface EnumTypeExtensionNode {
  readonly kind: typeof Kind.ENUM_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly values?: ReadonlyArray<EnumValueDefinitionNode> | undefined;
}

export interface InputObjectTypeExtensionNode {
  readonly kind: typeof Kind.INPUT_OBJECT_TYPE_EXTENSION;
  readonly loc?: Location | undefined;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
  readonly fields?: ReadonlyArray<InputValueDefinitionNode> | undefined;
}
