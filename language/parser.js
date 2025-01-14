"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
exports.parse = parse;
exports.parseValue = parseValue;
exports.parseConstValue = parseConstValue;
exports.parseType = parseType;
const syntaxError_js_1 = require("../error/syntaxError.js");
const ast_js_1 = require("./ast.js");
const directiveLocation_js_1 = require("./directiveLocation.js");
const kinds_js_1 = require("./kinds.js");
const lexer_js_1 = require("./lexer.js");
const source_js_1 = require("./source.js");
const tokenKind_js_1 = require("./tokenKind.js");
/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */
function parse(source, options) {
    const parser = new Parser(source, options);
    const document = parser.parseDocument();
    Object.defineProperty(document, 'tokenCount', {
        enumerable: false,
        value: parser.tokenCount,
    });
    return document;
}
/**
 * Given a string containing a GraphQL value (ex. `[42]`), parse the AST for
 * that value.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 */
function parseValue(source, options) {
    const parser = new Parser(source, options);
    parser.expectToken(tokenKind_js_1.TokenKind.SOF);
    const value = parser.parseValueLiteral(false);
    parser.expectToken(tokenKind_js_1.TokenKind.EOF);
    return value;
}
/**
 * Similar to parseValue(), but raises a parse error if it encounters a
 * variable. The return type will be a constant value.
 */
