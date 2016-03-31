'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parse = parse;
exports.parseValue = parseValue;
exports.parseConstValue = parseConstValue;
exports.parseType = parseType;
exports.parseNamedType = parseNamedType;

var _source = require('./source');

var _error = require('../error');

var _lexer = require('./lexer');

var _kinds = require('./kinds');

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */


/**
 * Configuration options to control parser behavior
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function parse(source, options) {
  var sourceObj = source instanceof _source.Source ? source : new _source.Source(source);
  var parser = makeParser(sourceObj, options || {});
  return parseDocument(parser);
}

/**
 * Given a string containing a GraphQL value, parse the AST for that value.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 */
function parseValue(source, options) {
  var sourceObj = source instanceof _source.Source ? source : new _source.Source(source);
  var parser = makeParser(sourceObj, options || {});
  return parseValueLiteral(parser, false);
}

/**
 * Converts a name lex token into a name parse node.
 */
function parseName(parser) {
  var token = expect(parser, _lexer.TokenKind.NAME);
  return {
    kind: _kinds.NAME,
    value: token.value,
    loc: loc(parser, token.start)
  };
}

// Implements the parsing rules in the Document section.

/**
 * Document : Definition+
 */
function parseDocument(parser) {
  var start = parser.token.start;

  var definitions = [];
  do {
    definitions.push(parseDefinition(parser));
  } while (!skip(parser, _lexer.TokenKind.EOF));

  return {
    kind: _kinds.DOCUMENT,
    definitions: definitions,
    loc: loc(parser, start)
  };
}

/**
 * Definition :
 *   - OperationDefinition
 *   - FragmentDefinition
 *   - TypeSystemDefinition
 */
function parseDefinition(parser) {
  if (peek(parser, _lexer.TokenKind.BRACE_L)) {
    return parseOperationDefinition(parser);
  }

  if (peek(parser, _lexer.TokenKind.NAME)) {
    switch (parser.token.value) {
      case 'query':
      case 'mutation':
      // Note: subscription is an experimental non-spec addition.
      case 'subscription':
        return parseOperationDefinition(parser);

      case 'fragment':
        return parseFragmentDefinition(parser);

      // Note: the Type System IDL is an experimental non-spec addition.
      case 'schema':
      case 'scalar':
      case 'type':
      case 'interface':
      case 'union':
      case 'enum':
      case 'input':
      case 'extend':
      case 'directive':
        return parseTypeSystemDefinition(parser);
    }
  }

  throw unexpected(parser);
}

// Implements the parsing rules in the Operations section.

/**
 * OperationDefinition :
 *  - SelectionSet
 *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
 */
function parseOperationDefinition(parser) {
  var start = parser.token.start;
  if (peek(parser, _lexer.TokenKind.BRACE_L)) {
    return {
      kind: _kinds.OPERATION_DEFINITION,
      operation: 'query',
      name: null,
      variableDefinitions: null,
      directives: [],
      selectionSet: parseSelectionSet(parser),
      loc: loc(parser, start)
    };
  }
  var operation = parseOperationType(parser);
  var name = void 0;
  if (peek(parser, _lexer.TokenKind.NAME)) {
    name = parseName(parser);
  }
  return {
    kind: _kinds.OPERATION_DEFINITION,
    operation: operation,
    name: name,
    variableDefinitions: parseVariableDefinitions(parser),
    directives: parseDirectives(parser),
    selectionSet: parseSelectionSet(parser),
    loc: loc(parser, start)
  };
}

/**
 * OperationType : one of query mutation subscription
 */
function parseOperationType(parser) {
  var operationToken = expect(parser, _lexer.TokenKind.NAME);
  switch (operationToken.value) {
    case 'query':
      return 'query';
    case 'mutation':
      return 'mutation';
    // Note: subscription is an experimental non-spec addition.
    case 'subscription':
      return 'subscription';
  }

  throw unexpected(parser, operationToken);
}

/**
 * VariableDefinitions : ( VariableDefinition+ )
 */
function parseVariableDefinitions(parser) {
  return peek(parser, _lexer.TokenKind.PAREN_L) ? many(parser, _lexer.TokenKind.PAREN_L, parseVariableDefinition, _lexer.TokenKind.PAREN_R) : [];
}

