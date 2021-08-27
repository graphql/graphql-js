import { Maybe } from '../jsutils/Maybe';
import { GraphQLError } from '..';

import { TokenKindEnum } from './tokenKind';
import { Source } from './source';
import {
  TypeNode,
  ValueNode,
  DocumentNode,
  Token,
  Location,
  NameNode,
  DirectiveDefinitionNode,
  InputObjectTypeExtensionNode,
  EnumTypeExtensionNode,
  UnionTypeExtensionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeExtensionNode,
  ScalarTypeExtensionNode,
  SchemaExtensionNode,
  TypeSystemExtensionNode,
  InputValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  EnumValueDefinitionNode,
  EnumTypeDefinitionNode,
  NamedTypeNode,
  UnionTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  OperationTypeDefinitionNode,
  SchemaDefinitionNode,
  StringValueNode,
  DirectiveNode,
  ObjectFieldNode,
  ObjectValueNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  ArgumentNode,
  FieldNode,
  SelectionNode,
  SelectionSetNode,
  VariableNode,
  VariableDefinitionNode,
  OperationTypeNode,
  OperationDefinitionNode,
  DefinitionNode,
  FragmentDefinitionNode,
  ListValueNode,
} from './ast';
import { Lexer } from './lexer';

/**
 * Configuration options to control parser behavior
 */
export interface ParseOptions {
  /**
   * By default, the parser creates AST nodes that know the location
   * in the source that they correspond to. This configuration flag
   * disables that behavior for performance or testing.
   */
  noLocation?: boolean;

  /**
   * If enabled, the parser will parse empty fields sets in the Schema
   * Definition Language. Otherwise, the parser will follow the current
   * specification.
   *
   * This option is provided to ease adoption of the final SDL specification
   * and will be removed in v16.
   */
  allowLegacySDLEmptyFields?: boolean;

  /**
   * If enabled, the parser will parse implemented interfaces with no `&`
   * character between each interface. Otherwise, the parser will follow the
   * current specification.
   *
   * This option is provided to ease adoption of the final SDL specification
   * and will be removed in v16.
   */
  allowLegacySDLImplementsInterfaces?: boolean;

  /**
   * EXPERIMENTAL:
   *
   * If enabled, the parser will understand and parse variable definitions
   * contained in a fragment definition. They'll be represented in the
   * `variableDefinitions` field of the FragmentDefinitionNode.
   *
   * The syntax is identical to normal, query-defined variables. For example:
   *
   *   fragment A($var: Boolean = false) on T  {
   *     ...
   *   }
   *
   * Note: this feature is experimental and may change or be removed in the
   * future.
   */
  experimentalFragmentVariables?: boolean;
}

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */
export function parse(
  source: string | Source,
  options?: ParseOptions,
): DocumentNode;

/**
 * Given a string containing a GraphQL value, parse the AST for that value.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 */
export function parseValue(
  source: string | Source,
  options?: ParseOptions,
): ValueNode;

/**
 * Given a string containing a GraphQL Type (ex. `[Int!]`), parse the AST for
 * that type.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Types directly and
 * in isolation of complete GraphQL documents.
 *
 * Consider providing the results to the utility function: typeFromAST().
 */
export function parseType(
  source: string | Source,
  options?: ParseOptions,
): TypeNode;

export class Parser {
  protected _lexer: Lexer;
  protected _options?: ParseOptions;
  constructor(source: string | Source, options?: ParseOptions);

