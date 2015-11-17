/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { Source } from './source';
import { syntaxError } from '../error';
import { lex, TokenKind, getTokenKindDesc, getTokenDesc } from './lexer';
import type { Token } from './lexer';
import type {
  Name,
  Variable,

  Document,
  Definition,
  OperationDefinition,
  VariableDefinition,
  SelectionSet,
  Selection,
  Field,
  Argument,

  FragmentSpread,
  InlineFragment,
  FragmentDefinition,

  Value,
  ListValue,
  ObjectValue,
  ObjectField,

  Directive,

  Type,
  NamedType,

  TypeDefinition,
  ObjectTypeDefinition,
  FieldDefinition,
  InputValueDefinition,
  InterfaceTypeDefinition,
  UnionTypeDefinition,
  ScalarTypeDefinition,
  EnumTypeDefinition,
  EnumValueDefinition,
  InputObjectTypeDefinition,

  TypeExtensionDefinition,
} from './ast';

import {
  NAME,
  VARIABLE,

  DOCUMENT,
  OPERATION_DEFINITION,
  VARIABLE_DEFINITION,
  SELECTION_SET,
  FIELD,
  ARGUMENT,

  FRAGMENT_SPREAD,
  INLINE_FRAGMENT,
  FRAGMENT_DEFINITION,

  INT,
  FLOAT,
  STRING,
  BOOLEAN,
  ENUM,
  LIST,
  OBJECT,
  OBJECT_FIELD,

  DIRECTIVE,

  NAMED_TYPE,
  LIST_TYPE,
  NON_NULL_TYPE,

  OBJECT_TYPE_DEFINITION,
  FIELD_DEFINITION,
  INPUT_VALUE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  SCALAR_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  ENUM_VALUE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,

  TYPE_EXTENSION_DEFINITION,
} from './kinds';


/**
 * Configuration options to control parser behavior
 */