/**
 * VariableDefinition : Variable : Type DefaultValue?
 */
function parseVariableDefinition(parser) {
  var start = parser.token.start;
  return {
    kind: _kinds.VARIABLE_DEFINITION,
    variable: parseVariable(parser),
    type: (expect(parser, _lexer.TokenKind.COLON), parseType(parser)),
    defaultValue: skip(parser, _lexer.TokenKind.EQUALS) ? parseValueLiteral(parser, true) : null,
    loc: loc(parser, start)
  };
}

/**
 * Variable : $ Name
 */
function parseVariable(parser) {
  var start = parser.token.start;
  expect(parser, _lexer.TokenKind.DOLLAR);
  return {
    kind: _kinds.VARIABLE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}

/**
 * SelectionSet : { Selection+ }
 */
function parseSelectionSet(parser) {
  var start = parser.token.start;
  return {
    kind: _kinds.SELECTION_SET,
    selections: many(parser, _lexer.TokenKind.BRACE_L, parseSelection, _lexer.TokenKind.BRACE_R),
    loc: loc(parser, start)
  };
}

/**
 * Selection :
 *   - Field
 *   - FragmentSpread
 *   - InlineFragment
 */
function parseSelection(parser) {
  return peek(parser, _lexer.TokenKind.SPREAD) ? parseFragment(parser) : parseField(parser);
}

/**
 * Field : Alias? Name Arguments? Directives? SelectionSet?
 *
 * Alias : Name :
 */
function parseField(parser) {
  var start = parser.token.start;

  var nameOrAlias = parseName(parser);
  var alias = void 0;
  var name = void 0;
  if (skip(parser, _lexer.TokenKind.COLON)) {
    alias = nameOrAlias;
    name = parseName(parser);
  } else {
    alias = null;
    name = nameOrAlias;
  }

  return {
    kind: _kinds.FIELD,
    alias: alias,
    name: name,
    arguments: parseArguments(parser),
    directives: parseDirectives(parser),
    selectionSet: peek(parser, _lexer.TokenKind.BRACE_L) ? parseSelectionSet(parser) : null,
    loc: loc(parser, start)
  };
}

/**
 * Arguments : ( Argument+ )
 */
function parseArguments(parser) {
  return peek(parser, _lexer.TokenKind.PAREN_L) ? many(parser, _lexer.TokenKind.PAREN_L, parseArgument, _lexer.TokenKind.PAREN_R) : [];
}

/**
 * Argument : Name : Value
 */
function parseArgument(parser) {
  var start = parser.token.start;
  return {
    kind: _kinds.ARGUMENT,
    name: parseName(parser),
    value: (expect(parser, _lexer.TokenKind.COLON), parseValueLiteral(parser, false)),
    loc: loc(parser, start)
  };
}

// Implements the parsing rules in the Fragments section.

/**
 * Corresponds to both FragmentSpread and InlineFragment in the spec.
 *
 * FragmentSpread : ... FragmentName Directives?
 *
 * InlineFragment : ... TypeCondition? Directives? SelectionSet
 */
function parseFragment(parser) {
  var start = parser.token.start;
  expect(parser, _lexer.TokenKind.SPREAD);
  if (peek(parser, _lexer.TokenKind.NAME) && parser.token.value !== 'on') {
    return {
      kind: _kinds.FRAGMENT_SPREAD,
      name: parseFragmentName(parser),
      directives: parseDirectives(parser),
      loc: loc(parser, start)
    };
  }
  var typeCondition = null;
  if (parser.token.value === 'on') {
    advance(parser);
    typeCondition = parseNamedType(parser);
  }
  return {
    kind: _kinds.INLINE_FRAGMENT,
    typeCondition: typeCondition,
    directives: parseDirectives(parser),
    selectionSet: parseSelectionSet(parser),
    loc: loc(parser, start)
  };
}

/**
 * FragmentDefinition :
 *   - fragment FragmentName on TypeCondition Directives? SelectionSet
 *
 * TypeCondition : NamedType
 */
function parseFragmentDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'fragment');
  return {
    kind: _kinds.FRAGMENT_DEFINITION,
    name: parseFragmentName(parser),
    typeCondition: (expectKeyword(parser, 'on'), parseNamedType(parser)),
    directives: parseDirectives(parser),
    selectionSet: parseSelectionSet(parser),
    loc: loc(parser, start)
  };
}

