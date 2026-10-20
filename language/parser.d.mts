/** @category Parsing */
import type { Maybe } from "../jsutils/Maybe.mjs";
import type { GraphQLError } from "../error/GraphQLError.mjs";
import type { ArgumentNode, ConstArgumentNode, ConstDirectiveNode, ConstListValueNode, ConstObjectFieldNode, ConstObjectValueNode, ConstValueNode, DefinitionNode, DirectiveDefinitionNode, DirectiveExtensionNode, DirectiveNode, DocumentNode, EnumTypeDefinitionNode, EnumTypeExtensionNode, EnumValueDefinitionNode, FieldDefinitionNode, FieldNode, FragmentArgumentNode, FragmentDefinitionNode, FragmentSpreadNode, InlineFragmentNode, InputObjectTypeDefinitionNode, InputObjectTypeExtensionNode, InputValueDefinitionNode, InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode, ListValueNode, NamedTypeNode, NameNode, ObjectFieldNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, ObjectValueNode, OperationDefinitionNode, OperationTypeDefinitionNode, ScalarTypeDefinitionNode, ScalarTypeExtensionNode, SchemaCoordinateNode, SchemaDefinitionNode, SchemaExtensionNode, SelectionNode, SelectionSetNode, StringValueNode, Token, TypeNode, TypeSystemExtensionNode, UnionTypeDefinitionNode, UnionTypeExtensionNode, ValueNode, VariableDefinitionNode, VariableNode } from "./ast.mjs";
import { Location, OperationTypeNode } from "./ast.mjs";
import type { LexerInterface } from "./lexer.mjs";
import { Source } from "./source.mjs";
import { TokenKind } from "./tokenKind.mjs";
/** Configuration options to control parser behavior */
export interface ParseOptions {
    /**
     * By default, the parser creates AST nodes that know the location
     * in the source that they correspond to. This configuration flag
     * disables that behavior for performance or testing.
     */
    noLocation?: boolean | undefined;
    /**
     * Parser CPU and memory usage is linear to the number of lexical tokens in a document
     * however in extreme cases it becomes quadratic due to memory exhaustion.
     * Parsing happens before validation so even invalid queries can burn lots of
     * CPU time and memory.
     * To prevent this you can set a maximum number of lexical tokens allowed within a document.
     * This does not limit the length of the source text or of an individual token.
     */
    maxLexicalTokens?: number | undefined;
    /**
     * Deprecated alias for `maxLexicalTokens`.
     * @deprecated Use `maxLexicalTokens` instead. Will be removed in v18.
     */
    maxTokens?: number | undefined;
    /**
     * EXPERIMENTAL:
     *
     * If enabled, the parser will understand and parse fragment variable definitions
     * and arguments on fragment spreads. Fragment variable definitions will be represented
     * in the `variableDefinitions` field of the FragmentDefinitionNode.
     * Fragment spread arguments will be represented in the `arguments` field of FragmentSpreadNode.
     * @example
     * ```graphql prettier-ignore
     * {
     *   t { ...A(var: true) }
     * }
     * fragment A($var: Boolean = false) on T {
     *   ...B(x: $var)
     * }
     * ```
     */
    experimentalFragmentArguments?: boolean | undefined;
    /**
     * If enabled (the default), the parser accepts selection sets that contain
     * no selections, changing the grammar from `SelectionSet : { Selection+ }`
     * to `SelectionSet : { Selection* }`.
     *
     * See https://github.com/graphql/graphql-spec/pull/1227
     * @example
     * ```graphql prettier-ignore
     * {
     *   viewer { }
     * }
     * ```
     * @deprecated empty selection sets are now always allowed;
     */
    allowEmptySelectionSets?: boolean | undefined;
    /**
     * Internal parser hook for GraphQL.js entry points that need to parse a
     * restricted grammar with an alternate lexer.
     * @internal
     */
    lexer?: LexerInterface | undefined;
}
/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 * @param source - A GraphQL source string or source object.
 * @param options - Optional parser configuration.
 * @returns The parsed GraphQL document AST.
 * @example
 * ```ts
 * // Parse a GraphQL document with the default parser options.
 * import { parse } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 *
 * document.kind; // => 'Document'
 * ```
 * @example
 * ```ts
 * // This variant enables parser options and provides an explicit lexer.
 * import { Lexer, Source, parse } from 'graphql/language';
 *
 * const document = parse(
 *   `
 *     {
 *       t { ...A(var: true) }
 *     }
 *     fragment A($var: Boolean = false) on T {
 *       name
 *     }
 *   `,
 *   {
 *     experimentalFragmentArguments: true,
 *     maxLexicalTokens: 80,
 *     noLocation: true,
 *   },
 * );
 * const directiveDocument = parse('directive @foo @bar on FIELD');
 * const source = new Source('{ hero }');
 * const lexerDocument = parse(source, { lexer: new Lexer(source) });
 *
 * document.definitions[0].kind; // => 'OperationDefinition'
 * document.definitions[1].kind; // => 'FragmentDefinition'
 * document.loc; // => undefined
 * directiveDocument.definitions[0].kind; // => 'DirectiveDefinition'
 * lexerDocument.definitions[0].kind; // => 'OperationDefinition'
 * ```
 */
