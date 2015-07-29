/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { Source } from '../source';

import { TokenKind } from '../lexer';

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
} from '../parserCore';

import {
  parseName,
  parseConstValue,
  parseType,
  parseNamedType,
} from '../parser';

import type { NamedType } from '../ast';

import type {
  SchemaDocument,
  SchemaDefinition,
  TypeDefinition,
  FieldDefinition,
  InputValueDefinition,
  EnumDefinition,
  EnumValueDefinition,
  InterfaceDefinition,
  UnionDefinition,
  InputObjectDefinition,
  ScalarDefinition,
} from './ast';

import {
  SCHEMA_DOCUMENT,
  ENUM_DEFINITION,
  ENUM_VALUE_DEFINITION,
  TYPE_DEFINITION,
  INTERFACE_DEFINITION,
  FIELD_DEFINITION,
  INPUT_VALUE_DEFINITION,
  UNION_DEFINITION,
  SCALAR_DEFINITION,
  INPUT_OBJECT_DEFINITION,
} from './kinds';

export function parseSchemaIntoAST(
  source: Source | string,
  options?: ParseOptions
): SchemaDocument {
  var sourceObj = source instanceof Source ? source : new Source(source);
  var parser = makeParser(sourceObj, options || {});
  return parseSchemaDocument(parser);
}

/**
 * SchemaDocument : SchemaDefinition+
 */
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

/**
 * SchemaDefinition :
 *   - TypeDefinition
 *   - InterfaceDefinition
 *   - UnionDefinition
 *   - ScalarDefinition
 *   - EnumDefinition
 *   - InputObjectDefinition
 */
function parseSchemaDefinition(parser): SchemaDefinition {
  if (!peek(parser, TokenKind.NAME)) {
    throw unexpected(parser);
  }
  switch (parser.token.value) {
    case 'type':
      return parseTypeDefinition(parser);
    case 'interface':
      return parseInterfaceDefinition(parser);
    case 'union':
      return parseUnionDefinition(parser);
    case 'scalar':
      return parseScalarDefinition(parser);
    case 'enum':
      return parseEnumDefinition(parser);
    case 'input':
      return parseInputObjectDefinition(parser);
    default:
      throw unexpected(parser);
  }
}

/**
 * TypeDefinition : TypeName ImplementsInterfaces? { FieldDefinition+ }
 *
 * TypeName : Name
 */
function parseTypeDefinition(parser): TypeDefinition {
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
    kind: TYPE_DEFINITION,
    name,
    interfaces,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * ImplementsInterfaces : `implements` NamedType+
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
 * FieldDefinition : FieldName ArgumentsDefinition? : Type
 *
 * FieldName : Name
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
 * InputValueDefinition : Name : Value[Const] DefaultValue?
 *
 * DefaultValue : = Value[Const]
 */
function parseInputValueDef(parser): InputValueDefinition {
  var start = parser.token.start;
  var name = parseName(parser);
  expect(parser, TokenKind.COLON);
  var type = parseType(parser, false);
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
 * InterfaceDefinition : `interface` TypeName { Fields+ }
 */
function parseInterfaceDefinition(parser): InterfaceDefinition {
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
    kind: INTERFACE_DEFINITION,
    name,
    fields,
    loc: loc(parser, start),
  };
}

/**
 * UnionDefinition : `union` TypeName = UnionMembers
 */
function parseUnionDefinition(parser): UnionDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'union');
  var name = parseName(parser);
  expect(parser, TokenKind.EQUALS);
  var types = parseUnionMembers(parser);
  return {
    kind: UNION_DEFINITION,
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
 * ScalarDefinition : `scalar` TypeName
 */
function parseScalarDefinition(parser): ScalarDefinition {
  var start = parser.token.start;
  expectKeyword(parser, 'scalar');
  var name = parseName(parser);
  return {
    kind: SCALAR_DEFINITION,
    name,
    loc: loc(parser, start),
  };
}

/**
 * EnumDefinition : `enum` TypeName { EnumValueDefinition+ }
 */
function parseEnumDefinition(parser): EnumDefinition {
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
    kind: ENUM_DEFINITION,
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
 * InputObjectDefinition : `input` TypeName { InputValueDefinition+ }
 */
function parseInputObjectDefinition(parser): InputObjectDefinition {
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
    kind: INPUT_OBJECT_DEFINITION,
    name,
    fields,
    loc: loc(parser, start),
  };
}