export type ParseOptions = {
  /**
   * By default, the parser creates AST nodes that know the location
   * in the source that they correspond to. This configuration flag
   * disables that behavior for performance or testing.
   */
  noLocation?: boolean,

  /**
   * By default, the parser creates AST nodes that contain a reference
   * to the source that they were created from. This configuration flag
   * disables that behavior for performance or testing.
   */
  noSource?: boolean,
}

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */
export function parse(
  source: Source | string,
  options?: ParseOptions
): Document {
  var sourceObj = source instanceof Source ? source : new Source(source);
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
export function parseValue(
  source: Source | string,
  options?: ParseOptions
): Value {
  var sourceObj = source instanceof Source ? source : new Source(source);
  var parser = makeParser(sourceObj, options || {});
  return parseValueLiteral(parser);
}

/**
 * Converts a name lex token into a name parse node.
 */
function parseName(parser): Name {
  var token = expect(parser, TokenKind.NAME);
  return {
    kind: NAME,
    value: token.value,
    loc: loc(parser, token.start)
  };
}

// Implements the parsing rules in the Document section.

/**
 * Document : Definition+
 */
function parseDocument(parser): Document {
  var start = parser.token.start;

  var definitions = [];
  do {
    definitions.push(parseDefinition(parser));
  } while (!skip(parser, TokenKind.EOF));

  return {
    kind: DOCUMENT,
    definitions,
    loc: loc(parser, start)
  };
}

/**
 * Definition :
 *   - OperationDefinition
 *   - FragmentDefinition
 *   - TypeDefinition
 */
function parseDefinition(parser): Definition {
  if (peek(parser, TokenKind.BRACE_L)) {
    return parseOperationDefinition(parser);
  }

  if (peek(parser, TokenKind.NAME)) {
    switch (parser.token.value) {
      case 'query':
      case 'mutation':
      // Note: subscription is an experimental non-spec addition.
      case 'subscription': return parseOperationDefinition(parser);

      case 'fragment': return parseFragmentDefinition(parser);

      case 'type':
      case 'interface':
      case 'union':
      case 'scalar':
      case 'enum':
      case 'input':
      case 'extend': return parseTypeDefinition(parser);
    }
  }

  throw unexpected(parser);
}


// Implements the parsing rules in the Operations section.

/**
 * OperationDefinition :
 *  - SelectionSet
 *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
 *
 * OperationType : one of query mutation
 */
function parseOperationDefinition(parser): OperationDefinition {
  var start = parser.token.start;
  if (peek(parser, TokenKind.BRACE_L)) {
    return {
      kind: OPERATION_DEFINITION,
      operation: 'query',
      name: null,
      variableDefinitions: null,
      directives: [],
      selectionSet: parseSelectionSet(parser),
      loc: loc(parser, start)
    };
  }
  var operationToken = expect(parser, TokenKind.NAME);
  var operation = operationToken.value;
  var name;
  if (peek(parser, TokenKind.NAME)) {
    name = parseName(parser);
  }
  return {
    kind: OPERATION_DEFINITION,
    operation,
    name,
    variableDefinitions: parseVariableDefinitions(parser),
    directives: parseDirectives(parser),
    selectionSet: parseSelectionSet(parser),
    loc: loc(parser, start)
  };
}

/**
 * VariableDefinitions : ( VariableDefinition+ )
 */
function parseVariableDefinitions(parser): Array<VariableDefinition> {
  return peek(parser, TokenKind.PAREN_L) ?
    many(
      parser,
      TokenKind.PAREN_L,
      parseVariableDefinition,
      TokenKind.PAREN_R
    ) :
    [];
}

/**
 * VariableDefinition : Variable : Type DefaultValue?
 */
function parseVariableDefinition(parser): VariableDefinition {
  var start = parser.token.start;
  return {
    kind: VARIABLE_DEFINITION,
    variable: parseVariable(parser),
    type: (expect(parser, TokenKind.COLON), parseType(parser)),
    defaultValue:
      skip(parser, TokenKind.EQUALS) ? parseValueLiteral(parser, true) : null,
    loc: loc(parser, start)
  };
}

/**
 * Variable : $ Name
 */
function parseVariable(parser): Variable {
  var start = parser.token.start;
  expect(parser, TokenKind.DOLLAR);
  return {
    kind: VARIABLE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}

/**
 * SelectionSet : { Selection+ }
 */
function parseSelectionSet(parser): SelectionSet {
  var start = parser.token.start;
  return {
    kind: SELECTION_SET,
    selections:
      many(parser, TokenKind.BRACE_L, parseSelection, TokenKind.BRACE_R),
    loc: loc(parser, start)
  };
}

/**
 * Selection :
 *   - Field
 *   - FragmentSpread
 *   - InlineFragment
 */
function parseSelection(parser): Selection {
  return peek(parser, TokenKind.SPREAD) ?
    parseFragment(parser) :
    parseField(parser);
}

/**
 * Field : Alias? Name Arguments? Directives? SelectionSet?
 *
 * Alias : Name :
 */
function parseField(parser): Field {
  var start = parser.token.start;

  var nameOrAlias = parseName(parser);
  var alias;
  var name;
  if (skip(parser, TokenKind.COLON)) {
    alias = nameOrAlias;
    name = parseName(parser);
  } else {
    alias = null;
    name = nameOrAlias;
  }

  return {
    kind: FIELD,
    alias,
    name,
    arguments: parseArguments(parser),
    directives: parseDirectives(parser),
    selectionSet:
      peek(parser, TokenKind.BRACE_L) ? parseSelectionSet(parser) : null,
    loc: loc(parser, start)
  };
}

/**
 * Arguments : ( Argument+ )
 */
function parseArguments(parser): Array<Argument> {
  return peek(parser, TokenKind.PAREN_L) ?
    many(parser, TokenKind.PAREN_L, parseArgument, TokenKind.PAREN_R) :
    [];
}

/**
 * Argument : Name : Value
 */
function parseArgument(parser): Argument {
  var start = parser.token.start;
  return {
    kind: ARGUMENT,
    name: parseName(parser),
    value: (expect(parser, TokenKind.COLON), parseValueLiteral(parser, false)),
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
function parseFragment(parser): FragmentSpread | InlineFragment {
  var start = parser.token.start;
  expect(parser, TokenKind.SPREAD);
  if (peek(parser, TokenKind.NAME) && parser.token.value !== 'on') {
    return {
      kind: FRAGMENT_SPREAD,
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
    kind: INLINE_FRAGMENT,
    typeCondition,
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
function parseFragmentDefinition(parser): FragmentDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'fragment');
  return {
    kind: FRAGMENT_DEFINITION,
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
function parseFragmentName(parser): Name {
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
function parseValueLiteral(parser, isConst: boolean): Value {
  var token = parser.token;
  switch (token.kind) {
    case TokenKind.BRACKET_L:
      return parseList(parser, isConst);
    case TokenKind.BRACE_L:
      return parseObject(parser, isConst);
    case TokenKind.INT:
      advance(parser);
      return {
        kind: INT,
        value: token.value,
        loc: loc(parser, token.start)
      };
    case TokenKind.FLOAT:
      advance(parser);
      return {
        kind: FLOAT,
        value: token.value,
        loc: loc(parser, token.start)
      };
    case TokenKind.STRING:
      advance(parser);
      return {
        kind: STRING,
        value: token.value,
        loc: loc(parser, token.start)
      };
    case TokenKind.NAME:
      if (token.value === 'true' || token.value === 'false') {
        advance(parser);
        return {
          kind: BOOLEAN,
          value: token.value === 'true',
          loc: loc(parser, token.start)
        };
      } else if (token.value !== 'null') {
        advance(parser);
        return {
          kind: ENUM,
          value: token.value,
          loc: loc(parser, token.start)
        };
      }
      break;
    case TokenKind.DOLLAR:
      if (!isConst) {
        return parseVariable(parser);
      }
      break;
  }
  throw unexpected(parser);
}

export function parseConstValue(parser): Value {
  return parseValueLiteral(parser, true);
}

function parseValueValue(parser): Value {
  return parseValueLiteral(parser, false);
}

/**
 * ListValue[Const] :
 *   - [ ]
 *   - [ Value[?Const]+ ]
 */
function parseList(parser, isConst: boolean): ListValue {
  var start = parser.token.start;
  var item = isConst ? parseConstValue : parseValueValue;
  return {
    kind: LIST,
    values: any(parser, TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
    loc: loc(parser, start)
  };
}

/**
 * ObjectValue[Const] :
 *   - { }
 *   - { ObjectField[?Const]+ }
 */
function parseObject(parser, isConst: boolean): ObjectValue {
  var start = parser.token.start;
  expect(parser, TokenKind.BRACE_L);
  var fields = [];
  while (!skip(parser, TokenKind.BRACE_R)) {
    fields.push(parseObjectField(parser, isConst));
  }
  return {
    kind: OBJECT,
    fields,
    loc: loc(parser, start)
  };
}

/**
 * ObjectField[Const] : Name : Value[?Const]
 */
function parseObjectField(parser, isConst: boolean): ObjectField {
  var start = parser.token.start;
  return {
    kind: OBJECT_FIELD,
    name: parseName(parser),
    value:
      (expect(parser, TokenKind.COLON), parseValueLiteral(parser, isConst)),
    loc: loc(parser, start)
  };
}


// Implements the parsing rules in the Directives section.

/**
 * Directives : Directive+
 */
function parseDirectives(parser): Array<Directive> {
  var directives = [];
  while (peek(parser, TokenKind.AT)) {
    directives.push(parseDirective(parser));
  }
  return directives;
}

/**
 * Directive : @ Name Arguments?
 */
function parseDirective(parser): Directive {
  var start = parser.token.start;
  expect(parser, TokenKind.AT);
  return {
    kind: DIRECTIVE,
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
export function parseType(parser): Type {
  var start = parser.token.start;
  var type;
  if (skip(parser, TokenKind.BRACKET_L)) {
    type = parseType(parser);
    expect(parser, TokenKind.BRACKET_R);
    type = {
      kind: LIST_TYPE,
      type,
      loc: loc(parser, start)
    };
  } else {
    type = parseNamedType(parser);
  }
  if (skip(parser, TokenKind.BANG)) {
    return {
      kind: NON_NULL_TYPE,
      type,
      loc: loc(parser, start)
    };
  }
  return type;
}

/**
 * NamedType : Name
 */
export function parseNamedType(parser): NamedType {
  var start = parser.token.start;
  return {
    kind: NAMED_TYPE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}


// Implements the parsing rules in the Type Definition section.

/**
 * TypeDefinition :
 *   - ObjectTypeDefinition
 *   - InterfaceTypeDefinition
 *   - UnionTypeDefinition
 *   - ScalarTypeDefinition
 *   - EnumTypeDefinition
 *   - InputObjectTypeDefinition
 *   - TypeExtensionDefinition
 */
function parseTypeDefinition(parser): TypeDefinition {
  if (!peek(parser, TokenKind.NAME)) {
    throw unexpected(parser);
  }
  switch (parser.token.value) {
    case 'type':
      return parseObjectTypeDefinition(parser);
    case 'interface':
      return parseInterfaceTypeDefinition(parser);
    case 'union':
      return parseUnionTypeDefinition(parser);
    case 'scalar':
      return parseScalarTypeDefinition(parser);
    case 'enum':
      return parseEnumTypeDefinition(parser);
    case 'input':
      return parseInputObjectTypeDefinition(parser);
    case 'extend':
      return parseTypeExtensionDefinition(parser);
    default:
      throw unexpected(parser);
  }
}

/**
 * ObjectTypeDefinition : type Name ImplementsInterfaces? { FieldDefinition+ }
 */
function parseObjectTypeDefinition(parser): ObjectTypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'type');
  var name = parseName(parser);
  var interfaces = parseImplementsInterfaces(parser);
  var fields = any(
    parser,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: OBJECT_TYPE_DEFINITION,
    name,
    interfaces,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * ImplementsInterfaces : implements NamedType+
 */
function parseImplementsInterfaces(parser): Array<NamedType> {
  var types = [];
  if (parser.token.value === 'implements') {
    advance(parser);
    do {
      types.push(parseNamedType(parser));
    } while (!peek(parser, TokenKind.BRACE_L));
  }
  return types;
}

/**
 * FieldDefinition : Name ArgumentsDefinition? : Type
 */
function parseFieldDefinition(parser): FieldDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  var args = parseArgumentDefs(parser);
  expect(parser, TokenKind.COLON);
  var type = parseType(parser);
  return {
    kind: FIELD_DEFINITION,
    name,
    arguments: args,
    type,
    loc: loc(parser, start),
  };
}

/**
 * ArgumentsDefinition : ( InputValueDefinition+ )
 */
function parseArgumentDefs(parser): Array<InputValueDefinition> {
  if (!peek(parser, TokenKind.PAREN_L)) {
    return [];
  }
  return many(parser, TokenKind.PAREN_L, parseInputValueDef, TokenKind.PAREN_R);
}

/**
 * InputValueDefinition : Name : Type DefaultValue?
 */
function parseInputValueDef(parser): InputValueDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  expect(parser, TokenKind.COLON);
  var type = parseType(parser);
  var defaultValue = null;
  if (skip(parser, TokenKind.EQUALS)) {
    defaultValue = parseConstValue(parser);
  }
  return {
    kind: INPUT_VALUE_DEFINITION,
    name,
    type,
    defaultValue,
    loc: loc(parser, start),
  };
}

/**
 * InterfaceTypeDefinition : interface Name { FieldDefinition+ }
 */
function parseInterfaceTypeDefinition(parser): InterfaceTypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'interface');
  var name = parseName(parser);
  var fields = any(
    parser,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: INTERFACE_TYPE_DEFINITION,
    name,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * UnionTypeDefinition : union Name = UnionMembers
 */
function parseUnionTypeDefinition(parser): UnionTypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'union');
  var name = parseName(parser);
  expect(parser, TokenKind.EQUALS);
  var types = parseUnionMembers(parser);
  return {
    kind: UNION_TYPE_DEFINITION,
    name,
    types,
    loc: loc(parser, start),
  };
}

/**
 * UnionMembers :
 *   - NamedType
 *   - UnionMembers | NamedType
 */
function parseUnionMembers(parser): Array<NamedType> {
  var members = [];
  do {
    members.push(parseNamedType(parser));
  } while (skip(parser, TokenKind.PIPE));
  return members;
}

/**
 * ScalarTypeDefinition : scalar Name
 */
function parseScalarTypeDefinition(parser): ScalarTypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'scalar');
  var name = parseName(parser);
  return {
    kind: SCALAR_TYPE_DEFINITION,
    name,
    loc: loc(parser, start),
  };
}

/**
 * EnumTypeDefinition : enum Name { EnumValueDefinition+ }
 */
function parseEnumTypeDefinition(parser): EnumTypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'enum');
  var name = parseName(parser);
  var values = many(
    parser,
    TokenKind.BRACE_L,
    parseEnumValueDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: ENUM_TYPE_DEFINITION,
    name,
    values,
    loc: loc(parser, start),
  };
}

/**
 * EnumValueDefinition : EnumValue
 *
 * EnumValue : Name
 */
function parseEnumValueDefinition(parser) : EnumValueDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  return {
    kind: ENUM_VALUE_DEFINITION,
    name,
    loc: loc(parser, start),
  };
}

/**
 * InputObjectTypeDefinition : input Name { InputValueDefinition+ }
 */
function parseInputObjectTypeDefinition(parser): InputObjectTypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'input');
  var name = parseName(parser);
  var fields = any(
    parser,
    TokenKind.BRACE_L,
    parseInputValueDef,
    TokenKind.BRACE_R
  );
  return {
    kind: INPUT_OBJECT_TYPE_DEFINITION,
    name,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * TypeExtensionDefinition : extend ObjectTypeDefinition
 */
function parseTypeExtensionDefinition(parser): TypeExtensionDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'extend');
  var definition = parseObjectTypeDefinition(parser);
  return {
    kind: TYPE_EXTENSION_DEFINITION,
    definition,
    loc: loc(parser, start),
  };
}


// Core parsing utility functions

/**
 * Returns the parser object that is used to store state throughout the
 * process of parsing.
 */
function makeParser(source: Source, options: ParseOptions) {
  var _lexToken = lex(source);
  return {
    _lexToken,
    source,
    options,
    prevEnd: 0,
    token: _lexToken(),
  };
}

/**
 * Returns a location object, used to identify the place in
 * the source that created a given parsed object.
 */
function loc(parser, start: number) {
  if (parser.options.noLocation) {
    return null;
  }
  if (parser.options.noSource) {
    return { start, end: parser.prevEnd };
  }
  return { start, end: parser.prevEnd, source: parser.source };
}

/**
 * Moves the internal parser object to the next lexed token.
 */
function advance(parser): void {
  var prevEnd = parser.token.end;
  parser.prevEnd = prevEnd;
  parser.token = parser._lexToken(prevEnd);
}

/**
 * Determines if the next token is of a given kind
 */
function peek(parser, kind: string): boolean {
  return parser.token.kind === kind;
}

/**
 * If the next token is of the given kind, return true after advancing
 * the parser. Otherwise, do not change the parser state and return false.
 */
function skip(parser, kind: string): boolean {
  var match = parser.token.kind === kind;
  if (match) {
    advance(parser);
  }
  return match;
}

/**
 * If the next token is of the given kind, return that token after advancing
 * the parser. Otherwise, do not change the parser state and return false.
 */
function expect(parser, kind: string): Token {
  var token = parser.token;
  if (token.kind === kind) {
    advance(parser);
    return token;
  }
  throw syntaxError(
    parser.source,
    token.start,
    `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}`
  );
}

/**
 * If the next token is a keyword with the given value, return that token after
 * advancing the parser. Otherwise, do not change the parser state and return
 * false.
 */
function expectKeyword(parser, value: string): Token {
  var token = parser.token;
  if (token.kind === TokenKind.NAME && token.value === value) {
    advance(parser);
    return token;
  }
  throw syntaxError(
    parser.source,
    token.start,
    `Expected "${value}", found ${getTokenDesc(token)}`
  );
}

/**
 * Helper function for creating an error when an unexpected lexed token
 * is encountered.
 */
function unexpected(parser, atToken?: ?Token): Error {
  var token = atToken || parser.token;
  return syntaxError(
    parser.source,
    token.start,
    `Unexpected ${getTokenDesc(token)}`
  );
}

/**
 * Returns a possibly empty list of parse nodes, determined by
 * the parseFn. This list begins with a lex token of openKind
 * and ends with a lex token of closeKind. Advances the parser
 * to the next lex token after the closing token.
 */
function any<T>(
  parser,
  openKind: string,
  parseFn: (parser: any) => T,
  closeKind: string
): Array<T> {
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
function many<T>(
  parser,
  openKind: string,
  parseFn: (parser: any) => T,
  closeKind: string
): Array<T> {
  expect(parser, openKind);
  var nodes = [ parseFn(parser) ];
  while (!skip(parser, closeKind)) {
    nodes.push(parseFn(parser));
  }
  return nodes;
}