export declare function parse(source: string | Source, options?: ParseOptions): DocumentNode;
/**
 * Given a string containing a GraphQL value (ex. `[42]`), parse the AST for
 * that value.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 *
 * Consider providing the results to the utility function: valueFromAST().
 * @param source - A GraphQL source string or source object containing a value.
 * @param options - Optional parser configuration.
 * @returns The parsed GraphQL value AST.
 * @example
 * ```ts
 * import { parseValue } from 'graphql/language';
 *
 * const value = parseValue('[42]');
 *
 * value.kind; // => 'ListValue'
 * ```
 */
export declare function parseValue(source: string | Source, options?: ParseOptions): ValueNode;
/**
 * Similar to parseValue(), but raises a parse error if it encounters a
 * variable. The return type will be a constant value.
 * @param source - A GraphQL source string or source object containing a constant value.
 * @param options - Optional parser configuration.
 * @returns The parsed GraphQL constant value AST.
 * @example
 * ```ts
 * import { parseConstValue } from 'graphql/language';
 *
 * const value = parseConstValue('{ enabled: true }');
 *
 * value.kind; // => 'ObjectValue'
 * parseConstValue('$variable'); // throws an error
 * ```
 */
export declare function parseConstValue(source: string | Source, options?: ParseOptions): ConstValueNode;
/**
 * Given a string containing a GraphQL Type (ex. `[Int!]`), parse the AST for
 * that type.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Types directly and
 * in isolation of complete GraphQL documents.
 *
 * Consider providing the results to the utility function: typeFromAST().
 * @param source - A GraphQL source string or source object containing a type reference.
 * @param options - Optional parser configuration.
 * @returns The parsed GraphQL type AST.
 * @example
 * ```ts
 * import { parseType } from 'graphql/language';
 *
 * const type = parseType('[String!]');
 *
 * type.kind; // => 'ListType'
 * ```
 */
export declare function parseType(source: string | Source, options?: ParseOptions): TypeNode;
/**
 * Given a string containing a GraphQL Schema Coordinate (ex. `Type.field`),
 * parse the AST for that schema coordinate.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * Consider providing the results to the utility function:
 * resolveASTSchemaCoordinate(). Or calling resolveSchemaCoordinate() directly
 * with an unparsed source.
 * @param source - A GraphQL source string or source object containing a schema coordinate.
 * @returns The parsed GraphQL schema coordinate AST.
 * @example
 * ```ts
 * import { parseSchemaCoordinate } from 'graphql/language';
 *
 * const coordinate = parseSchemaCoordinate('Query.hero');
 *
 * coordinate.kind; // => 'MemberCoordinate'
 * ```
 */
