"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
exports.parse = parse;
exports.parseValue = parseValue;
exports.parseConstValue = parseConstValue;
exports.parseType = parseType;
exports.parseSchemaCoordinate = parseSchemaCoordinate;
const syntaxError_ts_1 = require("../error/syntaxError.js");
const diagnostics_ts_1 = require("../diagnostics.js");
const ast_ts_1 = require("./ast.js");
const directiveLocation_ts_1 = require("./directiveLocation.js");
const kinds_ts_1 = require("./kinds.js");
const lexer_ts_1 = require("./lexer.js");
const schemaCoordinateLexer_ts_1 = require("./schemaCoordinateLexer.js");
const source_ts_1 = require("./source.js");
const tokenKind_ts_1 = require("./tokenKind.js");
function parse(source, options) {
    return (0, diagnostics_ts_1.shouldTrace)(diagnostics_ts_1.parseChannel)
        ? diagnostics_ts_1.parseChannel.traceSync(() => parseImpl(source, options), { source })
        : parseImpl(source, options);
}
function parseImpl(source, options) {
    const parser = new Parser(source, options);
    const document = parser.parseDocument();
    Object.defineProperty(document, 'tokenCount', {
        enumerable: false,
        value: parser.tokenCount,
    });
    return document;
}
function parseValue(source, options) {
    const parser = new Parser(source, options);
    parser.expectToken(tokenKind_ts_1.TokenKind.SOF);
    const value = parser.parseValueLiteral(false);
    parser.expectToken(tokenKind_ts_1.TokenKind.EOF);
    return value;
}
function parseConstValue(source, options) {
    const parser = new Parser(source, options);
    parser.expectToken(tokenKind_ts_1.TokenKind.SOF);
    const value = parser.parseConstValueLiteral();
    parser.expectToken(tokenKind_ts_1.TokenKind.EOF);
    return value;
}
function parseType(source, options) {
    const parser = new Parser(source, options);
    parser.expectToken(tokenKind_ts_1.TokenKind.SOF);
    const type = parser.parseTypeReference();
    parser.expectToken(tokenKind_ts_1.TokenKind.EOF);
    return type;
}
function parseSchemaCoordinate(source) {
    const sourceObj = (0, source_ts_1.isSource)(source) ? source : new source_ts_1.Source(source);
    const lexer = new schemaCoordinateLexer_ts_1.SchemaCoordinateLexer(sourceObj);
    const parser = new Parser(source, { lexer });
    parser.expectToken(tokenKind_ts_1.TokenKind.SOF);
    const coordinate = parser.parseSchemaCoordinate();
    parser.expectToken(tokenKind_ts_1.TokenKind.EOF);
    return coordinate;
}
class Parser {
    constructor(source, options = {}) {
        const { lexer, ..._options } = options;
        if (lexer) {
            this._lexer = lexer;
        }
        else {
            const sourceObj = (0, source_ts_1.isSource)(source) ? source : new source_ts_1.Source(source);
            this._lexer = new lexer_ts_1.Lexer(sourceObj);
        }
        this._options = _options;
        this._tokenCounter = 0;
    }
    get tokenCount() {
        return this._tokenCounter;
    }
    parseName() {
        const token = this.expectToken(tokenKind_ts_1.TokenKind.NAME);
        return this.node(token, {
            kind: kinds_ts_1.Kind.NAME,
            value: token.value,
        });
    }
    parseDocument() {
        return this.node(this._lexer.token, {
            kind: kinds_ts_1.Kind.DOCUMENT,
            definitions: this.many(tokenKind_ts_1.TokenKind.SOF, this.parseDefinition, tokenKind_ts_1.TokenKind.EOF),
        });
    }
    parseDefinition() {
        if (this.peek(tokenKind_ts_1.TokenKind.BRACE_L)) {
            return this.parseOperationDefinition();
        }
        const hasDescription = this.peekDescription();
        const keywordToken = hasDescription
            ? this._lexer.lookahead()
            : this._lexer.token;
        if (hasDescription && keywordToken.kind === tokenKind_ts_1.TokenKind.BRACE_L) {
            throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, this._lexer.token.start, 'Unexpected description, descriptions are not supported on shorthand queries.');
        }
        if (keywordToken.kind === tokenKind_ts_1.TokenKind.NAME) {
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
            switch (keywordToken.value) {
                case 'query':
                case 'mutation':
                case 'subscription':
                    return this.parseOperationDefinition();
                case 'fragment':
                    return this.parseFragmentDefinition();
            }
            if (hasDescription) {
                throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, this._lexer.token.start, 'Unexpected description, only GraphQL definitions support descriptions.');
            }
            switch (keywordToken.value) {
                case 'extend':
                    return this.parseTypeSystemExtension();
            }
        }
        throw this.unexpected(keywordToken);
    }
    parseOperationDefinition() {
        const start = this._lexer.token;
        if (this.peek(tokenKind_ts_1.TokenKind.BRACE_L)) {
            return this.node(start, {
                kind: kinds_ts_1.Kind.OPERATION_DEFINITION,
                operation: ast_ts_1.OperationTypeNode.QUERY,
                description: undefined,
                name: undefined,
                variableDefinitions: undefined,
                directives: undefined,
                selectionSet: this.parseSelectionSet(),
            });
        }
        const description = this.parseDescription();
        const operation = this.parseOperationType();
        let name;
        if (this.peek(tokenKind_ts_1.TokenKind.NAME)) {
            name = this.parseName();
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.OPERATION_DEFINITION,
            operation,
            description,
            name,
            variableDefinitions: this.parseVariableDefinitions(),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
        });
    }
    parseOperationType() {
        const operationToken = this.expectToken(tokenKind_ts_1.TokenKind.NAME);
        switch (operationToken.value) {
            case 'query':
                return ast_ts_1.OperationTypeNode.QUERY;
            case 'mutation':
                return ast_ts_1.OperationTypeNode.MUTATION;
            case 'subscription':
                return ast_ts_1.OperationTypeNode.SUBSCRIPTION;
        }
        throw this.unexpected(operationToken);
    }
    parseVariableDefinitions() {
        return this.optionalMany(tokenKind_ts_1.TokenKind.PAREN_L, this.parseVariableDefinition, tokenKind_ts_1.TokenKind.PAREN_R);
    }
    parseVariableDefinition() {
        return this.node(this._lexer.token, {
            kind: kinds_ts_1.Kind.VARIABLE_DEFINITION,
            description: this.parseDescription(),
            variable: this.parseVariable(),
            type: (this.expectToken(tokenKind_ts_1.TokenKind.COLON), this.parseTypeReference()),
            defaultValue: this.expectOptionalToken(tokenKind_ts_1.TokenKind.EQUALS)
                ? this.parseConstValueLiteral()
                : undefined,
            directives: this.parseConstDirectives(),
        });
    }
    parseVariable() {
        const start = this._lexer.token;
        this.expectToken(tokenKind_ts_1.TokenKind.DOLLAR);
        return this.node(start, {
            kind: kinds_ts_1.Kind.VARIABLE,
            name: this.parseName(),
        });
    }
    parseSelectionSet() {
        return this.node(this._lexer.token, {
            kind: kinds_ts_1.Kind.SELECTION_SET,
            selections: this._options.allowEmptySelectionSets === false
                ? this.many(tokenKind_ts_1.TokenKind.BRACE_L, this.parseSelection, tokenKind_ts_1.TokenKind.BRACE_R)
                : this.any(tokenKind_ts_1.TokenKind.BRACE_L, this.parseSelection, tokenKind_ts_1.TokenKind.BRACE_R),
        });
    }
    parseSelection() {
        return this.peek(tokenKind_ts_1.TokenKind.SPREAD)
            ? this.parseFragment()
            : this.parseField();
    }
    parseField() {
        const start = this._lexer.token;
        const nameOrAlias = this.parseName();
        let alias;
        let name;
        if (this.expectOptionalToken(tokenKind_ts_1.TokenKind.COLON)) {
            alias = nameOrAlias;
            name = this.parseName();
        }
        else {
            name = nameOrAlias;
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.FIELD,
            alias,
            name,
            arguments: this.parseArguments(false),
            directives: this.parseDirectives(false),
            selectionSet: this.peek(tokenKind_ts_1.TokenKind.BRACE_L)
                ? this.parseSelectionSet()
                : undefined,
        });
    }
    parseArguments(isConst) {
        const item = isConst ? this.parseConstArgument : this.parseArgument;
        return this.optionalMany(tokenKind_ts_1.TokenKind.PAREN_L, item, tokenKind_ts_1.TokenKind.PAREN_R);
    }
    parseFragmentArguments() {
        const item = this.parseFragmentArgument;
        return this.optionalMany(tokenKind_ts_1.TokenKind.PAREN_L, item, tokenKind_ts_1.TokenKind.PAREN_R);
    }
    parseArgument(isConst = false) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(tokenKind_ts_1.TokenKind.COLON);
        return this.node(start, {
            kind: kinds_ts_1.Kind.ARGUMENT,
            name,
            value: this.parseValueLiteral(isConst),
        });
    }
    parseConstArgument() {
        return this.parseArgument(true);
    }
    parseFragmentArgument() {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(tokenKind_ts_1.TokenKind.COLON);
        return this.node(start, {
            kind: kinds_ts_1.Kind.FRAGMENT_ARGUMENT,
            name,
            value: this.parseValueLiteral(false),
        });
    }
    parseFragment() {
        const start = this._lexer.token;
        this.expectToken(tokenKind_ts_1.TokenKind.SPREAD);
        const hasTypeCondition = this.expectOptionalKeyword('on');
        if (!hasTypeCondition && this.peek(tokenKind_ts_1.TokenKind.NAME)) {
            const name = this.parseFragmentName();
            if (this.peek(tokenKind_ts_1.TokenKind.PAREN_L) &&
                this._options.experimentalFragmentArguments) {
                return this.node(start, {
                    kind: kinds_ts_1.Kind.FRAGMENT_SPREAD,
                    name,
                    arguments: this.parseFragmentArguments(),
                    directives: this.parseDirectives(false),
                });
            }
            return this.node(start, {
                kind: kinds_ts_1.Kind.FRAGMENT_SPREAD,
                name,
                directives: this.parseDirectives(false),
            });
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.INLINE_FRAGMENT,
            typeCondition: hasTypeCondition ? this.parseNamedType() : undefined,
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
        });
    }
    parseFragmentDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('fragment');
        if (this._options.experimentalFragmentArguments === true) {
            return this.node(start, {
                kind: kinds_ts_1.Kind.FRAGMENT_DEFINITION,
                description,
                name: this.parseFragmentName(),
                variableDefinitions: this.parseVariableDefinitions(),
                typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
                directives: this.parseDirectives(false),
                selectionSet: this.parseSelectionSet(),
            });
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.FRAGMENT_DEFINITION,
            description,
            name: this.parseFragmentName(),
            typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
        });
    }
    parseFragmentName() {
        if (this._lexer.token.value === 'on') {
            throw this.unexpected();
        }
        return this.parseName();
    }
    parseValueLiteral(isConst) {
        const token = this._lexer.token;
        switch (token.kind) {
            case tokenKind_ts_1.TokenKind.BRACKET_L:
                return this.parseList(isConst);
            case tokenKind_ts_1.TokenKind.BRACE_L:
                return this.parseObject(isConst);
            case tokenKind_ts_1.TokenKind.INT:
                this.advanceLexer();
                return this.node(token, {
                    kind: kinds_ts_1.Kind.INT,
                    value: token.value,
                });
            case tokenKind_ts_1.TokenKind.FLOAT:
                this.advanceLexer();
                return this.node(token, {
                    kind: kinds_ts_1.Kind.FLOAT,
                    value: token.value,
                });
            case tokenKind_ts_1.TokenKind.STRING:
            case tokenKind_ts_1.TokenKind.BLOCK_STRING:
                return this.parseStringLiteral();
            case tokenKind_ts_1.TokenKind.NAME:
                this.advanceLexer();
                switch (token.value) {
                    case 'true':
                        return this.node(token, {
                            kind: kinds_ts_1.Kind.BOOLEAN,
                            value: true,
                        });
                    case 'false':
                        return this.node(token, {
                            kind: kinds_ts_1.Kind.BOOLEAN,
                            value: false,
                        });
                    case 'null':
                        return this.node(token, { kind: kinds_ts_1.Kind.NULL });
                    default:
                        return this.node(token, {
                            kind: kinds_ts_1.Kind.ENUM,
                            value: token.value,
                        });
                }
            case tokenKind_ts_1.TokenKind.DOLLAR:
                if (isConst) {
                    this.expectToken(tokenKind_ts_1.TokenKind.DOLLAR);
                    if (this._lexer.token.kind === tokenKind_ts_1.TokenKind.NAME) {
                        const varName = this._lexer.token.value;
                        throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, token.start, `Unexpected variable "$${varName}" in constant value.`);
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
            kind: kinds_ts_1.Kind.STRING,
            value: token.value,
            block: token.kind === tokenKind_ts_1.TokenKind.BLOCK_STRING,
        });
    }
    parseList(isConst) {
        const item = () => this.parseValueLiteral(isConst);
        return this.node(this._lexer.token, {
            kind: kinds_ts_1.Kind.LIST,
            values: this.any(tokenKind_ts_1.TokenKind.BRACKET_L, item, tokenKind_ts_1.TokenKind.BRACKET_R),
        });
    }
    parseObject(isConst) {
        const item = () => this.parseObjectField(isConst);
        return this.node(this._lexer.token, {
            kind: kinds_ts_1.Kind.OBJECT,
            fields: this.any(tokenKind_ts_1.TokenKind.BRACE_L, item, tokenKind_ts_1.TokenKind.BRACE_R),
        });
    }
    parseObjectField(isConst) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(tokenKind_ts_1.TokenKind.COLON);
        return this.node(start, {
            kind: kinds_ts_1.Kind.OBJECT_FIELD,
            name,
            value: this.parseValueLiteral(isConst),
        });
    }
    parseDirectives(isConst) {
        const directives = [];
        while (this.peek(tokenKind_ts_1.TokenKind.AT)) {
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
        this.expectToken(tokenKind_ts_1.TokenKind.AT);
        return this.node(start, {
            kind: kinds_ts_1.Kind.DIRECTIVE,
            name: this.parseName(),
            arguments: this.parseArguments(isConst),
        });
    }
    parseTypeReference() {
        const start = this._lexer.token;
        let type;
        if (this.expectOptionalToken(tokenKind_ts_1.TokenKind.BRACKET_L)) {
            const innerType = this.parseTypeReference();
            this.expectToken(tokenKind_ts_1.TokenKind.BRACKET_R);
            type = this.node(start, {
                kind: kinds_ts_1.Kind.LIST_TYPE,
                type: innerType,
            });
        }
        else {
            type = this.parseNamedType();
        }
        if (this.expectOptionalToken(tokenKind_ts_1.TokenKind.BANG)) {
            return this.node(start, {
                kind: kinds_ts_1.Kind.NON_NULL_TYPE,
                type,
            });
        }
        return type;
    }
    parseNamedType() {
        return this.node(this._lexer.token, {
            kind: kinds_ts_1.Kind.NAMED_TYPE,
            name: this.parseName(),
        });
    }
    peekDescription() {
        return this.peek(tokenKind_ts_1.TokenKind.STRING) || this.peek(tokenKind_ts_1.TokenKind.BLOCK_STRING);
    }
    parseDescription() {
        if (this.peekDescription()) {
            return this.parseStringLiteral();
        }
    }
    parseSchemaDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('schema');
        const directives = this.parseConstDirectives();
        const operationTypes = this.many(tokenKind_ts_1.TokenKind.BRACE_L, this.parseOperationTypeDefinition, tokenKind_ts_1.TokenKind.BRACE_R);
        return this.node(start, {
            kind: kinds_ts_1.Kind.SCHEMA_DEFINITION,
            description,
            directives,
            operationTypes,
        });
    }
    parseOperationTypeDefinition() {
        const start = this._lexer.token;
        const operation = this.parseOperationType();
        this.expectToken(tokenKind_ts_1.TokenKind.COLON);
        const type = this.parseNamedType();
        return this.node(start, {
            kind: kinds_ts_1.Kind.OPERATION_TYPE_DEFINITION,
            operation,
            type,
        });
    }
    parseScalarTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('scalar');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_ts_1.Kind.SCALAR_TYPE_DEFINITION,
            description,
            name,
            directives,
        });
    }
    parseObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('type');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        return this.node(start, {
            kind: kinds_ts_1.Kind.OBJECT_TYPE_DEFINITION,
            description,
            name,
            interfaces,
            directives,
            fields,
        });
    }
    parseImplementsInterfaces() {
        return this.expectOptionalKeyword('implements')
            ? this.delimitedMany(tokenKind_ts_1.TokenKind.AMP, this.parseNamedType)
            : undefined;
    }
    parseFieldsDefinition() {
        return this.optionalMany(tokenKind_ts_1.TokenKind.BRACE_L, this.parseFieldDefinition, tokenKind_ts_1.TokenKind.BRACE_R);
    }
    parseFieldDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        this.expectToken(tokenKind_ts_1.TokenKind.COLON);
        const type = this.parseTypeReference();
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_ts_1.Kind.FIELD_DEFINITION,
            description,
            name,
            arguments: args,
            type,
            directives,
        });
    }
    parseArgumentDefs() {
        return this.optionalMany(tokenKind_ts_1.TokenKind.PAREN_L, this.parseInputValueDef, tokenKind_ts_1.TokenKind.PAREN_R);
    }
    parseInputValueDef() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        this.expectToken(tokenKind_ts_1.TokenKind.COLON);
        const type = this.parseTypeReference();
        let defaultValue;
        if (this.expectOptionalToken(tokenKind_ts_1.TokenKind.EQUALS)) {
            defaultValue = this.parseConstValueLiteral();
        }
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_ts_1.Kind.INPUT_VALUE_DEFINITION,
            description,
            name,
            type,
            defaultValue,
            directives,
        });
    }
    parseInterfaceTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('interface');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        return this.node(start, {
            kind: kinds_ts_1.Kind.INTERFACE_TYPE_DEFINITION,
            description,
            name,
            interfaces,
            directives,
            fields,
        });
    }
    parseUnionTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('union');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const types = this.parseUnionMemberTypes();
        return this.node(start, {
            kind: kinds_ts_1.Kind.UNION_TYPE_DEFINITION,
            description,
            name,
            directives,
            types,
        });
    }
    parseUnionMemberTypes() {
        return this.expectOptionalToken(tokenKind_ts_1.TokenKind.EQUALS)
            ? this.delimitedMany(tokenKind_ts_1.TokenKind.PIPE, this.parseNamedType)
            : undefined;
    }
    parseEnumTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('enum');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const values = this.parseEnumValuesDefinition();
        return this.node(start, {
            kind: kinds_ts_1.Kind.ENUM_TYPE_DEFINITION,
            description,
            name,
            directives,
            values,
        });
    }
    parseEnumValuesDefinition() {
        return this.optionalMany(tokenKind_ts_1.TokenKind.BRACE_L, this.parseEnumValueDefinition, tokenKind_ts_1.TokenKind.BRACE_R);
    }
    parseEnumValueDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseEnumValueName();
        const directives = this.parseConstDirectives();
        return this.node(start, {
            kind: kinds_ts_1.Kind.ENUM_VALUE_DEFINITION,
            description,
            name,
            directives,
        });
    }
    parseEnumValueName() {
        if (this._lexer.token.value === 'true' ||
            this._lexer.token.value === 'false' ||
            this._lexer.token.value === 'null') {
            throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, this._lexer.token.start, `${getTokenDesc(this._lexer.token)} is reserved and cannot be used for an enum value.`);
        }
        return this.parseName();
    }
    parseInputObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('input');
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const fields = this.parseInputFieldsDefinition();
        return this.node(start, {
            kind: kinds_ts_1.Kind.INPUT_OBJECT_TYPE_DEFINITION,
            description,
            name,
            directives,
            fields,
        });
    }
    parseInputFieldsDefinition() {
        return this.optionalMany(tokenKind_ts_1.TokenKind.BRACE_L, this.parseInputValueDef, tokenKind_ts_1.TokenKind.BRACE_R);
    }
    parseTypeSystemExtension() {
        const keywordToken = this._lexer.lookahead();
        if (keywordToken.kind === tokenKind_ts_1.TokenKind.NAME) {
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
                case 'directive':
                    return this.parseDirectiveExtension();
            }
        }
        throw this.unexpected(keywordToken);
    }
    parseSchemaExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('schema');
        const directives = this.parseConstDirectives();
        const operationTypes = this.optionalMany(tokenKind_ts_1.TokenKind.BRACE_L, this.parseOperationTypeDefinition, tokenKind_ts_1.TokenKind.BRACE_R);
        if (directives === undefined && operationTypes === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.SCHEMA_EXTENSION,
            directives,
            operationTypes,
        });
    }
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
            kind: kinds_ts_1.Kind.SCALAR_TYPE_EXTENSION,
            name,
            directives,
        });
    }
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
            kind: kinds_ts_1.Kind.OBJECT_TYPE_EXTENSION,
            name,
            interfaces,
            directives,
            fields,
        });
    }
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
            kind: kinds_ts_1.Kind.INTERFACE_TYPE_EXTENSION,
            name,
            interfaces,
            directives,
            fields,
        });
    }
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
            kind: kinds_ts_1.Kind.UNION_TYPE_EXTENSION,
            name,
            directives,
            types,
        });
    }
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
            kind: kinds_ts_1.Kind.ENUM_TYPE_EXTENSION,
            name,
            directives,
            values,
        });
    }
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
            kind: kinds_ts_1.Kind.INPUT_OBJECT_TYPE_EXTENSION,
            name,
            directives,
            fields,
        });
    }
    parseDirectiveExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('directive');
        this.expectToken(tokenKind_ts_1.TokenKind.AT);
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        if (directives === undefined) {
            throw this.unexpected();
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.DIRECTIVE_EXTENSION,
            name,
            directives,
        });
    }
    parseDirectiveDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('directive');
        this.expectToken(tokenKind_ts_1.TokenKind.AT);
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        const directives = this.parseConstDirectives();
        const repeatable = this.expectOptionalKeyword('repeatable');
        this.expectKeyword('on');
        const locations = this.parseDirectiveLocations();
        return this.node(start, {
            kind: kinds_ts_1.Kind.DIRECTIVE_DEFINITION,
            description,
            name,
            arguments: args,
            directives,
            repeatable,
            locations,
        });
    }
    parseDirectiveLocations() {
        return this.delimitedMany(tokenKind_ts_1.TokenKind.PIPE, this.parseDirectiveLocation);
    }
    parseDirectiveLocation() {
        const start = this._lexer.token;
        const name = this.parseName();
        if (Object.hasOwn(directiveLocation_ts_1.DirectiveLocation, name.value)) {
            return name;
        }
        throw this.unexpected(start);
    }
    parseSchemaCoordinate() {
        const start = this._lexer.token;
        const ofDirective = this.expectOptionalToken(tokenKind_ts_1.TokenKind.AT);
        const name = this.parseName();
        let memberName;
        if (!ofDirective && this.expectOptionalToken(tokenKind_ts_1.TokenKind.DOT)) {
            memberName = this.parseName();
        }
        let argumentName;
        if ((ofDirective || memberName) &&
            this.expectOptionalToken(tokenKind_ts_1.TokenKind.PAREN_L)) {
            argumentName = this.parseName();
            this.expectToken(tokenKind_ts_1.TokenKind.COLON);
            this.expectToken(tokenKind_ts_1.TokenKind.PAREN_R);
        }
        if (ofDirective) {
            if (argumentName) {
                return this.node(start, {
                    kind: kinds_ts_1.Kind.DIRECTIVE_ARGUMENT_COORDINATE,
                    name,
                    argumentName,
                });
            }
            return this.node(start, {
                kind: kinds_ts_1.Kind.DIRECTIVE_COORDINATE,
                name,
            });
        }
        else if (memberName) {
            if (argumentName) {
                return this.node(start, {
                    kind: kinds_ts_1.Kind.ARGUMENT_COORDINATE,
                    name,
                    fieldName: memberName,
                    argumentName,
                });
            }
            return this.node(start, {
                kind: kinds_ts_1.Kind.MEMBER_COORDINATE,
                name,
                memberName,
            });
        }
        return this.node(start, {
            kind: kinds_ts_1.Kind.TYPE_COORDINATE,
            name,
        });
    }
    node(startToken, node) {
        if (this._options.noLocation !== true) {
            node.loc = new ast_ts_1.Location(startToken, this._lexer.lastToken, this._lexer.source);
        }
        return node;
    }
    peek(kind) {
        return this._lexer.token.kind === kind;
    }
    expectToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
            this.advanceLexer();
            return token;
        }
        throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, token.start, `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`);
    }
    expectOptionalToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
            this.advanceLexer();
            return true;
        }
        return false;
    }
    expectKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === tokenKind_ts_1.TokenKind.NAME && token.value === value) {
            this.advanceLexer();
        }
        else {
            throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, token.start, `Expected "${value}", found ${getTokenDesc(token)}.`);
        }
    }
    expectOptionalKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === tokenKind_ts_1.TokenKind.NAME && token.value === value) {
            this.advanceLexer();
            return true;
        }
        return false;
    }
    unexpected(atToken) {
        const token = atToken ?? this._lexer.token;
        return (0, syntaxError_ts_1.syntaxError)(this._lexer.source, token.start, `Unexpected ${getTokenDesc(token)}.`);
    }
    any(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        while (!this.expectOptionalToken(closeKind)) {
            nodes.push(parseFn.call(this));
        }
        return nodes;
    }
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
    many(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        do {
            nodes.push(parseFn.call(this));
        } while (!this.expectOptionalToken(closeKind));
        return nodes;
    }
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
        if (token.kind !== tokenKind_ts_1.TokenKind.EOF) {
            ++this._tokenCounter;
            if (maxTokens !== undefined && this._tokenCounter > maxTokens) {
                throw (0, syntaxError_ts_1.syntaxError)(this._lexer.source, token.start, `Document contains more than ${maxTokens} tokens. Parsing aborted.`);
            }
        }
    }
}
exports.Parser = Parser;
function getTokenDesc(token) {
    const value = token.value;
    return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : '');
}
function getTokenKindDesc(kind) {
    return (0, lexer_ts_1.isPunctuatorTokenKind)(kind) ? `"${kind}"` : kind;
}
//# sourceMappingURL=parser.js.map