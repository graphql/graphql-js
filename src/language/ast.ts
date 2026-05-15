/** @category AST */

import type { Kind } from './kinds';
import type { Source } from './source';
import type { TokenKind } from './tokenKind';

/**
 * Contains a range of UTF-8 character offsets and token references that
 * identify the region of the source from which the AST derived.
 */
export class Location {
  /** The character offset at which this Node begins. */
  readonly start: number;

  /** The character offset at which this Node ends. */
  readonly end: number;

  /** The Token at which this Node begins. */
  readonly startToken: Token;

  /** The Token at which this Node ends. */
  readonly endToken: Token;

  /** The Source document the AST represents. */
  readonly source: Source;

  /**
   * Creates a Location instance.
   * @param startToken - The start token.
   * @param endToken - The end token.
   * @param source - Source document used to derive error locations.
   * @example
   * ```ts
   * import { Location, Source, Token, TokenKind } from 'graphql/language';
   *
   * const source = new Source('{ hello }');
   * const startToken = new Token(TokenKind.BRACE_L, 0, 1, 1, 1);
   * const endToken = new Token(TokenKind.BRACE_R, 8, 9, 1, 9);
   * const location = new Location(startToken, endToken, source);
   *
   * location.start; // => 0
   * location.end; // => 9
   * location.source.body; // => '{ hello }'
   * ```
   */
  constructor(startToken: Token, endToken: Token, source: Source) {
    this.start = startToken.start;
    this.end = endToken.end;
    this.startToken = startToken;
    this.endToken = endToken;
    this.source = source;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'Location';
  }

  /**
   * Returns a JSON representation of this location.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   *
   * const document = parse('{ hello }');
   * const location = document.loc?.toJSON();
   *
   * location; // => { start: 0, end: 9 }
   * ```
   */
  toJSON(): { start: number; end: number } {
    return { start: this.start, end: this.end };
  }
}

/**
 * Represents a range of characters represented by a lexical token
 * within a Source.
 */
export class Token {
  /** The kind of Token. */
  readonly kind: TokenKind;

  /** The character offset at which this Node begins. */
  readonly start: number;

  /** The character offset at which this Node ends. */
  readonly end: number;

  /** The 1-indexed line number on which this Token appears. */
  readonly line: number;

  /** The 1-indexed column number at which this Token begins. */
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
  /** Next token in the token stream, including ignored tokens. */
  readonly next: Token | null;

  /**
   * Creates a Token instance.
   * @param kind - Token kind produced by lexical analysis.
   * @param start - Character offset where this token begins.
   * @param end - Character offset where this token ends.
   * @param line - One-indexed line number where this token begins.
   * @param column - One-indexed column number where this token begins.
   * @param value - Interpreted value for non-punctuation tokens.
   * @example
   * ```ts
   * import { Token, TokenKind } from 'graphql/language';
   *
   * const token = new Token(TokenKind.NAME, 2, 7, 1, 3, 'hello');
   *
   * token.kind; // => TokenKind.NAME
   * token.value; // => 'hello'
   * token.toJSON(); // => { kind: 'Name', value: 'hello', line: 1, column: 3 }
   * ```
   */
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

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'Token';
  }

  /**
   * Returns a JSON representation of this token.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { Lexer, Source } from 'graphql/language';
   *
   * const lexer = new Lexer(new Source('{ hello }'));
   * const token = lexer.advance().toJSON();
   *
   * token; // => { kind: '{', value: undefined, line: 1, column: 1 }
   * ```
   */
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

/** The list of all possible AST node types. */
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
  | DirectiveExtensionNode
  | TypeCoordinateNode
  | MemberCoordinateNode
  | ArgumentCoordinateNode
  | DirectiveCoordinateNode
  | DirectiveArgumentCoordinateNode;

/** Utility type listing all nodes indexed by their kind. */
export type ASTKindToNode = {
  [NodeT in ASTNode as NodeT['kind']]: NodeT;
};

