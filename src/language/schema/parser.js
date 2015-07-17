/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { Source } from './../source';

import { TokenKind } from './../lexer';

import {
  ParseOptions,
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
} from './../parserCore';

import {
  parseName,
  parseNamedType,
  parseType,
} from './../parser';

import { NamedType } from '../ast';

import type {
  SchemaDocument,
  TypeDefinition,
  FieldDefinition,
  EnumDefinition,
  EnumValueDefinition,
  InterfaceDefinition,
  ArgumentDefinition,
  ScalarDefinition,
  InputObjectDefinition,
  InputFieldDefinition,
} from './ast';

import {
  SCHEMA_DOCUMENT,
  ENUM_DEFINITION,
  ENUM_VALUE_DEFINITION,
  TYPE_DEFINITION,
  INTERFACE_DEFINITION,
  FIELD_DEFINITION,
  ARGUMENT_DEFINITION,
  UNION_DEFINITION,
  SCALAR_DEFINITION,
  INPUT_OBJECT_DEFINITION,
  INPUT_FIELD_DEFINITION,
} from './kinds';

export function parseSchema(
  source: Source | string,
  options?: ParseOptions
): SchemaDocument {
  var sourceObj = source instanceof Source ? source : new Source(source);
  var parser = makeParser(sourceObj, options || {});
  return parseSchemaDocument(parser);
}

function parseSchemaDocument(parser): SchemaDocument {
  var start = parser.token.start;
  var definitions = [];
  do {
    definitions.push(parseSchemaDefinition(parser));
  } while (!skip(parser, TokenKind.EOF));

  return {
    kind: SCHEMA_DOCUMENT,
    definitions,
    loc: loc(parser, start)
  };
}


function parseSchemaDefinition(parser): any {
  if (!peek(parser, TokenKind.NAME)) {
    throw unexpected(parser);
  }
  switch (parser.token.value) {
    case 'type':
      return parseTypeDefinition(parser);
    case 'enum':
      return parseEnumDefinition(parser);
    case 'interface':
      return parseInterfaceDefinition(parser);
    case 'union':
      return parseUnionDefinition(parser);
    case 'input':
      return parseInputObjectDefinition(parser);
    case 'scalar':
      return parseScalarDefinition(parser);
    default:
      throw unexpected(parser);
  }
}

function parseTypeDefinition(parser): TypeDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'type');
  var name = parseName(parser);
  var interfaces = parseInterfaces(parser);
  var fields = any(
    parser,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R);
  return {
    kind: TYPE_DEFINITION,
    name,
    interfaces: interfaces,
    fields: fields,
    loc: loc(parser, start),
  };
}

function parseFieldDefinition(parser): FieldDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  var args = parseArgumentDefs(parser);
  expect(parser, TokenKind.COLON);
  var type = parseType(parser);
  var location = loc(parser, start);
  return {
    kind: FIELD_DEFINITION,
    name: name,
    type: type,
    arguments: args,
    loc: location,
  };
}

function parseArgumentDefs(parser): Array<ArgumentDefinition> {
  if (!peek(parser, TokenKind.PAREN_L)) {
    return [];
  }
  return many(
    parser,
    TokenKind.PAREN_L,
    parseArgumentDef,
    TokenKind.PAREN_R
  );
}

function parseArgumentDef(parser): ArgumentDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  expect(parser, TokenKind.COLON);
  var type = parseType(parser, false);
  var location = loc(parser, start);
  return {
    kind: ARGUMENT_DEFINITION,
    name: name,
    type: type,
    loc: location,
  };
}

function parseInterfaces(parser): Array<NamedType> {
  var types = [];
  if (parser.token.value === 'implements') {
    advance(parser);
    do {
      types.push(parseType(parser));
    } while (!peek(parser, TokenKind.BRACE_L));
  }
  return types;
}

function parseEnumDefinition(parser): EnumDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'enum');
  var name = parseName(parser);
  var values = many(
    parser,
    TokenKind.BRACE_L,
    parseEnumValueDefinition,
    TokenKind.BRACE_R);
  var location = loc(parser, start);
  return {
    kind: ENUM_DEFINITION,
    name: name,
    values: values,
    loc: location,
  };
}

function parseEnumValueDefinition(parser) : EnumValueDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  var location = loc(parser, start);
  return {
    kind: ENUM_VALUE_DEFINITION,
    name: name,
    loc: location,
  };
}

function parseInterfaceDefinition(parser): InterfaceDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'interface');
  var name = parseName(parser);
  var fields = any(
    parser,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R);
  return {
    kind: INTERFACE_DEFINITION,
    name,
    fields: fields,
    loc: loc(parser, start),
  };
}

function parseUnionDefinition(parser) {
  var start = parser.token.start;
  expectKeyword(parser, 'union');
  var name = parseName(parser);
  var types = parseUnionMembers(parser);
  var location = loc(parser, start);
  return {
    kind: UNION_DEFINITION,
    name: name,
    types: types,
    loc: location,
  };
}

function parseUnionMembers(parser) {
  expect(parser, TokenKind.BRACE_L);
  var members = [(parseNamedType(parser))];
  while (!skip(parser, TokenKind.BRACE_R)) {
    expect(parser, TokenKind.PIPE);
    members.push((parseNamedType(parser)));
  }
  return members;
}


function parseInputObjectDefinition(parser): InputObjectDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'input');
  var name = parseName(parser);
  var fields = any(
    parser,
    TokenKind.BRACE_L,
    parseInputFieldDefinition,
    TokenKind.BRACE_R);
  return {
    kind: INPUT_OBJECT_DEFINITION,
    name,
    fields: fields,
    loc: loc(parser, start),
  };
}

function parseInputFieldDefinition(parser): InputFieldDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  expect(parser, TokenKind.COLON);
  var type = parseType(parser);
  var location = loc(parser, start);
  return {
    kind: INPUT_FIELD_DEFINITION,
    name: name,
    type: type,
    loc: location,
  };
}

function parseScalarDefinition(parser): ScalarDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'scalar');
  var name = parseName(parser);
  var location = loc(parser, start);
  return {
    kind: SCALAR_DEFINITION,
    name: name,
    loc: location,
  };
}
