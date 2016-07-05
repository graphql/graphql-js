/* @flow */
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
  OperationType,
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
  ListType,
  NonNullType,

  TypeSystemDefinition,

  SchemaDefinition,
  OperationTypeDefinition,

  ScalarTypeDefinition,
  ObjectTypeDefinition,
  FieldDefinition,
  InputValueDefinition,
  InterfaceTypeDefinition,
  UnionTypeDefinition,
  EnumTypeDefinition,
  EnumValueDefinition,
  InputObjectTypeDefinition,

  TypeExtensionDefinition,

  DirectiveDefinition,
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

  SCHEMA_DEFINITION,
  OPERATION_TYPE_DEFINITION,

  SCALAR_TYPE_DEFINITION,
  OBJECT_TYPE_DEFINITION,
  FIELD_DEFINITION,
  INPUT_VALUE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  ENUM_VALUE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,

  TYPE_EXTENSION_DEFINITION,

  DIRECTIVE_DEFINITION,
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
  const sourceObj = source instanceof Source ? source : new Source(source);
  const parser = makeParser(sourceObj, options || {});
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
  const sourceObj = source instanceof Source ? source : new Source(source);
  const parser = makeParser(sourceObj, options || {});
  return parseValueLiteral(parser, false);
}

/**
 * Converts a name lex token into a name parse node.
 */
function parseName(parser: Parser): Name {
  const token = expect(parser, TokenKind.NAME);
  return {
    kind: NAME,
    value: ((token.value: any): string),
    loc: loc(parser, token.start)
  };
}

// Implements the parsing rules in the Document section.

/**
 * Document : Definition+
 */