function parseConstValue(source, options) {
    const parser = new Parser(source, options);
    parser.expectToken(tokenKind_js_1.TokenKind.SOF);
    const value = parser.parseConstValueLiteral();
    parser.expectToken(tokenKind_js_1.TokenKind.EOF);
    return value;
}
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
function parseType(source, options) {
    const parser = new Parser(source, options);
    parser.expectToken(tokenKind_js_1.TokenKind.SOF);
    const type = parser.parseTypeReference();
    parser.expectToken(tokenKind_js_1.TokenKind.EOF);
    return type;
}
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
class Parser {
    constructor(source, options = {}) {
        const sourceObj = (0, source_js_1.isSource)(source) ? source : new source_js_1.Source(source);
        this._lexer = new lexer_js_1.Lexer(sourceObj);
        this._options = options;
        this._tokenCounter = 0;
    }
    get tokenCount() {
        return this._tokenCounter;
    }
    /**
     * Converts a name lex token into a name parse node.
     */
    parseName() {
        const token = this.expectToken(tokenKind_js_1.TokenKind.NAME);
        return this.node(token, {
            kind: kinds_js_1.Kind.NAME,
            value: token.value,
        });
    }
    // Implements the parsing rules in the Document section.
    /**
     * Document : Definition+
     */
    parseDocument() {
        return this.node(this._lexer.token, {
            kind: kinds_js_1.Kind.DOCUMENT,
            definitions: this.many(tokenKind_js_1.TokenKind.SOF, this.parseDefinition, tokenKind_js_1.TokenKind.EOF),
        });
    }
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
    parseDefinition() {
        if (this.peek(tokenKind_js_1.TokenKind.BRACE_L)) {
            return this.parseOperationDefinition();
        }
        // Many definitions begin with a description and require a lookahead.
        const hasDescription = this.peekDescription();
        const keywordToken = hasDescription
            ? this._lexer.lookahead()
            : this._lexer.token;
        if (keywordToken.kind === tokenKind_js_1.TokenKind.NAME) {
            switch (keywordToken.value) {
                case 'schema':
                    return this.parseSchemaDefinition();
                case 'scalar':
                    return this.parseScalarTypeDefinition();
                case 'type':
                    return this.parseObjectTypeDefinition();
                case 'interface':
                    return this.parseInterfaceTypeDefinition();
                case 'union':
                    return this.parseUnionTypeDefinition();
                case 'enum':
                    return this.parseEnumTypeDefinition();
                case 'input':
                    return this.parseInputObjectTypeDefinition();
                case 'directive':
                    return this.parseDirectiveDefinition();
            }
            if (hasDescription) {
                throw (0, syntaxError_js_1.syntaxError)(this._lexer.source, this._lexer.token.start, 'Unexpected description, descriptions are supported only on type definitions.');
            }
            switch (keywordToken.value) {
                case 'query':
                case 'mutation':
                case 'subscription':
                    return this.parseOperationDefinition();
                case 'fragment':
                    return this.parseFragmentDefinition();
                case 'extend':
                    return this.parseTypeSystemExtension();
            }
        }
        throw this.unexpected(keywordToken);
    }
    // Implements the parsing rules in the Operations section.
    /**
     * OperationDefinition :
     *  - SelectionSet
     *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
     */
    parseOperationDefinition() {
        const start = this._lexer.token;
        if (this.peek(tokenKind_js_1.TokenKind.BRACE_L)) {
            return this.node(start, {
                kind: kinds_js_1.Kind.OPERATION_DEFINITION,
                operation: ast_js_1.OperationTypeNode.QUERY,
                name: undefined,
                variableDefinitions: undefined,
                directives: undefined,
                selectionSet: this.parseSelectionSet(),
            });
        }
        const operation = this.parseOperationType();
        let name;
        if (this.peek(tokenKind_js_1.TokenKind.NAME)) {
            name = this.parseName();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.OPERATION_DEFINITION,
            operation,
            name,
            variableDefinitions: this.parseVariableDefinitions(),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
        });
    }
    /**
     * OperationType : one of query mutation subscription
     */
    parseOperationType() {
        const operationToken = this.expectToken(tokenKind_js_1.TokenKind.NAME);
        switch (operationToken.value) {
            case 'query':
                return ast_js_1.OperationTypeNode.QUERY;
            case 'mutation':
                return ast_js_1.OperationTypeNode.MUTATION;
            case 'subscription':
                return ast_js_1.OperationTypeNode.SUBSCRIPTION;
        }
        throw this.unexpected(operationToken);
    }
    /**
     * VariableDefinitions : ( VariableDefinition+ )
     */
    parseVariableDefinitions() {
        return this.optionalMany(tokenKind_js_1.TokenKind.PAREN_L, this.parseVariableDefinition, tokenKind_js_1.TokenKind.PAREN_R);
    }
    /**
     * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
     */
    parseVariableDefinition() {
        return this.node(this._lexer.token, {
            kind: kinds_js_1.Kind.VARIABLE_DEFINITION,
            variable: this.parseVariable(),
            type: (this.expectToken(tokenKind_js_1.TokenKind.COLON), this.parseTypeReference()),
            defaultValue: this.expectOptionalToken(tokenKind_js_1.TokenKind.EQUALS)
                ? this.parseConstValueLiteral()
                : undefined,
            directives: this.parseConstDirectives(),
        });
    }
    /**
     * Variable : $ Name
     */
    parseVariable() {
        const start = this._lexer.token;
        this.expectToken(tokenKind_js_1.TokenKind.DOLLAR);
        return this.node(start, {
            kind: kinds_js_1.Kind.VARIABLE,
            name: this.parseName(),
        });
    }
    /**
     * ```
     * SelectionSet : { Selection+ }
     * ```
     */
    parseSelectionSet() {
        return this.node(this._lexer.token, {
            kind: kinds_js_1.Kind.SELECTION_SET,
            selections: this.many(tokenKind_js_1.TokenKind.BRACE_L, this.parseSelection, tokenKind_js_1.TokenKind.BRACE_R),
        });
    }
    /**
     * Selection :
     *   - Field
     *   - FragmentSpread
     *   - InlineFragment
     */
    parseSelection() {
        return this.peek(tokenKind_js_1.TokenKind.SPREAD)
            ? this.parseFragment()
            : this.parseField();
    }
    /**
     * Field : Alias? Name Arguments? Directives? SelectionSet?
     *
     * Alias : Name :
     */
    parseField() {
        const start = this._lexer.token;
        const nameOrAlias = this.parseName();
        let alias;
        let name;
        if (this.expectOptionalToken(tokenKind_js_1.TokenKind.COLON)) {
            alias = nameOrAlias;
            name = this.parseName();
        }
        else {
            name = nameOrAlias;
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.FIELD,
            alias,
            name,
            arguments: this.parseArguments(false),
            directives: this.parseDirectives(false),
            selectionSet: this.peek(tokenKind_js_1.TokenKind.BRACE_L)
                ? this.parseSelectionSet()
                : undefined,
        });
    }
    parseArguments(isConst) {
        const item = isConst ? this.parseConstArgument : this.parseArgument;
        return this.optionalMany(tokenKind_js_1.TokenKind.PAREN_L, item, tokenKind_js_1.TokenKind.PAREN_R);
    }
    /* experimental */
    parseFragmentArguments() {
        const item = this.parseFragmentArgument;
        return this.optionalMany(tokenKind_js_1.TokenKind.PAREN_L, item, tokenKind_js_1.TokenKind.PAREN_R);
    }
    parseArgument(isConst = false) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(tokenKind_js_1.TokenKind.COLON);
        return this.node(start, {
            kind: kinds_js_1.Kind.ARGUMENT,
            name,
            value: this.parseValueLiteral(isConst),
        });
    }
    parseConstArgument() {
        return this.parseArgument(true);
    }
    /* experimental */
    parseFragmentArgument() {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(tokenKind_js_1.TokenKind.COLON);
        return this.node(start, {
            kind: kinds_js_1.Kind.FRAGMENT_ARGUMENT,
            name,
            value: this.parseValueLiteral(false),
        });
    }
    // Implements the parsing rules in the Fragments section.
    /**
     * Corresponds to both FragmentSpread and InlineFragment in the spec.
     *
     * FragmentSpread : ... FragmentName Arguments? Directives?
     *
     * InlineFragment : ... TypeCondition? Directives? SelectionSet
     */
    parseFragment() {
        const start = this._lexer.token;
        this.expectToken(tokenKind_js_1.TokenKind.SPREAD);
        const hasTypeCondition = this.expectOptionalKeyword('on');
        if (!hasTypeCondition && this.peek(tokenKind_js_1.TokenKind.NAME)) {
            const name = this.parseFragmentName();
            if (this.peek(tokenKind_js_1.TokenKind.PAREN_L) &&
                this._options.experimentalFragmentArguments) {
                return this.node(start, {
                    kind: kinds_js_1.Kind.FRAGMENT_SPREAD,
                    name,
                    arguments: this.parseFragmentArguments(),
                    directives: this.parseDirectives(false),
                });
            }
            return this.node(start, {
                kind: kinds_js_1.Kind.FRAGMENT_SPREAD,
                name,
                directives: this.parseDirectives(false),
            });
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.INLINE_FRAGMENT,
            typeCondition: hasTypeCondition ? this.parseNamedType() : undefined,
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
        });
    }
    /**
     * FragmentDefinition :
     *   - fragment FragmentName VariableDefinitions? on TypeCondition Directives? SelectionSet
     *
     * TypeCondition : NamedType
     */
    parseFragmentDefinition() {
        const start = this._lexer.token;
        this.expectKeyword('fragment');
        if (this._options.experimentalFragmentArguments === true) {
            return this.node(start, {
                kind: kinds_js_1.Kind.FRAGMENT_DEFINITION,
                name: this.parseFragmentName(),
                variableDefinitions: this.parseVariableDefinitions(),
                typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
                directives: this.parseDirectives(false),
                selectionSet: this.parseSelectionSet(),
            });
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.FRAGMENT_DEFINITION,
            name: this.parseFragmentName(),
            typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
        });
    }
    /**
     * FragmentName : Name but not `on`
     */
    parseFragmentName() {
        if (this._lexer.token.value === 'on') {
            throw this.unexpected();
        }
        return this.parseName();
    }
    parseValueLiteral(isConst) {
        const token = this._lexer.token;
        switch (token.kind) {
            case tokenKind_js_1.TokenKind.BRACKET_L:
                return this.parseList(isConst);
            case tokenKind_js_1.TokenKind.BRACE_L:
                return this.parseObject(isConst);
            case tokenKind_js_1.TokenKind.INT:
                this.advanceLexer();
                return this.node(token, {
                    kind: kinds_js_1.Kind.INT,
                    value: token.value,
                });
            case tokenKind_js_1.TokenKind.FLOAT:
                this.advanceLexer();
                return this.node(token, {
                    kind: kinds_js_1.Kind.FLOAT,
                    value: token.value,
                });
            case tokenKind_js_1.TokenKind.STRING:
            case tokenKind_js_1.TokenKind.BLOCK_STRING:
                return this.parseStringLiteral();
            case tokenKind_js_1.TokenKind.NAME:
                this.advanceLexer();
                switch (token.value) {
                    case 'true':
                        return this.node(token, {
                            kind: kinds_js_1.Kind.BOOLEAN,
                            value: true,
                        });
                    case 'false':
                        return this.node(token, {
                            kind: kinds_js_1.Kind.BOOLEAN,
                            value: false,
                        });
                    case 'null':
                        return this.node(token, { kind: kinds_js_1.Kind.NULL });
                    default:
                        return this.node(token, {
                            kind: kinds_js_1.Kind.ENUM,
                            value: token.value,
                        });
                }
            case tokenKind_js_1.TokenKind.DOLLAR:
                if (isConst) {
                    this.expectToken(tokenKind_js_1.TokenKind.DOLLAR);
                    if (this._lexer.token.kind === tokenKind_js_1.TokenKind.NAME) {
                        const varName = this._lexer.token.value;
                        throw (0, syntaxError_js_1.syntaxError)(this._lexer.source, token.start, `Unexpected variable "$${varName}" in constant value.`);
                    }
                    else {
                        throw this.unexpected(token);
                    }
                }
                return this.parseVariable();
            default:
                throw this.unexpected();
        }
    }
    parseConstValueLiteral() {
        return this.parseValueLiteral(true);
    }
    parseStringLiteral() {
        const token = this._lexer.token;
        this.advanceLexer();
        return this.node(token, {
            kind: kinds_js_1.Kind.STRING,
            value: token.value,
            block: token.kind === tokenKind_js_1.TokenKind.BLOCK_STRING,
        });
    }
    parseList(isConst) {
        const item = () => this.parseValueLiteral(isConst);
        return this.node(this._lexer.token, {
            kind: kinds_js_1.Kind.LIST,
            values: this.any(tokenKind_js_1.TokenKind.BRACKET_L, item, tokenKind_js_1.TokenKind.BRACKET_R),
        });
    }
    parseObject(isConst) {
        const item = () => this.parseObjectField(isConst);
        return this.node(this._lexer.token, {
            kind: kinds_js_1.Kind.OBJECT,
            fields: this.any(tokenKind_js_1.TokenKind.BRACE_L, item, tokenKind_js_1.TokenKind.BRACE_R),
        });
    }
    parseObjectField(isConst) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(tokenKind_js_1.TokenKind.COLON);
        return this.node(start, {
            kind: kinds_js_1.Kind.OBJECT_FIELD,
            name,
            value: this.parseValueLiteral(isConst),
        });
    }
    parseDirectives(isConst) {
        const directives = [];
        while (this.peek(tokenKind_js_1.TokenKind.AT)) {
            directives.push(this.parseDirective(isConst));
        }
        if (directives.length) {
            return directives;
        }
        return undefined;
    }
    parseConstDirectives() {
        return this.parseDirectives(true);
    }
    parseDirective(isConst) {
        const start = this._lexer.token;
        this.expectToken(tokenKind_js_1.TokenKind.AT);
        return this.node(start, {
            kind: kinds_js_1.Kind.DIRECTIVE,
            name: this.parseName(),
            arguments: this.parseArguments(isConst),
        });
    }
    // Implements the parsing rules in the Types section.
    /**
     * Type :
     *   - NamedType
     *   - ListType
     *   - NonNullType
     */
    parseTypeReference() {
        const start = this._lexer.token;
        let type;
        if (this.expectOptionalToken(tokenKind_js_1.TokenKind.BRACKET_L)) {
            const innerType = this.parseTypeReference();
            this.expectToken(tokenKind_js_1.TokenKind.BRACKET_R);
            type = this.node(start, {
                kind: kinds_js_1.Kind.LIST_TYPE,
                type: innerType,
            });
        }
        else {
            type = this.parseNamedType();
        }
        if (this.expectOptionalToken(tokenKind_js_1.TokenKind.BANG)) {
            return this.node(start, {
                kind: kinds_js_1.Kind.NON_NULL_TYPE,
                type,
            });
        }
        return type;
    }
    /**
     * NamedType : Name
     */
    parseNamedType() {
        return this.node(this._lexer.token, {
            kind: kinds_js_1.Kind.NAMED_TYPE,
            name: this.parseName(),
        });
    }
    // Implements the parsing rules in the Type Definition section.
    peekDescription() {
        return this.peek(tokenKind_js_1.TokenKind.STRING) || this.peek(tokenKind_js_1.TokenKind.BLOCK_STRING);
    }
    /**
     * Description : StringValue
     */
    parseDescription() {
        if (this.peekDescription()) {
            return this.parseStringLiteral();
        }
    }
    /**
     * ```
     * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
     * ```
     */
    parseSchemaDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('schema');
        const directives = this.parseConstDirectives();
        const operationTypes = this.many(tokenKind_js_1.TokenKind.BRACE_L, this.parseOperationTypeDefinition, tokenKind_js_1.TokenKind.BRACE_R);
        return this.node(start, {
            kind: kinds_js_1.Kind.SCHEMA_DEFINITION,
            description,
            directives,
            operationTypes,
        });
    }
    /**
     * OperationTypeDefinition : OperationType : NamedType
     */
    parseOperationTypeDefinition() {
        const start = this._lexer.token;
        const operation = this.parseOperationType();
        this.expectToken(tokenKind_js_1.TokenKind.COLON);
        const type = this.parseNamedType();
        return this.node(start, {
            kind: kinds_js_1.Kind.OPERATION_TYPE_DEFINITION,
            operation,
            type,
        });
    }
    /**
     * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
     */
    parseScalarTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('scalar');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_js_1.Kind.SCALAR_TYPE_DEFINITION,
            description,
            name,
            directives,
        });
    }
    /**
     * ObjectTypeDefinition :
     *   Description?
     *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
     */
    parseObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('type');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        return this.node(start, {
            kind: kinds_js_1.Kind.OBJECT_TYPE_DEFINITION,
            description,
            name,
            interfaces,
            directives,
            fields,
        });
    }
    /**
     * ImplementsInterfaces :
     *   - implements `&`? NamedType
     *   - ImplementsInterfaces & NamedType
     */
    parseImplementsInterfaces() {
        return this.expectOptionalKeyword('implements')
            ? this.delimitedMany(tokenKind_js_1.TokenKind.AMP, this.parseNamedType)
            : undefined;
    }
    /**
     * ```
     * FieldsDefinition : { FieldDefinition+ }
     * ```
     */
    parseFieldsDefinition() {
        return this.optionalMany(tokenKind_js_1.TokenKind.BRACE_L, this.parseFieldDefinition, tokenKind_js_1.TokenKind.BRACE_R);
    }
    /**
     * FieldDefinition :
     *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
     */
    parseFieldDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        this.expectToken(tokenKind_js_1.TokenKind.COLON);
        const type = this.parseTypeReference();
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_js_1.Kind.FIELD_DEFINITION,
            description,
            name,
            arguments: args,
            type,
            directives,
        });
    }
    /**
     * ArgumentsDefinition : ( InputValueDefinition+ )
     */
    parseArgumentDefs() {
        return this.optionalMany(tokenKind_js_1.TokenKind.PAREN_L, this.parseInputValueDef, tokenKind_js_1.TokenKind.PAREN_R);
    }
    /**
     * InputValueDefinition :
     *   - Description? Name : Type DefaultValue? Directives[Const]?
     */
    parseInputValueDef() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        this.expectToken(tokenKind_js_1.TokenKind.COLON);
        const type = this.parseTypeReference();
        let defaultValue;
        if (this.expectOptionalToken(tokenKind_js_1.TokenKind.EQUALS)) {
            defaultValue = this.parseConstValueLiteral();
        }
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_js_1.Kind.INPUT_VALUE_DEFINITION,
            description,
            name,
            type,
            defaultValue,
            directives,
        });
    }
    /**
     * InterfaceTypeDefinition :
     *   - Description? interface Name Directives[Const]? FieldsDefinition?
     */
    parseInterfaceTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('interface');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        return this.node(start, {
            kind: kinds_js_1.Kind.INTERFACE_TYPE_DEFINITION,
            description,
            name,
            interfaces,
            directives,
            fields,
        });
    }
    /**
     * UnionTypeDefinition :
     *   - Description? union Name Directives[Const]? UnionMemberTypes?
     */
    parseUnionTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('union');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const types = this.parseUnionMemberTypes();
        return this.node(start, {
            kind: kinds_js_1.Kind.UNION_TYPE_DEFINITION,
            description,
            name,
            directives,
            types,
        });
    }
    /**
     * UnionMemberTypes :
     *   - = `|`? NamedType
     *   - UnionMemberTypes | NamedType
     */
    parseUnionMemberTypes() {
        return this.expectOptionalToken(tokenKind_js_1.TokenKind.EQUALS)
            ? this.delimitedMany(tokenKind_js_1.TokenKind.PIPE, this.parseNamedType)
            : undefined;
    }
    /**
     * EnumTypeDefinition :
     *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
     */
    parseEnumTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('enum');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const values = this.parseEnumValuesDefinition();
        return this.node(start, {
            kind: kinds_js_1.Kind.ENUM_TYPE_DEFINITION,
            description,
            name,
            directives,
            values,
        });
    }
    /**
     * ```
     * EnumValuesDefinition : { EnumValueDefinition+ }
     * ```
     */
    parseEnumValuesDefinition() {
        return this.optionalMany(tokenKind_js_1.TokenKind.BRACE_L, this.parseEnumValueDefinition, tokenKind_js_1.TokenKind.BRACE_R);
    }
    /**
     * EnumValueDefinition : Description? EnumValue Directives[Const]?
     */
    parseEnumValueDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseEnumValueName();
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_js_1.Kind.ENUM_VALUE_DEFINITION,
            description,
            name,
            directives,
        });
    }
    /**
     * EnumValue : Name but not `true`, `false` or `null`
     */
    parseEnumValueName() {
        if (this._lexer.token.value === 'true' ||
            this._lexer.token.value === 'false' ||
            this._lexer.token.value === 'null') {
            throw (0, syntaxError_js_1.syntaxError)(this._lexer.source, this._lexer.token.start, `${getTokenDesc(this._lexer.token)} is reserved and cannot be used for an enum value.`);
        }
        return this.parseName();
    }
    /**
     * InputObjectTypeDefinition :
     *   - Description? input Name Directives[Const]? InputFieldsDefinition?
     */
    parseInputObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('input');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const fields = this.parseInputFieldsDefinition();
        return this.node(start, {
            kind: kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION,
            description,
            name,
            directives,
            fields,
        });
    }
    /**
     * ```
     * InputFieldsDefinition : { InputValueDefinition+ }
     * ```
     */
    parseInputFieldsDefinition() {
        return this.optionalMany(tokenKind_js_1.TokenKind.BRACE_L, this.parseInputValueDef, tokenKind_js_1.TokenKind.BRACE_R);
    }
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
    parseTypeSystemExtension() {
        const keywordToken = this._lexer.lookahead();
        if (keywordToken.kind === tokenKind_js_1.TokenKind.NAME) {
            switch (keywordToken.value) {
                case 'schema':
                    return this.parseSchemaExtension();
                case 'scalar':
                    return this.parseScalarTypeExtension();
                case 'type':
                    return this.parseObjectTypeExtension();
                case 'interface':
                    return this.parseInterfaceTypeExtension();
                case 'union':
                    return this.parseUnionTypeExtension();
                case 'enum':
                    return this.parseEnumTypeExtension();
                case 'input':
                    return this.parseInputObjectTypeExtension();
            }
        }
        throw this.unexpected(keywordToken);
    }
    /**
     * ```
     * SchemaExtension :
     *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
     *  - extend schema Directives[Const]
     * ```
     */
    parseSchemaExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('schema');
        const directives = this.parseConstDirectives();
        const operationTypes = this.optionalMany(tokenKind_js_1.TokenKind.BRACE_L, this.parseOperationTypeDefinition, tokenKind_js_1.TokenKind.BRACE_R);
        if (directives === undefined && operationTypes === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.SCHEMA_EXTENSION,
            directives,
            operationTypes,
        });
    }
    /**
     * ScalarTypeExtension :
     *   - extend scalar Name Directives[Const]
     */
    parseScalarTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('scalar');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        if (directives === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.SCALAR_TYPE_EXTENSION,
            name,
            directives,
        });
    }
    /**
     * ObjectTypeExtension :
     *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
     *  - extend type Name ImplementsInterfaces? Directives[Const]
     *  - extend type Name ImplementsInterfaces
     */
    parseObjectTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('type');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        if (interfaces === undefined &&
            directives === undefined &&
            fields === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.OBJECT_TYPE_EXTENSION,
            name,
            interfaces,
            directives,
            fields,
        });
    }
    /**
     * InterfaceTypeExtension :
     *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
     *  - extend interface Name ImplementsInterfaces? Directives[Const]
     *  - extend interface Name ImplementsInterfaces
     */
    parseInterfaceTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('interface');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        if (interfaces === undefined &&
            directives === undefined &&
            fields === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION,
            name,
            interfaces,
            directives,
            fields,
        });
    }
    /**
     * UnionTypeExtension :
     *   - extend union Name Directives[Const]? UnionMemberTypes
     *   - extend union Name Directives[Const]
     */
    parseUnionTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('union');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const types = this.parseUnionMemberTypes();
        if (directives === undefined && types === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.UNION_TYPE_EXTENSION,
            name,
            directives,
            types,
        });
    }
    /**
     * EnumTypeExtension :
     *   - extend enum Name Directives[Const]? EnumValuesDefinition
     *   - extend enum Name Directives[Const]
     */
    parseEnumTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('enum');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const values = this.parseEnumValuesDefinition();
        if (directives === undefined && values === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.ENUM_TYPE_EXTENSION,
            name,
            directives,
            values,
        });
    }
    /**
     * InputObjectTypeExtension :
     *   - extend input Name Directives[Const]? InputFieldsDefinition
     *   - extend input Name Directives[Const]
     */
    parseInputObjectTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('input');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const fields = this.parseInputFieldsDefinition();
        if (directives === undefined && fields === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION,
            name,
            directives,
            fields,
        });
    }
    /**
     * ```
     * DirectiveDefinition :
     *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
     * ```
     */
    parseDirectiveDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('directive');
        this.expectToken(tokenKind_js_1.TokenKind.AT);
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        const repeatable = this.expectOptionalKeyword('repeatable');
        this.expectKeyword('on');
        const locations = this.parseDirectiveLocations();
        return this.node(start, {
            kind: kinds_js_1.Kind.DIRECTIVE_DEFINITION,
            description,
            name,
            arguments: args,
            repeatable,
            locations,
        });
    }
    /**
     * DirectiveLocations :
     *   - `|`? DirectiveLocation
     *   - DirectiveLocations | DirectiveLocation
     */
    parseDirectiveLocations() {
        return this.delimitedMany(tokenKind_js_1.TokenKind.PIPE, this.parseDirectiveLocation);
    }
    /*
     * DirectiveLocation :
     *   - ExecutableDirectiveLocation
     *   - TypeSystemDirectiveLocation
     *
     * ExecutableDirectiveLocation : one of
     *   `QUERY`
     *   `MUTATION`
     *   `SUBSCRIPTION`
     *   `FIELD`
     *   `FRAGMENT_DEFINITION`
     *   `FRAGMENT_SPREAD`
     *   `INLINE_FRAGMENT`
     *
     * TypeSystemDirectiveLocation : one of
     *   `SCHEMA`
     *   `SCALAR`
     *   `OBJECT`
     *   `FIELD_DEFINITION`
     *   `ARGUMENT_DEFINITION`
     *   `INTERFACE`
     *   `UNION`
     *   `ENUM`
     *   `ENUM_VALUE`
     *   `INPUT_OBJECT`
     *   `INPUT_FIELD_DEFINITION`
     */
    parseDirectiveLocation() {
        const start = this._lexer.token;
        const name = this.parseName();
        if (Object.hasOwn(directiveLocation_js_1.DirectiveLocation, name.value)) {
            return name;
        }
        throw this.unexpected(start);
    }
    // Core parsing utility functions
    /**
     * Returns a node that, if configured to do so, sets a "loc" field as a
     * location object, used to identify the place in the source that created a
     * given parsed object.
     */
    node(startToken, node) {
        if (this._options.noLocation !== true) {
            node.loc = new ast_js_1.Location(startToken, this._lexer.lastToken, this._lexer.source);
        }
        return node;
    }
    /**
     * Determines if the next token is of a given kind
     */
    peek(kind) {
        return this._lexer.token.kind === kind;
    }
    /**
     * If the next token is of the given kind, return that token after advancing the lexer.
     * Otherwise, do not change the parser state and throw an error.
     */
    expectToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
            this.advanceLexer();
            return token;
        }
        throw (0, syntaxError_js_1.syntaxError)(this._lexer.source, token.start, `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`);
    }
    /**
     * If the next token is of the given kind, return "true" after advancing the lexer.
     * Otherwise, do not change the parser state and return "false".
     */
    expectOptionalToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
            this.advanceLexer();
            return true;
        }
        return false;
    }
    /**
     * If the next token is a given keyword, advance the lexer.
     * Otherwise, do not change the parser state and throw an error.
     */
    expectKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === tokenKind_js_1.TokenKind.NAME && token.value === value) {
            this.advanceLexer();
        }
        else {
            throw (0, syntaxError_js_1.syntaxError)(this._lexer.source, token.start, `Expected "${value}", found ${getTokenDesc(token)}.`);
        }
    }
    /**
     * If the next token is a given keyword, return "true" after advancing the lexer.
     * Otherwise, do not change the parser state and return "false".
     */
    expectOptionalKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === tokenKind_js_1.TokenKind.NAME && token.value === value) {
            this.advanceLexer();
            return true;
        }
        return false;
    }
    /**
     * Helper function for creating an error when an unexpected lexed token is encountered.
     */
    unexpected(atToken) {
        const token = atToken ?? this._lexer.token;
        return (0, syntaxError_js_1.syntaxError)(this._lexer.source, token.start, `Unexpected ${getTokenDesc(token)}.`);
    }
    /**
     * Returns a possibly empty list of parse nodes, determined by the parseFn.
     * This list begins with a lex token of openKind and ends with a lex token of closeKind.
     * Advances the parser to the next lex token after the closing token.
     */
    any(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        while (!this.expectOptionalToken(closeKind)) {
            nodes.push(parseFn.call(this));
        }
        return nodes;
    }
    /**
     * Returns a list of parse nodes, determined by the parseFn.
     * It can be empty only if open token is missing otherwise it will always return non-empty list
     * that begins with a lex token of openKind and ends with a lex token of closeKind.
     * Advances the parser to the next lex token after the closing token.
     */
    optionalMany(openKind, parseFn, closeKind) {
        if (this.expectOptionalToken(openKind)) {
            const nodes = [];
            do {
                nodes.push(parseFn.call(this));
            } while (!this.expectOptionalToken(closeKind));
            return nodes;
        }
        return undefined;
    }
    /**
     * Returns a non-empty list of parse nodes, determined by the parseFn.
     * This list begins with a lex token of openKind and ends with a lex token of closeKind.
     * Advances the parser to the next lex token after the closing token.
     */
    many(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        do {
            nodes.push(parseFn.call(this));
        } while (!this.expectOptionalToken(closeKind));
        return nodes;
    }
    /**
     * Returns a non-empty list of parse nodes, determined by the parseFn.
     * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
     * Advances the parser to the next lex token after last item in the list.
     */
    delimitedMany(delimiterKind, parseFn) {
        this.expectOptionalToken(delimiterKind);
        const nodes = [];
        do {
            nodes.push(parseFn.call(this));
        } while (this.expectOptionalToken(delimiterKind));
        return nodes;
    }
    advanceLexer() {
        const { maxTokens } = this._options;
        const token = this._lexer.advance();
        if (token.kind !== tokenKind_js_1.TokenKind.EOF) {
            ++this._tokenCounter;
            if (maxTokens !== undefined && this._tokenCounter > maxTokens) {
                throw (0, syntaxError_js_1.syntaxError)(this._lexer.source, token.start, `Document contains more than ${maxTokens} tokens. Parsing aborted.`);
            }
        }
    }
}
exports.Parser = Parser;
/**
 * A helper function to describe a token as a string for debugging.
 */
function getTokenDesc(token) {
    const value = token.value;
    return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : '');
}
/**
 * A helper function to describe a token kind as a string for debugging.
 */
function getTokenKindDesc(kind) {
    return (0, lexer_js_1.isPunctuatorTokenKind)(kind) ? `"${kind}"` : kind;
}
//# sourceMappingURL=parser.js.map