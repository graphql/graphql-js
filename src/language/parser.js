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
import { TokenKind } from './lexer';
import type {
  Name,
  Variable,

  Document,
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
  ArrayValue,
  ObjectValue,
  ObjectField,

  Directive,

  Type,
  NamedType,
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
  ARRAY,
  OBJECT,
  OBJECT_FIELD,

  DIRECTIVE,

  NAMED_TYPE,
  LIST_TYPE,
  NON_NULL_TYPE,
} from './kinds';

import {
  makeParser,
  peek,
  skip,
  loc,
  any,
  many,
  expect,
  unexpected,
  expectKeyword,
  advance,
  ParseOptions,
} from './parserCore';

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
 * Converts a name lex token into a name parse node.
 */
export function parseName(parser): Name {
  var token = expect(parser, TokenKind.NAME);
  return {
    kind: NAME,
    value: token.value,
    loc: loc(parser, token.start)
  };
}

// Implements the parsing rules in the Document section.

function parseDocument(parser): Document {
  var start = parser.token.start;
  var definitions = [];
  do {
    if (peek(parser, TokenKind.BRACE_L)) {
      definitions.push(parseOperationDefinition(parser));
    } else if (peek(parser, TokenKind.NAME)) {
      if (parser.token.value === 'query' || parser.token.value === 'mutation') {
        definitions.push(parseOperationDefinition(parser));
      } else if (parser.token.value === 'fragment') {
        definitions.push(parseFragmentDefinition(parser));
      } else {
        throw unexpected(parser);
      }
    } else {
      throw unexpected(parser);
    }
  } while (!skip(parser, TokenKind.EOF));
  return {
    kind: DOCUMENT,
    definitions,
    loc: loc(parser, start)
  };
}


// Implements the parsing rules in the Operations section.

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
  return {
    kind: OPERATION_DEFINITION,
    operation,
    name: parseName(parser),
    variableDefinitions: parseVariableDefinitions(parser),
    directives: parseDirectives(parser),
    selectionSet: parseSelectionSet(parser),
    loc: loc(parser, start)
  };
}

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

function parseVariableDefinition(parser): VariableDefinition {
  var start = parser.token.start;
  return {
    kind: VARIABLE_DEFINITION,
    variable: parseVariable(parser),
    type: (expect(parser, TokenKind.COLON), parseType(parser)),
    defaultValue:
      skip(parser, TokenKind.EQUALS) ? parseValue(parser, true) : null,
    loc: loc(parser, start)
  };
}

function parseVariable(parser): Variable {
  var start = parser.token.start;
  expect(parser, TokenKind.DOLLAR);
  return {
    kind: VARIABLE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}

function parseSelectionSet(parser): SelectionSet {
  var start = parser.token.start;
  return {
    kind: SELECTION_SET,
    selections:
      many(parser, TokenKind.BRACE_L, parseSelection, TokenKind.BRACE_R),
    loc: loc(parser, start)
  };
}

function parseSelection(parser): Selection {
  return peek(parser, TokenKind.SPREAD) ?
    parseFragment(parser) :
    parseField(parser);
}

/**
 * Corresponds to both Field and Alias in the spec
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

function parseArguments(parser): Array<Argument> {
  return peek(parser, TokenKind.PAREN_L) ?
    many(parser, TokenKind.PAREN_L, parseArgument, TokenKind.PAREN_R) :
    [];
}

function parseArgument(parser): Argument {
  var start = parser.token.start;
  return {
    kind: ARGUMENT,
    name: parseName(parser),
    value: (expect(parser, TokenKind.COLON), parseValue(parser, false)),
    loc: loc(parser, start)
  };
}


// Implements the parsing rules in the Fragments section.

/**
 * Corresponds to both FragmentSpread and InlineFragment in the spec
 */
function parseFragment(parser): FragmentSpread | InlineFragment {
  var start = parser.token.start;
  expect(parser, TokenKind.SPREAD);
  if (parser.token.value === 'on') {
    advance(parser);
    return {
      kind: INLINE_FRAGMENT,
      typeCondition: parseNamedType(parser),
      directives: parseDirectives(parser),
      selectionSet: parseSelectionSet(parser),
      loc: loc(parser, start)
    };
  }
  return {
    kind: FRAGMENT_SPREAD,
    name: parseFragmentName(parser),
    directives: parseDirectives(parser),
    loc: loc(parser, start)
  };
}

function parseFragmentName(parser): Name {
  if (parser.token.value === 'on') {
    throw unexpected(parser);
  }
  return parseName(parser);
}

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


// Implements the parsing rules in the Values section.

function parseVariableValue(parser): Value {
  return parseValue(parser, false);
}

function parseConstValue(parser): Value {
  return parseValue(parser, true);
}

function parseValue(parser, isConst: boolean): Value {
  var token = parser.token;
  switch (token.kind) {
    case TokenKind.BRACKET_L:
      return parseArray(parser, isConst);
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

function parseArray(parser, isConst: boolean): ArrayValue {
  var start = parser.token.start;
  var item = isConst ? parseConstValue : parseVariableValue;
  return {
    kind: ARRAY,
    values: any(parser, TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
    loc: loc(parser, start)
  };
}

function parseObject(parser, isConst: boolean): ObjectValue {
  var start = parser.token.start;
  expect(parser, TokenKind.BRACE_L);
  var fieldNames = {};
  var fields = [];
  while (!skip(parser, TokenKind.BRACE_R)) {
    fields.push(parseObjectField(parser, isConst, fieldNames));
  }
  return {
    kind: OBJECT,
    fields,
    loc: loc(parser, start)
  };
}

function parseObjectField(
  parser,
  isConst: boolean,
  fieldNames: {[name: string]: boolean}
): ObjectField {
  var start = parser.token.start;
  var name = parseName(parser);
  if (fieldNames.hasOwnProperty(name.value)) {
    throw syntaxError(
      parser.source,
      start,
      `Duplicate input object field ${name.value}.`
    );
  }
  fieldNames[name.value] = true;
  return {
    kind: OBJECT_FIELD,
    name,
    value: (expect(parser, TokenKind.COLON), parseValue(parser, isConst)),
    loc: loc(parser, start)
  };
}

// Implements the parsing rules in the Directives section.

function parseDirectives(parser): Array<Directive> {
  var directives = [];
  while (peek(parser, TokenKind.AT)) {
    directives.push(parseDirective(parser));
  }
  return directives;
}

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
 * Handles the Type: NamedType, ListType, and NonNullType parsing rules.
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

export function parseNamedType(parser): NamedType {
  var start = parser.token.start;
  return {
    kind: NAMED_TYPE,
    name: parseName(parser),
    loc: loc(parser, start)
  };
}