/**
 * FragmentName : Name but not `on`
 */
function parseFragmentName(parser) {
  if (parser.token.value === 'on') {
    throw unexpected(parser);
  }
  return parseName(parser);
}

// Implements the parsing rules in the Values section.

/**
 * Value[Const] :
 *   - [~Const] Variable
 *   - IntValue
 *   - FloatValue
 *   - StringValue
 *   - BooleanValue
 *   - EnumValue
 *   - ListValue[?Const]
 *   - ObjectValue[?Const]
 *
 * BooleanValue : one of `true` `false`
 *
 * EnumValue : Name but not `true`, `false` or `null`
 */
function parseValueLiteral(parser, isConst) {
  var token = parser.token;
  switch (token.kind) {
    case _lexer.TokenKind.BRACKET_L:
      return parseList(parser, isConst);
    case _lexer.TokenKind.BRACE_L:
      return parseObject(parser, isConst);
    case _lexer.TokenKind.INT:
      advance(parser);
      return {
        kind: _kinds.INT,
        value: token.value,
        loc: loc(parser, token.start)
      };
    case _lexer.TokenKind.FLOAT:
      advance(parser);
      return {
        kind: _kinds.FLOAT,
        value: token.value,
        loc: loc(parser, token.start)
      };
    case _lexer.TokenKind.STRING:
      advance(parser);
      return {
        kind: _kinds.STRING,
        value: token.value,
        loc: loc(parser, token.start)
      };
    case _lexer.TokenKind.NAME:
      if (token.value === 'true' || token.value === 'false') {
        advance(parser);
        return {
          kind: _kinds.BOOLEAN,
          value: token.value === 'true',
          loc: loc(parser, token.start)
        };
      } else if (token.value !== 'null') {
        advance(parser);
        return {
          kind: _kinds.ENUM,
          value: token.value,
          loc: loc(parser, token.start)
        };
      }
      break;
    case _lexer.TokenKind.DOLLAR:
      if (!isConst) {
        return parseVariable(parser);
      }
      break;
  }
  throw unexpected(parser);
}

function parseConstValue(parser) {
  return parseValueLiteral(parser, true);
}

function parseValueValue(parser) {
  return parseValueLiteral(parser, false);
}

/**
 * ListValue[Const] :
 *   - [ ]
 *   - [ Value[?Const]+ ]
 */
function parseList(parser, isConst) {
  var start = parser.token.start;
  var item = isConst ? parseConstValue : parseValueValue;
  return {
    kind: _kinds.LIST,
    values: any(parser, _lexer.TokenKind.BRACKET_L, item, _lexer.TokenKind.BRACKET_R),
    loc: loc(parser, start)
  };
}

/**
 * ObjectValue[Const] :
 *   - { }
 *   - { ObjectField[?Const]+ }
 */
function parseObject(parser, isConst) {
  var start = parser.token.start;
  expect(parser, _lexer.TokenKind.BRACE_L);
  var fields = [];
  while (!skip(parser, _lexer.TokenKind.BRACE_R)) {
    fields.push(parseObjectField(parser, isConst));
  }
  return {
    kind: _kinds.OBJECT,
    fields: fields,
    loc: loc(parser, start)
  };
}

/**
 * ObjectField[Const] : Name : Value[?Const]
 */
function parseObjectField(parser, isConst) {
  var start = parser.token.start;
  return {
    kind: _kinds.OBJECT_FIELD,
    name: parseName(parser),
    value: (expect(parser, _lexer.TokenKind.COLON), parseValueLiteral(parser, isConst)),
    loc: loc(parser, start)
  };
}

// Implements the parsing rules in the Directives section.

/**
 * Directives : Directive+
 */
function parseDirectives(parser) {
  var directives = [];
  while (peek(parser, _lexer.TokenKind.AT)) {
    directives.push(parseDirective(parser));
  }
  return directives;
}

/**
 * Directive : @ Name Arguments?
 */
function parseDirective(parser) {
  var start = parser.token.start;
  expect(parser, _lexer.TokenKind.AT);
  return {
    kind: _kinds.DIRECTIVE,
    name: parseName(parser),
    arguments: parseArguments(parser),
    loc: loc(parser, start)
  };
}