/** @internal */
export const QueryDocumentKeys: {
  [NodeT in ASTNode as NodeT['kind']]: ReadonlyArray<keyof NodeT>;
} = {
  Name: [],

  Document: ['definitions'],
  OperationDefinition: [
    'description',
    'name',
    'variableDefinitions',
    'directives',
    'selectionSet',
  ],
  VariableDefinition: [
    'description',
    'variable',
    'type',
    'defaultValue',
    'directives',
  ],
  Variable: ['name'],
  SelectionSet: ['selections'],
  Field: ['alias', 'name', 'arguments', 'directives', 'selectionSet'],
  Argument: ['name', 'value'],

  FragmentSpread: ['name', 'directives'],
  InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
  FragmentDefinition: [
    'description',
    'name',
    // Note: fragment variable definitions are deprecated and will removed in v17.0.0
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

  DirectiveDefinition: [
    'description',
    'name',
    'arguments',
    'directives',
    'locations',
  ],

  SchemaExtension: ['directives', 'operationTypes'],

  DirectiveExtension: ['name', 'directives'],

  ScalarTypeExtension: ['name', 'directives'],
  ObjectTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
  InterfaceTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
  UnionTypeExtension: ['name', 'directives', 'types'],
  EnumTypeExtension: ['name', 'directives', 'values'],
  InputObjectTypeExtension: ['name', 'directives', 'fields'],

  TypeCoordinate: ['name'],
  MemberCoordinate: ['name', 'memberName'],
  ArgumentCoordinate: ['name', 'fieldName', 'argumentName'],
  DirectiveCoordinate: ['name'],
  DirectiveArgumentCoordinate: ['name', 'argumentName'],
};

const kindValues = new Set<string>(Object.keys(QueryDocumentKeys));
/** @internal */
export function isNode(maybeNode: any): maybeNode is ASTNode {
  const maybeKind = maybeNode?.kind;
  return typeof maybeKind === 'string' && kindValues.has(maybeKind);
}

/** An identifier in a GraphQL document. */
export interface NameNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.NAME;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Parsed value represented by this node. */
  readonly value: string;
}

/** The root AST node for a parsed GraphQL document. */
export interface DocumentNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DOCUMENT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Top-level executable and type-system definitions in this document. */
  readonly definitions: ReadonlyArray<DefinitionNode>;
  /** The number of lexical tokens parsed for this document, if token counting was enabled. */
  readonly tokenCount?: number | undefined;
}

/** Any top-level definition that may appear in a GraphQL document. */
export type DefinitionNode =
  | ExecutableDefinitionNode
  | TypeSystemDefinitionNode
  | TypeSystemExtensionNode;

/** Any executable definition that may appear in an operation document. */
export type ExecutableDefinitionNode =
  | OperationDefinitionNode
  | FragmentDefinitionNode;

/** A query, mutation, or subscription operation definition. */
export interface OperationDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OPERATION_DEFINITION;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The operation selected for execution. */
  readonly operation: OperationTypeNode;
  /** Name node identifying this AST node. */
  readonly name?: NameNode;
  /** Variable definitions declared by this operation or fragment. */
  readonly variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<DirectiveNode>;
  /** Selections made by this operation, field, or fragment. */
  readonly selectionSet: SelectionSetNode;
}

/**
 * The operation types supported by GraphQL executable definitions.
 * @category Kinds
 */
enum OperationTypeNode {
  /** A query operation. */
  QUERY = 'query',
  /** A mutation operation. */
  MUTATION = 'mutation',
  /** A subscription operation. */
  SUBSCRIPTION = 'subscription',
}
export { OperationTypeNode };

/** A variable declaration in an operation or legacy fragment definition. */
export interface VariableDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.VARIABLE_DEFINITION;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The variable being defined or referenced. */
  readonly variable: VariableNode;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: TypeNode;
  /** Default value used when no explicit value is supplied. */
  readonly defaultValue?: ConstValueNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

/** A variable reference, such as `$id`. */
export interface VariableNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.VARIABLE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
}

/** A set of fields and fragments selected from an object, interface, or union. */
export interface SelectionSetNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  kind: Kind.SELECTION_SET;
  /** The source location for this AST node, if location tracking was enabled. */
  loc?: Location;
  /** Fields and fragments contained in this selection set. */
  selections: ReadonlyArray<SelectionNode>;
}

/** Any selection that may appear inside a selection set. */
export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;

/** A field selected in an executable GraphQL document. */
export interface FieldNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.FIELD;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The response-key alias for this field, if one was supplied. */
  readonly alias?: NameNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Arguments supplied to this field, directive, or coordinate. */
  readonly arguments?: ReadonlyArray<ArgumentNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<DirectiveNode>;
  /** Selections made by this operation, field, or fragment. */
  readonly selectionSet?: SelectionSetNode;
}

/** An argument supplied to a field or directive. */
export interface ArgumentNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ARGUMENT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Parsed value represented by this node. */
  readonly value: ValueNode;
}

/** An argument node whose value is guaranteed to be constant. */
export interface ConstArgumentNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ARGUMENT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Parsed value represented by this node. */
  readonly value: ConstValueNode;
}

// Fragments

/** A named fragment spread, such as `...userFields`. */
export interface FragmentSpreadNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.FRAGMENT_SPREAD;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<DirectiveNode>;
}

/** An inline fragment spread with an optional type condition. */
export interface InlineFragmentNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INLINE_FRAGMENT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The type condition that limits where this fragment applies. */
  readonly typeCondition?: NamedTypeNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<DirectiveNode>;
  /** Selections made by this operation, field, or fragment. */
  readonly selectionSet: SelectionSetNode;
}