function parseDocument(parser: Parser): Document {
  const start = parser.token.start;

  const definitions = [];
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
 *   - TypeSystemDefinition
 */
function parseDefinition(parser: Parser): Definition {
  if (peek(parser, TokenKind.BRACE_L)) {
    return parseOperationDefinition(parser);
  }

  if (peek(parser, TokenKind.NAME)) {
    switch (parser.token.value) {
      // Note: subscription is an experimental non-spec addition.
      case 'query':
      case 'mutation':
      case 'subscription':
        return parseOperationDefinition(parser);

      case 'fragment': return parseFragmentDefinition(parser);

      // Note: the Type System IDL is an experimental non-spec addition.
      case 'schema':
      case 'scalar':
      case 'type':
      case 'interface':
      case 'union':
      case 'enum':
      case 'input':
      case 'extend':
      case 'directive': return parseTypeSystemDefinition(parser);
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
function parseOperationDefinition(parser: Parser): OperationDefinition {
  const start = parser.token.start;
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
  const operation = parseOperationType(parser);
  let name;
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
 * OperationType : one of query mutation subscription
 */
function parseOperationType(parser: Parser): OperationType {
  const operationToken = expect(parser, TokenKind.NAME);
  switch (operationToken.value) {
    case 'query': return 'query';
    case 'mutation': return 'mutation';
    // Note: subscription is an experimental non-spec addition.
    case 'subscription': return 'subscription';
  }

  throw unexpected(parser, operationToken);
}

/**
 * VariableDefinitions : ( VariableDefinition+ )
 */
function parseVariableDefinitions(parser: Parser): Array<VariableDefinition> {
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
function parseVariableDefinition(parser: Parser): VariableDefinition {
  const start = parser.token.start;
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
function parseVariable(parser: Parser): Variable {
  const start = parser.token.start;
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
function parseSelectionSet(parser: Parser): SelectionSet {
  const start = parser.token.start;
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
function parseSelection(parser: Parser): Selection {
  return peek(parser, TokenKind.SPREAD) ?
    parseFragment(parser) :
    parseField(parser);
}

/**
 * Field : Alias? Name Arguments? Directives? SelectionSet?
 *
 * Alias : Name :
 */
function parseField(parser: Parser): Field {
  const start = parser.token.start;

  const nameOrAlias = parseName(parser);
  let alias;
  let name;
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
function parseArguments(parser: Parser): Array<Argument> {
  return peek(parser, TokenKind.PAREN_L) ?
    many(parser, TokenKind.PAREN_L, parseArgument, TokenKind.PAREN_R) :
    [];
}

/**
 * Argument : Name : Value
 */
function parseArgument(parser: Parser): Argument {
  const start = parser.token.start;
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
function parseFragment(parser: Parser): FragmentSpread | InlineFragment {
  const start = parser.token.start;
  expect(parser, TokenKind.SPREAD);
  if (peek(parser, TokenKind.NAME) && parser.token.value !== 'on') {
    return {
      kind: FRAGMENT_SPREAD,
      name: parseFragmentName(parser),
      directives: parseDirectives(parser),
      loc: loc(parser, start)
    };
  }
  let typeCondition = null;
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
function parseFragmentDefinition(parser: Parser): FragmentDefinition {
  const start = parser.token.start;
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
function parseFragmentName(parser: Parser): Name {
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
function parseValueLiteral(parser: Parser, isConst: boolean): Value {
  const token = parser.token;
  switch (token.kind) {
    case TokenKind.BRACKET_L:
      return parseList(parser, isConst);
    case TokenKind.BRACE_L:
      return parseObject(parser, isConst);
    case TokenKind.INT:
      advance(parser);
      return {
        kind: (INT: 'IntValue'),
        value: ((token.value: any): string),
        loc: loc(parser, token.start)
      };
    case TokenKind.FLOAT:
      advance(parser);
      return {
        kind: (FLOAT: 'FloatValue'),
        value: ((token.value: any): string),
        loc: loc(parser, token.start)
      };
    case TokenKind.STRING:
      advance(parser);
      return {
        kind: (STRING: 'StringValue'),
        value: ((token.value: any): string),
        loc: loc(parser, token.start)
      };
    case TokenKind.NAME:
      if (token.value === 'true' || token.value === 'false') {
        advance(parser);
        return {
          kind: (BOOLEAN: 'BooleanValue'),
          value: token.value === 'true',
          loc: loc(parser, token.start)
        };
      } else if (token.value !== 'null') {
        advance(parser);
        return {
          kind: (ENUM: 'EnumValue'),
          value: ((token.value: any): string),
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

export function parseConstValue(parser: Parser): Value {
  return parseValueLiteral(parser, true);
}

function parseValueValue(parser: Parser): Value {
  return parseValueLiteral(parser, false);
}

/**
 * ListValue[Const] :
 *   - [ ]
 *   - [ Value[?Const]+ ]
 */
function parseList(parser: Parser, isConst: boolean): ListValue {
  const start = parser.token.start;
  const item = isConst ? parseConstValue : parseValueValue;
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
function parseObject(parser: Parser, isConst: boolean): ObjectValue {
  const start = parser.token.start;
  expect(parser, TokenKind.BRACE_L);
  const fields = [];
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
function parseObjectField(parser: Parser, isConst: boolean): ObjectField {
  const start = parser.token.start;
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
function parseDirectives(parser: Parser): Array<Directive> {
  const directives = [];
  while (peek(parser, TokenKind.AT)) {
    directives.push(parseDirective(parser));
  }
  return directives;
}

/**
 * Directive : @ Name Arguments?
 */
function parseDirective(parser: Parser): Directive {
  const start = parser.token.start;
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
export function parseType(parser: Parser): Type {
  const start = parser.token.start;
  let type;
  if (skip(parser, TokenKind.BRACKET_L)) {
    type = parseType(parser);
    expect(parser, TokenKind.BRACKET_R);
    type = ({
      kind: LIST_TYPE,
      type,
      loc: loc(parser, start)
    }: ListType);
  } else {
    type = parseNamedType(parser);
  }
  if (skip(parser, TokenKind.BANG)) {
    return ({
      kind: NON_NULL_TYPE,
      type,
      loc: loc(parser, start)
    }: NonNullType);
  }
  return type;
}

/**
 * NamedType : Name
 */
export function parseNamedType(parser: Parser): NamedType {
  const start = parser.token.start;
  return {
    kind: NAMED_TYPE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}


// Implements the parsing rules in the Type Definition section.

/**
 * TypeSystemDefinition :
 *   - SchemaDefinition
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
function parseTypeSystemDefinition(parser: Parser): TypeSystemDefinition {
  if (peek(parser, TokenKind.NAME)) {
    switch (parser.token.value) {
      case 'schema': return parseSchemaDefinition(parser);
      case 'scalar': return parseScalarTypeDefinition(parser);
      case 'type': return parseObjectTypeDefinition(parser);
      case 'interface': return parseInterfaceTypeDefinition(parser);
      case 'union': return parseUnionTypeDefinition(parser);
      case 'enum': return parseEnumTypeDefinition(parser);
      case 'input': return parseInputObjectTypeDefinition(parser);
      case 'extend': return parseTypeExtensionDefinition(parser);
      case 'directive': return parseDirectiveDefinition(parser);
    }
  }

  throw unexpected(parser);
}

/**
 * SchemaDefinition : schema Directives? { OperationTypeDefinition+ }
 *
 * OperationTypeDefinition : OperationType : NamedType
 */
function parseSchemaDefinition(parser: Parser): SchemaDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'schema');
  const directives = parseDirectives(parser);
  const operationTypes = many(
    parser,
    TokenKind.BRACE_L,
    parseOperationTypeDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: SCHEMA_DEFINITION,
    directives,
    operationTypes,
    loc: loc(parser, start),
  };
}

function parseOperationTypeDefinition(parser: Parser): OperationTypeDefinition {
  const start = parser.token.start;
  const operation = parseOperationType(parser);
  expect(parser, TokenKind.COLON);
  const type = parseNamedType(parser);
  return {
    kind: OPERATION_TYPE_DEFINITION,
    operation,
    type,
    loc: loc(parser, start),
  };
}

/**
 * ScalarTypeDefinition : scalar Name Directives?
 */
function parseScalarTypeDefinition(parser: Parser): ScalarTypeDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'scalar');
  const name = parseName(parser);
  const directives = parseDirectives(parser);
  return {
    kind: SCALAR_TYPE_DEFINITION,
    name,
    directives,
    loc: loc(parser, start),
  };
}

/**
 * ObjectTypeDefinition :
 *   - type Name ImplementsInterfaces? Directives? { FieldDefinition+ }
 */
function parseObjectTypeDefinition(parser: Parser): ObjectTypeDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'type');
  const name = parseName(parser);
  const interfaces = parseImplementsInterfaces(parser);
  const directives = parseDirectives(parser);
  const fields = any(
    parser,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: OBJECT_TYPE_DEFINITION,
    name,
    interfaces,
    directives,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * ImplementsInterfaces : implements NamedType+
 */
function parseImplementsInterfaces(parser: Parser): Array<NamedType> {
  const types = [];
  if (parser.token.value === 'implements') {
    advance(parser);
    do {
      types.push(parseNamedType(parser));
    } while (peek(parser, TokenKind.NAME));
  }
  return types;
}

/**
 * FieldDefinition : Name ArgumentsDefinition? : Type Directives?
 */
function parseFieldDefinition(parser: Parser): FieldDefinition {
  const start = parser.token.start;
  const name = parseName(parser);
  const args = parseArgumentDefs(parser);
  expect(parser, TokenKind.COLON);
  const type = parseType(parser);
  const directives = parseDirectives(parser);
  return {
    kind: FIELD_DEFINITION,
    name,
    arguments: args,
    type,
    directives,
    loc: loc(parser, start),
  };
}

/**
 * ArgumentsDefinition : ( InputValueDefinition+ )
 */
function parseArgumentDefs(parser: Parser): Array<InputValueDefinition> {
  if (!peek(parser, TokenKind.PAREN_L)) {
    return [];
  }
  return many(parser, TokenKind.PAREN_L, parseInputValueDef, TokenKind.PAREN_R);
}

/**
 * InputValueDefinition : Name : Type DefaultValue? Directives?
 */
function parseInputValueDef(parser: Parser): InputValueDefinition {
  const start = parser.token.start;
  const name = parseName(parser);
  expect(parser, TokenKind.COLON);
  const type = parseType(parser);
  let defaultValue = null;
  if (skip(parser, TokenKind.EQUALS)) {
    defaultValue = parseConstValue(parser);
  }
  const directives = parseDirectives(parser);
  return {
    kind: INPUT_VALUE_DEFINITION,
    name,
    type,
    defaultValue,
    directives,
    loc: loc(parser, start),
  };
}

/**
 * InterfaceTypeDefinition : interface Name Directives? { FieldDefinition+ }
 */
function parseInterfaceTypeDefinition(parser: Parser): InterfaceTypeDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'interface');
  const name = parseName(parser);
  const directives = parseDirectives(parser);
  const fields = any(
    parser,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: INTERFACE_TYPE_DEFINITION,
    name,
    directives,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * UnionTypeDefinition : union Name Directives? = UnionMembers
 */
function parseUnionTypeDefinition(parser: Parser): UnionTypeDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'union');
  const name = parseName(parser);
  const directives = parseDirectives(parser);
  expect(parser, TokenKind.EQUALS);
  const types = parseUnionMembers(parser);
  return {
    kind: UNION_TYPE_DEFINITION,
    name,
    directives,
    types,
    loc: loc(parser, start),
  };
}

/**
 * UnionMembers :
 *   - NamedType
 *   - UnionMembers | NamedType
 */
function parseUnionMembers(parser: Parser): Array<NamedType> {
  const members = [];
  do {
    members.push(parseNamedType(parser));
  } while (skip(parser, TokenKind.PIPE));
  return members;
}

/**
 * EnumTypeDefinition : enum Name Directives? { EnumValueDefinition+ }
 */
function parseEnumTypeDefinition(parser: Parser): EnumTypeDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'enum');
  const name = parseName(parser);
  const directives = parseDirectives(parser);
  const values = many(
    parser,
    TokenKind.BRACE_L,
    parseEnumValueDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: ENUM_TYPE_DEFINITION,
    name,
    directives,
    values,
    loc: loc(parser, start),
  };
}

/**
 * EnumValueDefinition : EnumValue Directives?
 *
 * EnumValue : Name
 */
function parseEnumValueDefinition(parser: Parser) : EnumValueDefinition {
  const start = parser.token.start;
  const name = parseName(parser);
  const directives = parseDirectives(parser);
  return {
    kind: ENUM_VALUE_DEFINITION,
    name,
    directives,
    loc: loc(parser, start),
  };
}

/**
 * InputObjectTypeDefinition : input Name Directives? { InputValueDefinition+ }
 */
function parseInputObjectTypeDefinition(
  parser: Parser
): InputObjectTypeDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'input');
  const name = parseName(parser);
  const directives = parseDirectives(parser);
  const fields = any(
    parser,
    TokenKind.BRACE_L,
    parseInputValueDef,
    TokenKind.BRACE_R
  );
  return {
    kind: INPUT_OBJECT_TYPE_DEFINITION,
    name,
    directives,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * TypeExtensionDefinition : extend ObjectTypeDefinition
 */
function parseTypeExtensionDefinition(parser: Parser): TypeExtensionDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'extend');
  const definition = parseObjectTypeDefinition(parser);
  return {
    kind: TYPE_EXTENSION_DEFINITION,
    definition,
    loc: loc(parser, start),
  };
}

/**
 * DirectiveDefinition :
 *   - directive @ Name ArgumentsDefinition? on DirectiveLocations
 */
function parseDirectiveDefinition(parser: Parser): DirectiveDefinition {
  const start = parser.token.start;
  expectKeyword(parser, 'directive');
  expect(parser, TokenKind.AT);
  const name = parseName(parser);
  const args = parseArgumentDefs(parser);
  expectKeyword(parser, 'on');
  const locations = parseDirectiveLocations(parser);
  return {
    kind: DIRECTIVE_DEFINITION,
    name,
    arguments: args,
    locations,
    loc: loc(parser, start)
  };
}

/**
 * DirectiveLocations :
 *   - Name
 *   - DirectiveLocations | Name
 */
function parseDirectiveLocations(parser: Parser): Array<Name> {
  const locations = [];
  do {
    locations.push(parseName(parser));
  } while (skip(parser, TokenKind.PIPE));
  return locations;
}

// Core parsing utility functions

type Parser = {
  source: Source,
  options: ParseOptions,
  prevEnd: number,
  token: Token,
  _lexToken: () => Token,
};

/**
 * Returns the parser object that is used to store state throughout the
 * process of parsing.
 */
function makeParser(source: Source, options: ParseOptions): Parser {
  const _lexToken = lex(source);
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
function loc(parser: Parser, start: number) {
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
function advance(parser: Parser): void {
  const prevEnd = parser.token.end;
  parser.prevEnd = prevEnd;
  parser.token = parser._lexToken(prevEnd);
}

/**
 * Determines if the next token is of a given kind
 */
function peek(parser: Parser, kind: number): boolean {
  return parser.token.kind === kind;
}

/**
 * If the next token is of the given kind, return true after advancing
 * the parser. Otherwise, do not change the parser state and return false.
 */
function skip(parser: Parser, kind: number): boolean {
  const match = parser.token.kind === kind;
  if (match) {
    advance(parser);
  }
  return match;
}

/**
 * If the next token is of the given kind, return that token after advancing
 * the parser. Otherwise, do not change the parser state and throw an error.
 */
function expect(parser: Parser, kind: number): Token {
  const token = parser.token;
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
function expectKeyword(parser: Parser, value: string): Token {
  const token = parser.token;
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
function unexpected(parser: Parser, atToken?: ?Token): Error {
  const token = atToken || parser.token;
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
  parser: Parser,
  openKind: number,
  parseFn: (parser: Parser) => T,
  closeKind: number
): Array<T> {
  expect(parser, openKind);
  const nodes = [];
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
  parser: Parser,
  openKind: number,
  parseFn: (parser: Parser) => T,
  closeKind: number
): Array<T> {
  expect(parser, openKind);
  const nodes = [ parseFn(parser) ];
  while (!skip(parser, closeKind)) {
    nodes.push(parseFn(parser));
  }
  return nodes;
}