// Implements the parsing rules in the Types section.

/**
 * Type :
 *   - NamedType
 *   - ListType
 *   - NonNullType
 */
function parseType(parser) {
  var start = parser.token.start;
  var type = void 0;
  if (skip(parser, _lexer.TokenKind.BRACKET_L)) {
    type = parseType(parser);
    expect(parser, _lexer.TokenKind.BRACKET_R);
    type = {
      kind: _kinds.LIST_TYPE,
      type: type,
      loc: loc(parser, start)
    };
  } else {
    type = parseNamedType(parser);
  }
  if (skip(parser, _lexer.TokenKind.BANG)) {
    return {
      kind: _kinds.NON_NULL_TYPE,
      type: type,
      loc: loc(parser, start)
    };
  }
  return type;
}

/**
 * NamedType : Name
 */
function parseNamedType(parser) {
  var start = parser.token.start;
  return {
    kind: _kinds.NAMED_TYPE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}

// Implements the parsing rules in the Type Definition section.

/**
 * TypeSystemDefinition :
 *   - TypeDefinition
 *   - TypeExtensionDefinition
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
function parseTypeSystemDefinition(parser) {
  if (peek(parser, _lexer.TokenKind.NAME)) {
    switch (parser.token.value) {
      case 'schema':
        return parseSchemaDefinition(parser);
      case 'scalar':
        return parseScalarTypeDefinition(parser);
      case 'type':
        return parseObjectTypeDefinition(parser);
      case 'interface':
        return parseInterfaceTypeDefinition(parser);
      case 'union':
        return parseUnionTypeDefinition(parser);
      case 'enum':
        return parseEnumTypeDefinition(parser);
      case 'input':
        return parseInputObjectTypeDefinition(parser);
      case 'extend':
        return parseTypeExtensionDefinition(parser);
      case 'directive':
        return parseDirectiveDefinition(parser);
    }
  }

  throw unexpected(parser);
}

/**
 * SchemaDefinition : schema { OperationTypeDefinition+ }
 *
 * OperationTypeDefinition : OperationType : NamedType
 */
function parseSchemaDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'schema');
  var operationTypes = many(parser, _lexer.TokenKind.BRACE_L, parseOperationTypeDefinition, _lexer.TokenKind.BRACE_R);
  return {
    kind: _kinds.SCHEMA_DEFINITION,
    operationTypes: operationTypes,
    loc: loc(parser, start)
  };
}

function parseOperationTypeDefinition(parser) {
  var start = parser.token.start;
  var operation = parseOperationType(parser);
  expect(parser, _lexer.TokenKind.COLON);
  var type = parseNamedType(parser);
  return {
    kind: _kinds.OPERATION_TYPE_DEFINITION,
    operation: operation,
    type: type,
    loc: loc(parser, start)
  };
}

/**
 * ScalarTypeDefinition : scalar Name
 */
function parseScalarTypeDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'scalar');
  var name = parseName(parser);
  return {
    kind: _kinds.SCALAR_TYPE_DEFINITION,
    name: name,
    loc: loc(parser, start)
  };
}

/**
 * ObjectTypeDefinition : type Name ImplementsInterfaces? { FieldDefinition+ }
 */
function parseObjectTypeDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'type');
  var name = parseName(parser);
  var interfaces = parseImplementsInterfaces(parser);
  var fields = any(parser, _lexer.TokenKind.BRACE_L, parseFieldDefinition, _lexer.TokenKind.BRACE_R);
  return {
    kind: _kinds.OBJECT_TYPE_DEFINITION,
    name: name,
    interfaces: interfaces,
    fields: fields,
    loc: loc(parser, start)
  };
}

/**
 * ImplementsInterfaces : implements NamedType+
 */
function parseImplementsInterfaces(parser) {
  var types = [];
  if (parser.token.value === 'implements') {
    advance(parser);
    do {
      types.push(parseNamedType(parser));
    } while (!peek(parser, _lexer.TokenKind.BRACE_L));
  }
  return types;
}

/**
 * FieldDefinition : Name ArgumentsDefinition? : Type
 */