/** A reusable fragment definition declared in an executable document. */
export interface FragmentDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.FRAGMENT_DEFINITION;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /**
   * Variable definitions declared by this legacy fragment definition.
   * @deprecated variableDefinitions will be removed in v17.0.0
   */
  readonly variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  /** The type condition that limits where this fragment applies. */
  readonly typeCondition: NamedTypeNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<DirectiveNode>;
  /** Selections made by this operation, field, or fragment. */
  readonly selectionSet: SelectionSetNode;
}

// Values

/** Any value literal that may appear in an executable GraphQL document. */
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

/** Any value literal that is guaranteed not to contain a variable reference. */
export type ConstValueNode =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ConstListValueNode
  | ConstObjectValueNode;

/** An integer value literal. */
export interface IntValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Parsed value represented by this node. */
  readonly value: string;
}

/** A floating-point value literal. */
export interface FloatValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.FLOAT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Parsed value represented by this node. */
  readonly value: string;
}

/** A string value literal. */
export interface StringValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.STRING;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Parsed value represented by this node. */
  readonly value: string;
  /** Whether this string was parsed from block string syntax. */
  readonly block?: boolean;
}

/** A boolean value literal. */
export interface BooleanValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.BOOLEAN;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Parsed value represented by this node. */
  readonly value: boolean;
}

/** A null value literal. */
export interface NullValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.NULL;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
}

/** An enum value literal. */
export interface EnumValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ENUM;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Parsed value represented by this node. */
  readonly value: string;
}

/** A list value literal. */
export interface ListValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.LIST;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Values contained in this enum, list, or input-object definition. */
  readonly values: ReadonlyArray<ValueNode>;
}

/** A list value literal whose elements are all constant values. */
export interface ConstListValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.LIST;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Values contained in this enum, list, or input-object definition. */
  readonly values: ReadonlyArray<ConstValueNode>;
}

/** An input object value literal. */
export interface ObjectValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OBJECT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields: ReadonlyArray<ObjectFieldNode>;
}

/** An input object value literal whose fields are all constant values. */
export interface ConstObjectValueNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OBJECT;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields: ReadonlyArray<ConstObjectFieldNode>;
}

/** A field inside an input object value literal. */
export interface ObjectFieldNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OBJECT_FIELD;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Parsed value represented by this node. */
  readonly value: ValueNode;
}

/** A field inside a constant input object value literal. */
export interface ConstObjectFieldNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OBJECT_FIELD;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Parsed value represented by this node. */
  readonly value: ConstValueNode;
}

// Directives

/** A directive applied to an executable or type-system location. */
export interface DirectiveNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DIRECTIVE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Arguments supplied to this field, directive, or coordinate. */
  readonly arguments?: ReadonlyArray<ArgumentNode>;
}

/** A directive whose arguments are all constant values. */
export interface ConstDirectiveNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DIRECTIVE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Arguments supplied to this field, directive, or coordinate. */
  readonly arguments?: ReadonlyArray<ConstArgumentNode>;
}

// Type Reference

/** Any GraphQL type reference AST node. */
export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

/** A named type reference. */
export interface NamedTypeNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.NAMED_TYPE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
}

/** A list type reference. */
export interface ListTypeNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.LIST_TYPE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: TypeNode;
}

/** A non-null type reference. */
export interface NonNullTypeNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.NON_NULL_TYPE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: NamedTypeNode | ListTypeNode;
}

// Type System Definition

/** Any type-system definition that may appear in a schema document. */
export type TypeSystemDefinitionNode =
  | SchemaDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode;

/** A schema definition in a type-system document. */
export interface SchemaDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.SCHEMA_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Root operation types declared by this schema definition or extension. */
  readonly operationTypes: ReadonlyArray<OperationTypeDefinitionNode>;
}

/** A root operation type declaration inside a schema definition or extension. */
export interface OperationTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OPERATION_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The operation selected for execution. */
  readonly operation: OperationTypeNode;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: NamedTypeNode;
}

// Type Definition

/** Any named type definition that may appear in a schema document. */
export type TypeDefinitionNode =
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | InputObjectTypeDefinitionNode;

/** A scalar type definition in a type-system document. */
export interface ScalarTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.SCALAR_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

/** An object type definition in a type-system document. */
export interface ObjectTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OBJECT_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Interfaces implemented by this object or interface type. */
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}

/** A field definition declared by an object or interface type. */
export interface FieldDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.FIELD_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Arguments supplied to this field, directive, or coordinate. */
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode>;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: TypeNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

/** An argument or input-field definition. */
export interface InputValueDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INPUT_VALUE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: TypeNode;
  /** Default value used when no explicit value is supplied. */
  readonly defaultValue?: ConstValueNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