  /**
   * Converts a name lex token into a name parse node.
   */
  parseName(): NameNode;
  /**
   * Document : Definition+
   */
  parseDocument(): DocumentNode;
  /**
   * Definition :
   *   - ExecutableDefinition
   *   - TypeSystemDefinition
   *   - TypeSystemExtension
   *
   * ExecutableDefinition :
   *   - OperationDefinition
   *   - FragmentDefinition
   *
   * TypeSystemDefinition :
   *   - SchemaDefinition
   *   - TypeDefinition
   *   - DirectiveDefinition
   *
   * TypeDefinition :
   *   - ScalarTypeDefinition
   *   - ObjectTypeDefinition
   *   - InterfaceTypeDefinition
   *   - UnionTypeDefinition
   *   - EnumTypeDefinition
   *   - InputObjectTypeDefinition
   */
  parseDefinition(): DefinitionNode;
  /**
   * OperationDefinition :
   *  - SelectionSet
   *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
   */
  parseOperationDefinition(): OperationDefinitionNode;
  /**
   * OperationType : one of query mutation subscription
   */
  parseOperationType(): OperationTypeNode;
  /**
   * VariableDefinitions : ( VariableDefinition+ )
   */
  parseVariableDefinitions(): Array<VariableDefinitionNode>;
  /**
   * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
   */
  parseVariableDefinition(): VariableDefinitionNode;
  /**
   * Variable : $ Name
   */
  parseVariable(): VariableNode;
  /**
   * ```
   * SelectionSet : { Selection+ }
   * ```
   */
  parseSelectionSet(): SelectionSetNode;
  /**
   * Selection :
   *   - Field
   *   - FragmentSpread
   *   - InlineFragment
   */
  parseSelection(): SelectionNode;
  /**
   * Field : Alias? Name Arguments? Directives? SelectionSet?
   *
   * Alias : Name :
   */
  parseField(): FieldNode;
  /**
   * Arguments[Const] : ( Argument[?Const]+ )
   */
  parseArguments: Array<ArgumentNode>;
  /**
   * Argument[Const] : Name : Value[?Const]
   */
  parseArgument: ArgumentNode;
  /**
   * Corresponds to both FragmentSpread and InlineFragment in the spec.
   *
   * FragmentSpread : ... FragmentName Directives?
   *
   * InlineFragment : ... TypeCondition? Directives? SelectionSet
   */
  parseFragment(): FragmentSpreadNode | InlineFragmentNode;
  /**
   * FragmentDefinition :
   *   - fragment FragmentName on TypeCondition Directives? SelectionSet
   *
   * TypeCondition : NamedType
   */
  parseFragmentDefinition(): FragmentDefinitionNode;
  /**
   * FragmentName : Name but not `on`
   */
  parseFragmentName(): NameNode;
  /**
   * Value[Const] :
   *   - [~Const] Variable
   *   - IntValue
   *   - FloatValue
   *   - StringValue
   *   - BooleanValue
   *   - NullValue
   *   - EnumValue
   *   - ListValue[?Const]
   *   - ObjectValue[?Const]
   *
   * BooleanValue : one of `true` `false`
   *
   * NullValue : `null`
   *
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseValueLiteral(): ValueNode;
  parseStringLiteral(): StringValueNode;
  /**
   * ListValue[Const] :
   *   - [ ]
   *   - [ Value[?Const]+ ]
   */
  parseList(): ListValueNode;
  /**
   * ```
   * ObjectValue[Const] :
   *   - { }
   *   - { ObjectField[?Const]+ }
   * ```
   */
  parseObject(isConst: boolean): ObjectValueNode;
  /**
   * ObjectField[Const] : Name : Value[?Const]
   */
  parseObjectField: ObjectFieldNode;
  /**
   * Directives[Const] : Directive[?Const]+
   */
  parseDirectives(): Array<DirectiveNode>;
  /**
   * ```
   * Directive[Const] : @ Name Arguments[?Const]?
   * ```
   */
  parseDirective(): DirectiveNode;
  /**
   * Type :
   *   - NamedType
   *   - ListType
   *   - NonNullType
   */
  parseTypeReference(): TypeNode;
  /**
   * NamedType : Name
   */
  parseNamedType(): NamedTypeNode;
  peekDescription(): boolean;
  /**
   * Description : StringValue
   */
  parseDescription(): undefined | StringValueNode;
  /**
   * ```
   * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
   * ```
   */
  parseSchemaDefinition(): SchemaDefinitionNode;
  /**
   * OperationTypeDefinition : OperationType : NamedType
   */
  parseOperationTypeDefinition(): OperationTypeDefinitionNode;
  /**
   * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
   */
  parseScalarTypeDefinition(): ScalarTypeDefinitionNode;
  /**
   * ObjectTypeDefinition :
   *   Description?
   *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
   */
  parseObjectTypeDefinition(): ObjectTypeDefinitionNode;
  /**
   * ImplementsInterfaces :
   *   - implements `&`? NamedType
   *   - ImplementsInterfaces & NamedType
   */
  parseImplementsInterfaces(): Array<NamedTypeNode>;
  /**
   * ```
   * FieldsDefinition : { FieldDefinition+ }
   * ```
   */
  parseFieldsDefinition(): Array<FieldDefinitionNode>;
  /**
   * FieldDefinition :
   *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
   */
  parseFieldDefinition(): FieldDefinitionNode;
  /**
   * ArgumentsDefinition : ( InputValueDefinition+ )
   */
  parseArgumentDefs(): Array<InputValueDefinitionNode>;
  /**
   * InputValueDefinition :
   *   - Description? Name : Type DefaultValue? Directives[Const]?
   */
  parseInputValueDef(): InputValueDefinitionNode;
  /**
   * InterfaceTypeDefinition :
   *   - Description? interface Name Directives[Const]? FieldsDefinition?
   */
  parseInterfaceTypeDefinition(): InterfaceTypeDefinitionNode;
  /**
   * UnionTypeDefinition :
   *   - Description? union Name Directives[Const]? UnionMemberTypes?
   */
  parseUnionTypeDefinition(): UnionTypeDefinitionNode;
  /**
   * UnionMemberTypes :
   *   - = `|`? NamedType
   *   - UnionMemberTypes | NamedType
   */
  parseUnionMemberTypes(): Array<NamedTypeNode>;
  /**
   * EnumTypeDefinition :
   *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
   */
  parseEnumTypeDefinition(): EnumTypeDefinitionNode;
  /**
   * ```
   * EnumValuesDefinition : { EnumValueDefinition+ }
   * ```
   */
  parseEnumValuesDefinition(): Array<EnumValueDefinitionNode>;
  /**
   * EnumValueDefinition : Description? EnumValue Directives[Const]?
   */
  parseEnumValueDefinition(): EnumValueDefinitionNode;
  /**
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseEnumValueName(): NameNode;
  /**
   * InputObjectTypeDefinition :
   *   - Description? input Name Directives[Const]? InputFieldsDefinition?
   */
  parseInputObjectTypeDefinition(): InputObjectTypeDefinitionNode;
  /**
   * ```
   * InputFieldsDefinition : { InputValueDefinition+ }
   * ```
   */
  parseInputFieldsDefinition(): Array<InputValueDefinitionNode>;
  /**
   * TypeSystemExtension :
   *   - SchemaExtension
   *   - TypeExtension
   *
   * TypeExtension :
   *   - ScalarTypeExtension
   *   - ObjectTypeExtension
   *   - InterfaceTypeExtension
   *   - UnionTypeExtension
   *   - EnumTypeExtension
   *   - InputObjectTypeDefinition
   */
  parseTypeSystemExtension(): TypeSystemExtensionNode;
  /**
   * ```
   * SchemaExtension :
   *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
   *  - extend schema Directives[Const]
   * ```
   */
  parseSchemaExtension(): SchemaExtensionNode;
  /**
   * ScalarTypeExtension :
   *   - extend scalar Name Directives[Const]
   */
  parseScalarTypeExtension(): ScalarTypeExtensionNode;
  /**
   * ObjectTypeExtension :
   *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend type Name ImplementsInterfaces? Directives[Const]
   *  - extend type Name ImplementsInterfaces
   */
  parseObjectTypeExtension(): ObjectTypeExtensionNode;
  /**
   * InterfaceTypeExtension :
   *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend interface Name ImplementsInterfaces? Directives[Const]
   *  - extend interface Name ImplementsInterfaces
   */
  parseInterfaceTypeExtension(): InterfaceTypeExtensionNode;
  /**
   * UnionTypeExtension :
   *   - extend union Name Directives[Const]? UnionMemberTypes
   *   - extend union Name Directives[Const]
   */
  parseUnionTypeExtension(): UnionTypeExtensionNode;
  /**
   * EnumTypeExtension :
   *   - extend enum Name Directives[Const]? EnumValuesDefinition
   *   - extend enum Name Directives[Const]
   */
  parseEnumTypeExtension(): EnumTypeExtensionNode;
  /**
   * InputObjectTypeExtension :
   *   - extend input Name Directives[Const]? InputFieldsDefinition
   *   - extend input Name Directives[Const]
   */
  parseInputObjectTypeExtension(): InputObjectTypeExtensionNode;
  /**
   * ```
   * DirectiveDefinition :
   *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
   * ```
   */
  parseDirectiveDefinition(): DirectiveDefinitionNode;
  /**
   * DirectiveLocations :
   *   - `|`? DirectiveLocation
   *   - DirectiveLocations | DirectiveLocation
   */
  parseDirectiveLocations(): Array<NameNode>;
  parseDirectiveLocation(): NameNode;
  /**
   * Returns a location object, used to identify the place in the source that created a given parsed object.
   */
  loc(startToken: Token): Location | undefined;
  /**
   * Determines if the next token is of a given kind
   */
  peek(kind: TokenKindEnum): boolean;
  /**
   * If the next token is of the given kind, return that token after advancing the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectToken(kind: TokenKindEnum): Token;
  /**
   * If the next token is of the given kind, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalToken(kind: TokenKindEnum): boolean;
  /**
   * If the next token is a given keyword, advance the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectKeyword(value: string): void;
  /**
   * If the next token is a given keyword, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalKeyword(value: string): boolean;
  /**
   * Helper function for creating an error when an unexpected lexed token is encountered.
   */
  unexpected(atToken?: Maybe<Token>): GraphQLError;
  /**
   * Returns a possibly empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  any<T>(
    openKind: TokenKindEnum,
    parseFn: () => T,
    closeKind: TokenKindEnum,
  ): Array<T>;
  /**
   * Returns a list of parse nodes, determined by the parseFn.
   * It can be empty only if open token is missing otherwise it will always return non-empty list
   * that begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  optionalMany<T>(
    openKind: TokenKindEnum,
    parseFn: () => T,
    closeKind: TokenKindEnum,
  ): Array<T>;
  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  many<T>(
    openKind: TokenKindEnum,
    parseFn: () => T,
    closeKind: TokenKindEnum,
  ): Array<T>;
  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
   * Advances the parser to the next lex token after last item in the list.
   */
  delimitedMany<T>(delimiterKind: TokenKindEnum, parseFn: () => T): Array<T>;
}