export declare function parseSchemaCoordinate(source: string | Source): SchemaCoordinateNode;
/**
 * This class is exported only to assist people in implementing their own parsers
 * without duplicating too much code and should be used only as last resort for cases
 * such as experimental syntax or if certain features could not be contributed upstream.
 *
 * It is still part of the internal API and is versioned, so any changes to it are never
 * considered breaking changes. If you still need to support multiple versions of the
 * library, please use the `versionInfo` variable for version detection.
 *
 * @internal
 */
export declare class Parser {
    protected _options: Omit<ParseOptions, 'lexer'>;
    protected _lexer: LexerInterface;
    protected _tokenCounter: number;
    constructor(source: string | Source, options?: ParseOptions);
    get tokenCount(): number;
    /**
     * Converts a name lex token into a name parse node.
     *
     * @internal
     */
    parseName(): NameNode;
    /**
     * Document : Definition+
     *
     * @internal
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
     *
     * @internal
     */
    parseDefinition(): DefinitionNode;
    /**
     * OperationDefinition :
     *  - SelectionSet
     *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
     *
     * @internal
     */
    parseOperationDefinition(): OperationDefinitionNode;
    /**
     * OperationType : one of query mutation subscription
     *
     * @internal
     */
    parseOperationType(): OperationTypeNode;
    /**
     * VariableDefinitions : ( VariableDefinition+ )
     *
     * @internal
     */
    parseVariableDefinitions(): Array<VariableDefinitionNode> | undefined;
    /**
     * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
     *
     * @internal
     */
    parseVariableDefinition(): VariableDefinitionNode;
    /**
     * Variable : $ Name
     *
     * @internal
     */
    parseVariable(): VariableNode;
    /**
     * ```
     * SelectionSet : { Selection+ }
     * ```
     *
     * With `allowEmptySelectionSets` enabled (the default):
     *
     * ```
     * SelectionSet : { Selection* }
     * ```
     *
     * `allowEmptySelectionSets` is deprecated and will be removed in v18, at
     * which point this will be the only grammar.
     *
     * @internal
     */
    parseSelectionSet(): SelectionSetNode;
    /**
     * Selection :
     *   - Field
     *   - FragmentSpread
     *   - InlineFragment
     *
     * @internal
     */
    parseSelection(): SelectionNode;
    /**
     * Field : Alias? Name Arguments? Directives? SelectionSet?
     *
     * Alias : Name :
     *
     * @internal
     */
    parseField(): FieldNode;
    /**
     * Arguments[Const] : ( Argument[?Const]+ )
     *
     * @internal
     */
    parseArguments(isConst: true): Array<ConstArgumentNode> | undefined;
    parseArguments(isConst: boolean): Array<ArgumentNode> | undefined;
    parseFragmentArguments(): Array<FragmentArgumentNode> | undefined;
    /**
     * Argument[Const] : Name : Value[?Const]
     *
     * @internal
     */
    parseArgument(isConst: true): ConstArgumentNode;
    parseArgument(isConst?: boolean): ArgumentNode;
    parseConstArgument(): ConstArgumentNode;
    parseFragmentArgument(): FragmentArgumentNode;
    /**
     * Corresponds to both FragmentSpread and InlineFragment in the spec.
     *
     * FragmentSpread : ... FragmentName Arguments? Directives?
     *
     * InlineFragment : ... TypeCondition? Directives? SelectionSet
     *
     * @internal
     */
    parseFragment(): FragmentSpreadNode | InlineFragmentNode;
    /**
     * FragmentDefinition :
     *   - fragment FragmentName VariableDefinitions? on TypeCondition Directives? SelectionSet
     *
     * TypeCondition : NamedType
     *
     * @internal
     */
    parseFragmentDefinition(): FragmentDefinitionNode;
    /**
     * FragmentName : Name but not `on`
     *
     * @internal
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
     *
     * @internal
     */
    parseValueLiteral(isConst: true): ConstValueNode;
    parseValueLiteral(isConst: boolean): ValueNode;
    parseConstValueLiteral(): ConstValueNode;
    parseStringLiteral(): StringValueNode;
    /**
     * ListValue[Const] :
     *   - [ ]
     *   - [ Value[?Const]+ ]
     *
     * @internal
     */
    parseList(isConst: true): ConstListValueNode;
    parseList(isConst: boolean): ListValueNode;
    /**
     * ```
     * ObjectValue[Const] :
     *   - { }
     *   - { ObjectField[?Const]+ }
     * ```
     *
     * @internal
     */
    parseObject(isConst: true): ConstObjectValueNode;
    parseObject(isConst: boolean): ObjectValueNode;
    /**
     * ObjectField[Const] : Name : Value[?Const]
     *
     * @internal
     */
    parseObjectField(isConst: true): ConstObjectFieldNode;
    parseObjectField(isConst: boolean): ObjectFieldNode;
    /**
     * Directives[Const] : Directive[?Const]+
     *
     * @internal
     */
    parseDirectives(isConst: true): Array<ConstDirectiveNode> | undefined;
    parseDirectives(isConst: boolean): Array<DirectiveNode> | undefined;
    parseConstDirectives(): Array<ConstDirectiveNode> | undefined;
    /**
     * ```
     * Directive[Const] : @ Name Arguments[?Const]?
     * ```
     *
     * @internal
     */
    parseDirective(isConst: true): ConstDirectiveNode;
    parseDirective(isConst: boolean): DirectiveNode;
    /**
     * Type :
     *   - NamedType
     *   - ListType
     *   - NonNullType
     *
     * @internal
     */
    parseTypeReference(): TypeNode;
    /**
     * NamedType : Name
     *
     * @internal
     */
    parseNamedType(): NamedTypeNode;
    peekDescription(): boolean;
    /**
     * Description : StringValue
     *
     * @internal
     */
    parseDescription(): undefined | StringValueNode;
    /**
     * ```
     * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
     * ```
     *
     * @internal
     */
    parseSchemaDefinition(): SchemaDefinitionNode;
    /**
     * OperationTypeDefinition : OperationType : NamedType
     *
     * @internal
     */
    parseOperationTypeDefinition(): OperationTypeDefinitionNode;
    /**
     * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
     *
     * @internal
     */
    parseScalarTypeDefinition(): ScalarTypeDefinitionNode;
    /**
     * ObjectTypeDefinition :
     *   Description?
     *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
     *
     * @internal
     */
    parseObjectTypeDefinition(): ObjectTypeDefinitionNode;
    /**
     * ImplementsInterfaces :
     *   - implements `&`? NamedType
     *   - ImplementsInterfaces & NamedType
     *
     * @internal
     */
    parseImplementsInterfaces(): Array<NamedTypeNode> | undefined;
    /**
     * ```
     * FieldsDefinition : { FieldDefinition+ }
     * ```
     *
     * @internal
     */
    parseFieldsDefinition(): Array<FieldDefinitionNode> | undefined;
    /**
     * FieldDefinition :
     *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
     *
     * @internal
     */
    parseFieldDefinition(): FieldDefinitionNode;
    /**
     * ArgumentsDefinition : ( InputValueDefinition+ )
     *
     * @internal
     */
    parseArgumentDefs(): Array<InputValueDefinitionNode> | undefined;
    /**
     * InputValueDefinition :
     *   - Description? Name : Type DefaultValue? Directives[Const]?
     *
     * @internal
     */
    parseInputValueDef(): InputValueDefinitionNode;
    /**
     * InterfaceTypeDefinition :
     *   - Description? interface Name Directives[Const]? FieldsDefinition?
     *
     * @internal
     */
    parseInterfaceTypeDefinition(): InterfaceTypeDefinitionNode;
    /**
     * UnionTypeDefinition :
     *   - Description? union Name Directives[Const]? UnionMemberTypes?
     *
     * @internal
     */
    parseUnionTypeDefinition(): UnionTypeDefinitionNode;
    /**
     * UnionMemberTypes :
     *   - = `|`? NamedType
     *   - UnionMemberTypes | NamedType
     *
     * @internal
     */
    parseUnionMemberTypes(): Array<NamedTypeNode> | undefined;
    /**
     * EnumTypeDefinition :
     *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
     *
     * @internal
     */
    parseEnumTypeDefinition(): EnumTypeDefinitionNode;
    /**
     * ```
     * EnumValuesDefinition : { EnumValueDefinition+ }
     * ```
     *
     * @internal
     */
    parseEnumValuesDefinition(): Array<EnumValueDefinitionNode> | undefined;
    /**
     * EnumValueDefinition : Description? EnumValue Directives[Const]?
     *
     * @internal
     */
    parseEnumValueDefinition(): EnumValueDefinitionNode;
    /**
     * EnumValue : Name but not `true`, `false` or `null`
     *
     * @internal
     */
    parseEnumValueName(): NameNode;
    /**
     * InputObjectTypeDefinition :
     *   - Description? input Name Directives[Const]? InputFieldsDefinition?
     *
     * @internal
     */
    parseInputObjectTypeDefinition(): InputObjectTypeDefinitionNode;
    /**
     * ```
     * InputFieldsDefinition : { InputValueDefinition+ }
     * ```
     *
     * @internal
     */
    parseInputFieldsDefinition(): Array<InputValueDefinitionNode> | undefined;
    /**
     * TypeSystemExtension :
     *   - SchemaExtension
     *   - TypeExtension
     *   - DirectiveExtension
     *
     * TypeExtension :
     *   - ScalarTypeExtension
     *   - ObjectTypeExtension
     *   - InterfaceTypeExtension
     *   - UnionTypeExtension
     *   - EnumTypeExtension
     *   - InputObjectTypeExtension
     *
     * @internal
     */
    parseTypeSystemExtension(): TypeSystemExtensionNode;
    /**
     * ```
     * SchemaExtension :
     *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
     *  - extend schema Directives[Const]
     * ```
     *
     * @internal
     */
    parseSchemaExtension(): SchemaExtensionNode;
    /**
     * ScalarTypeExtension :
     *   - extend scalar Name Directives[Const]
     *
     * @internal
     */
    parseScalarTypeExtension(): ScalarTypeExtensionNode;
    /**
     * ObjectTypeExtension :
     *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
     *  - extend type Name ImplementsInterfaces? Directives[Const]
     *  - extend type Name ImplementsInterfaces
     *
     * @internal
     */
    parseObjectTypeExtension(): ObjectTypeExtensionNode;
    /**
     * InterfaceTypeExtension :
     *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
     *  - extend interface Name ImplementsInterfaces? Directives[Const]
     *  - extend interface Name ImplementsInterfaces
     *
     * @internal
     */
    parseInterfaceTypeExtension(): InterfaceTypeExtensionNode;
    /**
     * UnionTypeExtension :
     *   - extend union Name Directives[Const]? UnionMemberTypes
     *   - extend union Name Directives[Const]
     *
     * @internal
     */
    parseUnionTypeExtension(): UnionTypeExtensionNode;
    /**
     * EnumTypeExtension :
     *   - extend enum Name Directives[Const]? EnumValuesDefinition
     *   - extend enum Name Directives[Const]
     *
     * @internal
     */
    parseEnumTypeExtension(): EnumTypeExtensionNode;
    /**
     * InputObjectTypeExtension :
     *   - extend input Name Directives[Const]? InputFieldsDefinition
     *   - extend input Name Directives[Const]
     *
     * @internal
     */
    parseInputObjectTypeExtension(): InputObjectTypeExtensionNode;
    parseDirectiveExtension(): DirectiveExtensionNode;
    /**
     * ```
     * DirectiveDefinition :
     *   - Description? directive @ Name ArgumentsDefinition? Directives[Const]? `repeatable`? on DirectiveLocations
     * ```
     *
     * @internal
     */
    parseDirectiveDefinition(): DirectiveDefinitionNode;
    /**
     * DirectiveLocations :
     *   - `|`? DirectiveLocation
     *   - DirectiveLocations | DirectiveLocation
     *
     * @internal
     */
    parseDirectiveLocations(): Array<NameNode>;
    parseDirectiveLocation(): NameNode;
    /**
     * SchemaCoordinate :
     *   - Name
     *   - Name . Name
     *   - Name . Name ( Name : )
     *   - @ Name
     *   - @ Name ( Name : )
     *
     * @internal
     */
    parseSchemaCoordinate(): SchemaCoordinateNode;
    /**
     * Returns a node that, if configured to do so, sets a "loc" field as a
     * location object, used to identify the place in the source that created a
     * given parsed object.
     *
     * @internal
     */
    node<T extends {
        loc?: Location | undefined;
    }>(startToken: Token, node: T): T;
    /**
     * Determines if the next token is of a given kind
     *
     * @internal
     */
    peek(kind: TokenKind): boolean;
    /**
     * If the next token is of the given kind, return that token after advancing the lexer.
     * Otherwise, do not change the parser state and throw an error.
     *
     * @internal
     */
    expectToken(kind: TokenKind): Token;
    /**
     * If the next token is of the given kind, return "true" after advancing the lexer.
     * Otherwise, do not change the parser state and return "false".
     *
     * @internal
     */
    expectOptionalToken(kind: TokenKind): boolean;
    /**
     * If the next token is a given keyword, advance the lexer.
     * Otherwise, do not change the parser state and throw an error.
     *
     * @internal
     */
    expectKeyword(value: string): void;
    /**
     * If the next token is a given keyword, return "true" after advancing the lexer.
     * Otherwise, do not change the parser state and return "false".
     *
     * @internal
     */
    expectOptionalKeyword(value: string): boolean;
    /**
     * Helper function for creating an error when an unexpected lexed token is encountered.
     *
     * @internal
     */
    unexpected(atToken?: Maybe<Token>): GraphQLError;
    /**
     * Returns a possibly empty list of parse nodes, determined by the parseFn.
     * This list begins with a lex token of openKind and ends with a lex token of closeKind.
     * Advances the parser to the next lex token after the closing token.
     *
     * @internal
     */
    any<T>(openKind: TokenKind, parseFn: () => T, closeKind: TokenKind): Array<T>;
    /**
     * Returns a list of parse nodes, determined by the parseFn.
     * It can be empty only if open token is missing otherwise it will always return non-empty list
     * that begins with a lex token of openKind and ends with a lex token of closeKind.
     * Advances the parser to the next lex token after the closing token.
     *
     * @internal
     */
    optionalMany<T>(openKind: TokenKind, parseFn: () => T, closeKind: TokenKind): Array<T> | undefined;
    /**
     * Returns a non-empty list of parse nodes, determined by the parseFn.
     * This list begins with a lex token of openKind and ends with a lex token of closeKind.
     * Advances the parser to the next lex token after the closing token.
     *
     * @internal
     */
    many<T>(openKind: TokenKind, parseFn: () => T, closeKind: TokenKind): Array<T>;
    /**
     * Returns a non-empty list of parse nodes, determined by the parseFn.
     * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
     * Advances the parser to the next lex token after last item in the list.
     *
     * @internal
     */
    delimitedMany<T>(delimiterKind: TokenKind, parseFn: () => T): Array<T>;
    advanceLexer(): void;
}