/** An interface type definition in a type-system document. */
export interface InterfaceTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INTERFACE_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Interfaces implemented by this object or interface type. */
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}

/** A union type definition in a type-system document. */
export interface UnionTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.UNION_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Object types that belong to this union type. */
  readonly types?: ReadonlyArray<NamedTypeNode>;
}

/** An enum type definition in a type-system document. */
export interface EnumTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ENUM_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Values contained in this enum, list, or input-object definition. */
  readonly values?: ReadonlyArray<EnumValueDefinitionNode>;
}

/** An enum value definition. */
export interface EnumValueDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ENUM_VALUE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

/** An input object type definition in a type-system document. */
export interface InputObjectTypeDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INPUT_OBJECT_TYPE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields?: ReadonlyArray<InputValueDefinitionNode>;
}

// Directive Definitions

/** A directive definition in a type-system document. */
export interface DirectiveDefinitionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DIRECTIVE_DEFINITION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** The optional GraphQL description associated with this definition. */
  readonly description?: StringValueNode;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Arguments supplied to this field, directive, or coordinate. */
  readonly arguments?: ReadonlyArray<InputValueDefinitionNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Whether this directive may appear more than once at the same location. */
  readonly repeatable: boolean;
  /** Locations where this directive may be applied. */
  readonly locations: ReadonlyArray<NameNode>;
}

// Type System Extensions

/** Any type-system extension that may appear in a schema extension document. */
export type TypeSystemExtensionNode =
  | SchemaExtensionNode
  | TypeExtensionNode
  | DirectiveExtensionNode;

/** A schema extension in a type-system document. */
export interface SchemaExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.SCHEMA_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Root operation types declared by this schema definition or extension. */
  readonly operationTypes?: ReadonlyArray<OperationTypeDefinitionNode>;
}

// Type Extensions

/** Any named type extension that may appear in a schema extension document. */
export type TypeExtensionNode =
  | ScalarTypeExtensionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeExtensionNode
  | UnionTypeExtensionNode
  | EnumTypeExtensionNode
  | InputObjectTypeExtensionNode;

/** A scalar type extension. */
export interface ScalarTypeExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.SCALAR_TYPE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

/** An object type extension. */
export interface ObjectTypeExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.OBJECT_TYPE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Interfaces implemented by this object or interface type. */
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}

/** An interface type extension. */
export interface InterfaceTypeExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INTERFACE_TYPE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Interfaces implemented by this object or interface type. */
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
}

/** A union type extension. */
export interface UnionTypeExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.UNION_TYPE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Object types that belong to this union type. */
  readonly types?: ReadonlyArray<NamedTypeNode>;
}

/** An enum type extension. */
export interface EnumTypeExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ENUM_TYPE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Values contained in this enum, list, or input-object definition. */
  readonly values?: ReadonlyArray<EnumValueDefinitionNode>;
}

/** An input object type extension. */
export interface InputObjectTypeExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.INPUT_OBJECT_TYPE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields?: ReadonlyArray<InputValueDefinitionNode>;
}

/** A directive extension. */
export interface DirectiveExtensionNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DIRECTIVE_EXTENSION;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

// Schema Coordinates

/** Any AST node representing a GraphQL schema coordinate. */
export type SchemaCoordinateNode =
  | TypeCoordinateNode
  | MemberCoordinateNode
  | ArgumentCoordinateNode
  | DirectiveCoordinateNode
  | DirectiveArgumentCoordinateNode;

/** A schema coordinate that refers to a named type. */
export interface TypeCoordinateNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.TYPE_COORDINATE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
}

/** A schema coordinate that refers to a member of a named type. */
export interface MemberCoordinateNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.MEMBER_COORDINATE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** The member name referenced by this schema coordinate. */
  readonly memberName: NameNode;
}

/** A schema coordinate that refers to a field or directive argument. */
export interface ArgumentCoordinateNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.ARGUMENT_COORDINATE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** The field name referenced by this schema coordinate. */
  readonly fieldName: NameNode;
  /** The argument name referenced by this schema coordinate. */
  readonly argumentName: NameNode;
}

/** A schema coordinate that refers to a directive. */
export interface DirectiveCoordinateNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DIRECTIVE_COORDINATE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
}

/** A schema coordinate that refers to a directive argument. */
export interface DirectiveArgumentCoordinateNode {
  /** The discriminator identifying the concrete AST or introspection kind. */
  readonly kind: Kind.DIRECTIVE_ARGUMENT_COORDINATE;
  /** The source location for this AST node, if location tracking was enabled. */
  readonly loc?: Location;
  /** Name node identifying this AST node. */
  readonly name: NameNode;
  /** The argument name referenced by this schema coordinate. */
  readonly argumentName: NameNode;
}