function parseFieldDefinition(parser) {
  var start = parser.token.start;
  var name = parseName(parser);
  var args = parseArgumentDefs(parser);
  expect(parser, _lexer.TokenKind.COLON);
  var type = parseType(parser);
  return {
    kind: _kinds.FIELD_DEFINITION,
    name: name,
    arguments: args,
    type: type,
    loc: loc(parser, start)
  };
}

/**
 * ArgumentsDefinition : ( InputValueDefinition+ )
 */
function parseArgumentDefs(parser) {
  if (!peek(parser, _lexer.TokenKind.PAREN_L)) {
    return [];
  }
  return many(parser, _lexer.TokenKind.PAREN_L, parseInputValueDef, _lexer.TokenKind.PAREN_R);
}

/**
 * InputValueDefinition : Name : Type DefaultValue?
 */
function parseInputValueDef(parser) {
  var start = parser.token.start;
  var name = parseName(parser);
  expect(parser, _lexer.TokenKind.COLON);
  var type = parseType(parser);
  var defaultValue = null;
  if (skip(parser, _lexer.TokenKind.EQUALS)) {
    defaultValue = parseConstValue(parser);
  }
  return {
    kind: _kinds.INPUT_VALUE_DEFINITION,
    name: name,
    type: type,
    defaultValue: defaultValue,
    loc: loc(parser, start)
  };
}

/**
 * InterfaceTypeDefinition : interface Name { FieldDefinition+ }
 */
function parseInterfaceTypeDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'interface');
  var name = parseName(parser);
  var fields = any(parser, _lexer.TokenKind.BRACE_L, parseFieldDefinition, _lexer.TokenKind.BRACE_R);
  return {
    kind: _kinds.INTERFACE_TYPE_DEFINITION,
    name: name,
    fields: fields,
    loc: loc(parser, start)
  };
}

/**
 * UnionTypeDefinition : union Name = UnionMembers
 */
function parseUnionTypeDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'union');
  var name = parseName(parser);
  expect(parser, _lexer.TokenKind.EQUALS);
  var types = parseUnionMembers(parser);
  return {
    kind: _kinds.UNION_TYPE_DEFINITION,
    name: name,
    types: types,
    loc: loc(parser, start)
  };
}

/**
 * UnionMembers :
 *   - NamedType
 *   - UnionMembers | NamedType
 */
function parseUnionMembers(parser) {
  var members = [];
  do {
    members.push(parseNamedType(parser));
  } while (skip(parser, _lexer.TokenKind.PIPE));
  return members;
}

/**
 * EnumTypeDefinition : enum Name { EnumValueDefinition+ }
 */
function parseEnumTypeDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'enum');
  var name = parseName(parser);
  var values = many(parser, _lexer.TokenKind.BRACE_L, parseEnumValueDefinition, _lexer.TokenKind.BRACE_R);
  return {
    kind: _kinds.ENUM_TYPE_DEFINITION,
    name: name,
    values: values,
    loc: loc(parser, start)
  };
}

/**
 * EnumValueDefinition : EnumValue
 *
 * EnumValue : Name
 */
function parseEnumValueDefinition(parser) {
  var start = parser.token.start;
  var name = parseName(parser);
  return {
    kind: _kinds.ENUM_VALUE_DEFINITION,
    name: name,
    loc: loc(parser, start)
  };
}

/**
 * InputObjectTypeDefinition : input Name { InputValueDefinition+ }
 */
function parseInputObjectTypeDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'input');
  var name = parseName(parser);
  var fields = any(parser, _lexer.TokenKind.BRACE_L, parseInputValueDef, _lexer.TokenKind.BRACE_R);
  return {
    kind: _kinds.INPUT_OBJECT_TYPE_DEFINITION,
    name: name,
    fields: fields,
    loc: loc(parser, start)
  };
}

/**
 * TypeExtensionDefinition : extend ObjectTypeDefinition
 */
function parseTypeExtensionDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'extend');
  var definition = parseObjectTypeDefinition(parser);
  return {
    kind: _kinds.TYPE_EXTENSION_DEFINITION,
    definition: definition,
    loc: loc(parser, start)
  };
}

/**
 * DirectiveDefinition :
 *   - directive @ Name ArgumentsDefinition? on DirectiveLocations
 */
function parseDirectiveDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'directive');
  expect(parser, _lexer.TokenKind.AT);
  var name = parseName(parser);
  var args = parseArgumentDefs(parser);
  expectKeyword(parser, 'on');
  var locations = parseDirectiveLocations(parser);
  return {
    kind: _kinds.DIRECTIVE_DEFINITION,
    name: name,
    arguments: args,
    locations: locations,
    loc: loc(parser, start)
  };
}

/**
 * DirectiveLocations :
 *   - Name
 *   - DirectiveLocations | Name
 */
function parseDirectiveLocations(parser) {
  var locations = [];
  do {
    locations.push(parseName(parser));
  } while (skip(parser, _lexer.TokenKind.PIPE));
  return locations;
}

// Core parsing utility functions

/**
 * Returns the parser object that is used to store state throughout the
 * process of parsing.
 */
function makeParser(source, options) {
  var _lexToken = (0, _lexer.lex)(source);
  return {
    _lexToken: _lexToken,
    source: source,
    options: options,
    prevEnd: 0,
    token: _lexToken()
  };
}

/**
 * Returns a location object, used to identify the place in
 * the source that created a given parsed object.
 */
function loc(parser, start) {
  if (parser.options.noLocation) {
    return null;
  }
  if (parser.options.noSource) {
    return { start: start, end: parser.prevEnd };
  }
  return { start: start, end: parser.prevEnd, source: parser.source };
}

/**
 * Moves the internal parser object to the next lexed token.
 */
function advance(parser) {
  var prevEnd = parser.token.end;
  parser.prevEnd = prevEnd;
  parser.token = parser._lexToken(prevEnd);
}

/**
 * Determines if the next token is of a given kind
 */
function peek(parser, kind) {
  return parser.token.kind === kind;
}

/**
 * If the next token is of the given kind, return true after advancing
 * the parser. Otherwise, do not change the parser state and return false.
 */
function skip(parser, kind) {
  var match = parser.token.kind === kind;
  if (match) {
    advance(parser);
  }
  return match;
}

/**
 * If the next token is of the given kind, return that token after advancing
 * the parser. Otherwise, do not change the parser state and throw an error.
 */
function expect(parser, kind) {
  var token = parser.token;
  if (token.kind === kind) {
    advance(parser);
    return token;
  }
  throw (0, _error.syntaxError)(parser.source, token.start, 'Expected ' + (0, _lexer.getTokenKindDesc)(kind) + ', found ' + (0, _lexer.getTokenDesc)(token));
}

/**
 * If the next token is a keyword with the given value, return that token after
 * advancing the parser. Otherwise, do not change the parser state and return
 * false.
 */
function expectKeyword(parser, value) {
  var token = parser.token;
  if (token.kind === _lexer.TokenKind.NAME && token.value === value) {
    advance(parser);
    return token;
  }
  throw (0, _error.syntaxError)(parser.source, token.start, 'Expected "' + value + '", found ' + (0, _lexer.getTokenDesc)(token));
}

/**
 * Helper function for creating an error when an unexpected lexed token
 * is encountered.
 */
function unexpected(parser, atToken) {
  var token = atToken || parser.token;
  return (0, _error.syntaxError)(parser.source, token.start, 'Unexpected ' + (0, _lexer.getTokenDesc)(token));
}

/**
 * Returns a possibly empty list of parse nodes, determined by
 * the parseFn. This list begins with a lex token of openKind
 * and ends with a lex token of closeKind. Advances the parser
 * to the next lex token after the closing token.
 */
function any(parser, openKind, parseFn, closeKind) {
  expect(parser, openKind);
  var nodes = [];
  while (!skip(parser, closeKind)) {
    nodes.push(parseFn(parser));
  }
  return nodes;
}

/**
 * Returns a non-empty list of parse nodes, determined by
 * the parseFn. This list begins with a lex token of openKind
 * and ends with a lex token of closeKind. Advances the parser
 * to the next lex token after the closing token.
 */
function many(parser, openKind, parseFn, closeKind) {
  expect(parser, openKind);
  var nodes = [parseFn(parser)];
  while (!skip(parser, closeKind)) {
    nodes.push(parseFn(parser));
  }
  return nodes;
}