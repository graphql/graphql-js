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
import type { GraphQLError } from '../error';
import {
  createLexer,
  TokenKind,
  getTokenDesc
} from './lexer';
import type { Lexer } from './lexer';
import type {
  Location,
  Token,

  NameNode,
  VariableNode,

  DocumentNode,
  DefinitionNode,
  OperationDefinitionNode,
  OperationTypeNode,
  VariableDefinitionNode,
  SelectionSetNode,
  SelectionNode,
  FieldNode,
  ArgumentNode,

  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,

  ValueNode,
  ListValueNode,
  ObjectValueNode,
  ObjectFieldNode,

  DirectiveNode,

  TypeNode,
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,

  TypeSystemDefinitionNode,

  SchemaDefinitionNode,
  OperationTypeDefinitionNode,

  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,

  TypeExtensionDefinitionNode,

  DirectiveDefinitionNode,
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
  NULL,
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
  noLocation?: boolean
};

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */
export function parse(
  source: string | Source,
  options?: ParseOptions
): DocumentNode {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  const lexer = createLexer(sourceObj, options || {});
  return parseDocument(lexer);
}

/**
 * Given a string containing a GraphQL value (ex. `[42]`), parse the AST for
 * that value.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 *
 * Consider providing the results to the utility function: valueFromAST().
 */
export function parseValue(
  source: string | Source,
  options?: ParseOptions
): ValueNode {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  const lexer = createLexer(sourceObj, options || {});
  expect(lexer, TokenKind.SOF);
  const value = parseValueLiteral(lexer, false);
  expect(lexer, TokenKind.EOF);
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
export function parseType(
  source: string | Source,
  options?: ParseOptions
): TypeNode {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  const lexer = createLexer(sourceObj, options || {});
  expect(lexer, TokenKind.SOF);
  const type = parseTypeReference(lexer);
  expect(lexer, TokenKind.EOF);
  return type;
}

/**
 * Converts a name lex token into a name parse node.
 */
function parseName(lexer: Lexer<*>): NameNode {
  const token = expect(lexer, TokenKind.NAME);
  return {
    kind: NAME,
    value: ((token.value: any): string),
    loc: loc(lexer, token)
  };
}

// Implements the parsing rules in the Document section.

/**
 * Document : Definition+
 */
function parseDocument(lexer: Lexer<*>): DocumentNode {
  const start = lexer.token;
  expect(lexer, TokenKind.SOF);
  const definitions = [];
  do {
    definitions.push(parseDefinition(lexer));
  } while (!skip(lexer, TokenKind.EOF));

  return {
    kind: DOCUMENT,
    definitions,
    loc: loc(lexer, start)
  };
}

/**
 * Definition :
 *   - OperationDefinition
 *   - FragmentDefinition
 *   - TypeSystemDefinition
 */
function parseDefinition(lexer: Lexer<*>): DefinitionNode {
  if (peek(lexer, TokenKind.BRACE_L)) {
    return parseOperationDefinition(lexer);
  }

  if (peek(lexer, TokenKind.NAME)) {
    switch (lexer.token.value) {
      // Note: subscription is an experimental non-spec addition.
      case 'query':
      case 'mutation':
      case 'subscription':
        return parseOperationDefinition(lexer);

      case 'fragment': return parseFragmentDefinition(lexer);

      // Note: the Type System IDL is an experimental non-spec addition.
      case 'schema':
      case 'scalar':
      case 'type':
      case 'interface':
      case 'union':
      case 'enum':
      case 'input':
      case 'extend':
      case 'directive': return parseTypeSystemDefinition(lexer);
    }
  }

  throw unexpected(lexer);
}


// Implements the parsing rules in the Operations section.

/**
 * OperationDefinition :
 *  - SelectionSet
 *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
 */
function parseOperationDefinition(lexer: Lexer<*>): OperationDefinitionNode {
  const start = lexer.token;
  if (peek(lexer, TokenKind.BRACE_L)) {
    return {
      kind: OPERATION_DEFINITION,
      operation: 'query',
      name: null,
      variableDefinitions: null,
      directives: [],
      selectionSet: parseSelectionSet(lexer),
      loc: loc(lexer, start)
    };
  }
  const operation = parseOperationType(lexer);
  let name;
  if (peek(lexer, TokenKind.NAME)) {
    name = parseName(lexer);
  }
  return {
    kind: OPERATION_DEFINITION,
    operation,
    name,
    variableDefinitions: parseVariableDefinitions(lexer),
    directives: parseDirectives(lexer),
    selectionSet: parseSelectionSet(lexer),
    loc: loc(lexer, start)
  };
}

/**
 * OperationType : one of query mutation subscription
 */
function parseOperationType(lexer: Lexer<*>): OperationTypeNode {
  const operationToken = expect(lexer, TokenKind.NAME);
  switch (operationToken.value) {
    case 'query': return 'query';
    case 'mutation': return 'mutation';
    // Note: subscription is an experimental non-spec addition.
    case 'subscription': return 'subscription';
  }

  throw unexpected(lexer, operationToken);
}

/**
 * VariableDefinitions : ( VariableDefinition+ )
 */
function parseVariableDefinitions(
  lexer: Lexer<*>
): Array<VariableDefinitionNode> {
  return peek(lexer, TokenKind.PAREN_L) ?
    many(
      lexer,
      TokenKind.PAREN_L,
      parseVariableDefinition,
      TokenKind.PAREN_R
    ) :
    [];
}

/**
 * VariableDefinition : Variable : Type DefaultValue?
 */
function parseVariableDefinition(lexer: Lexer<*>): VariableDefinitionNode {
  const start = lexer.token;
  return {
    kind: VARIABLE_DEFINITION,
    variable: parseVariable(lexer),
    type: (expect(lexer, TokenKind.COLON), parseTypeReference(lexer)),
    defaultValue:
      skip(lexer, TokenKind.EQUALS) ? parseValueLiteral(lexer, true) : null,
    loc: loc(lexer, start)
  };
}

/**
 * Variable : $ Name
 */
function parseVariable(lexer: Lexer<*>): VariableNode {
  const start = lexer.token;
  expect(lexer, TokenKind.DOLLAR);
  return {
    kind: VARIABLE,
    name: parseName(lexer),
    loc: loc(lexer, start)
  };
}

/**
 * SelectionSet : { Selection+ }
 */
function parseSelectionSet(lexer: Lexer<*>): SelectionSetNode {
  const start = lexer.token;
  return {
    kind: SELECTION_SET,
    selections:
      many(lexer, TokenKind.BRACE_L, parseSelection, TokenKind.BRACE_R),
    loc: loc(lexer, start)
  };
}

/**
 * Selection :
 *   - Field
 *   - FragmentSpread
 *   - InlineFragment
 */
function parseSelection(lexer: Lexer<*>): SelectionNode {
  return peek(lexer, TokenKind.SPREAD) ?
    parseFragment(lexer) :
    parseField(lexer);
}

/**
 * Field : Alias? Name Arguments? Directives? SelectionSet?
 *
 * Alias : Name :
 */
function parseField(lexer: Lexer<*>): FieldNode {
  const start = lexer.token;

  const nameOrAlias = parseName(lexer);
  let alias;
  let name;
  if (skip(lexer, TokenKind.COLON)) {
    alias = nameOrAlias;
    name = parseName(lexer);
  } else {
    alias = null;
    name = nameOrAlias;
  }

  return {
    kind: FIELD,
    alias,
    name,
    arguments: parseArguments(lexer),
    directives: parseDirectives(lexer),
    selectionSet:
      peek(lexer, TokenKind.BRACE_L) ? parseSelectionSet(lexer) : null,
    loc: loc(lexer, start)
  };
}

/**
 * Arguments : ( Argument+ )
 */
function parseArguments(lexer: Lexer<*>): Array<ArgumentNode> {
  return peek(lexer, TokenKind.PAREN_L) ?
    many(lexer, TokenKind.PAREN_L, parseArgument, TokenKind.PAREN_R) :
    [];
}

/**
 * Argument : Name : Value
 */
function parseArgument(lexer: Lexer<*>): ArgumentNode {
  const start = lexer.token;
  return {
    kind: ARGUMENT,
    name: parseName(lexer),
    value: (expect(lexer, TokenKind.COLON), parseValueLiteral(lexer, false)),
    loc: loc(lexer, start)
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
function parseFragment(
  lexer: Lexer<*>
): FragmentSpreadNode | InlineFragmentNode {
  const start = lexer.token;
  expect(lexer, TokenKind.SPREAD);
  if (peek(lexer, TokenKind.NAME) && lexer.token.value !== 'on') {
    return {
      kind: FRAGMENT_SPREAD,
      name: parseFragmentName(lexer),
      directives: parseDirectives(lexer),
      loc: loc(lexer, start)
    };
  }
  let typeCondition = null;
  if (lexer.token.value === 'on') {
    lexer.advance();
    typeCondition = parseNamedType(lexer);
  }
  return {
    kind: INLINE_FRAGMENT,
    typeCondition,
    directives: parseDirectives(lexer),
    selectionSet: parseSelectionSet(lexer),
    loc: loc(lexer, start)
  };
}

/**
 * FragmentDefinition :
 *   - fragment FragmentName on TypeCondition Directives? SelectionSet
 *
 * TypeCondition : NamedType
 */
function parseFragmentDefinition(lexer: Lexer<*>): FragmentDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'fragment');
  return {
    kind: FRAGMENT_DEFINITION,
    name: parseFragmentName(lexer),
    typeCondition: (expectKeyword(lexer, 'on'), parseNamedType(lexer)),
    directives: parseDirectives(lexer),
    selectionSet: parseSelectionSet(lexer),
    loc: loc(lexer, start)
  };
}

/**
 * FragmentName : Name but not `on`
 */
function parseFragmentName(lexer: Lexer<*>): NameNode {
  if (lexer.token.value === 'on') {
    throw unexpected(lexer);
  }
  return parseName(lexer);
}


// Implements the parsing rules in the Values section.

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
function parseValueLiteral(lexer: Lexer<*>, isConst: boolean): ValueNode {
  const token = lexer.token;
  switch (token.kind) {
    case TokenKind.BRACKET_L:
      return parseList(lexer, isConst);
    case TokenKind.BRACE_L:
      return parseObject(lexer, isConst);
    case TokenKind.INT:
      lexer.advance();
      return {
        kind: (INT: 'IntValue'),
        value: ((token.value: any): string),
        loc: loc(lexer, token)
      };
    case TokenKind.FLOAT:
      lexer.advance();
      return {
        kind: (FLOAT: 'FloatValue'),
        value: ((token.value: any): string),
        loc: loc(lexer, token)
      };
    case TokenKind.STRING:
      lexer.advance();
      return {
        kind: (STRING: 'StringValue'),
        value: ((token.value: any): string),
        loc: loc(lexer, token)
      };
    case TokenKind.NAME:
      if (token.value === 'true' || token.value === 'false') {
        lexer.advance();
        return {
          kind: (BOOLEAN: 'BooleanValue'),
          value: token.value === 'true',
          loc: loc(lexer, token)
        };
      } else if (token.value === 'null') {
        lexer.advance();
        return {
          kind: (NULL: 'NullValue'),
          loc: loc(lexer, token)
        };
      }
      lexer.advance();
      return {
        kind: (ENUM: 'EnumValue'),
        value: ((token.value: any): string),
        loc: loc(lexer, token)
      };
    case TokenKind.DOLLAR:
      if (!isConst) {
        return parseVariable(lexer);
      }
      break;
  }
  throw unexpected(lexer);
}

export function parseConstValue(lexer: Lexer<*>): ValueNode {
  return parseValueLiteral(lexer, true);
}

function parseValueValue(lexer: Lexer<*>): ValueNode {
  return parseValueLiteral(lexer, false);
}

/**
 * ListValue[Const] :
 *   - [ ]
 *   - [ Value[?Const]+ ]
 */
function parseList(lexer: Lexer<*>, isConst: boolean): ListValueNode {
  const start = lexer.token;
  const item = isConst ? parseConstValue : parseValueValue;
  return {
    kind: LIST,
    values: any(lexer, TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
    loc: loc(lexer, start)
  };
}

/**
 * ObjectValue[Const] :
 *   - { }
 *   - { ObjectField[?Const]+ }
 */
function parseObject(lexer: Lexer<*>, isConst: boolean): ObjectValueNode {
  const start = lexer.token;
  expect(lexer, TokenKind.BRACE_L);
  const fields = [];
  while (!skip(lexer, TokenKind.BRACE_R)) {
    fields.push(parseObjectField(lexer, isConst));
  }
  return {
    kind: OBJECT,
    fields,
    loc: loc(lexer, start)
  };
}

/**
 * ObjectField[Const] : Name : Value[?Const]
 */
function parseObjectField(lexer: Lexer<*>, isConst: boolean): ObjectFieldNode {
  const start = lexer.token;
  return {
    kind: OBJECT_FIELD,
    name: parseName(lexer),
    value:
      (expect(lexer, TokenKind.COLON), parseValueLiteral(lexer, isConst)),
    loc: loc(lexer, start)
  };
}


// Implements the parsing rules in the Directives section.

/**
 * Directives : Directive+
 */
function parseDirectives(lexer: Lexer<*>): Array<DirectiveNode> {
  const directives = [];
  while (peek(lexer, TokenKind.AT)) {
    directives.push(parseDirective(lexer));
  }
  return directives;
}

/**
 * Directive : @ Name Arguments?
 */
function parseDirective(lexer: Lexer<*>): DirectiveNode {
  const start = lexer.token;
  expect(lexer, TokenKind.AT);
  return {
    kind: DIRECTIVE,
    name: parseName(lexer),
    arguments: parseArguments(lexer),
    loc: loc(lexer, start)
  };
}


// Implements the parsing rules in the Types section.

/**
 * Type :
 *   - NamedType
 *   - ListType
 *   - NonNullType
 */
export function parseTypeReference(lexer: Lexer<*>): TypeNode {
  const start = lexer.token;
  let type;
  if (skip(lexer, TokenKind.BRACKET_L)) {
    type = parseTypeReference(lexer);
    expect(lexer, TokenKind.BRACKET_R);
    type = ({
      kind: LIST_TYPE,
      type,
      loc: loc(lexer, start)
    }: ListTypeNode);
  } else {
    type = parseNamedType(lexer);
  }
  if (skip(lexer, TokenKind.BANG)) {
    return ({
      kind: NON_NULL_TYPE,
      type,
      loc: loc(lexer, start)
    }: NonNullTypeNode);
  }
  return type;
}

/**
 * NamedType : Name
 */
export function parseNamedType(lexer: Lexer<*>): NamedTypeNode {
  const start = lexer.token;
  return {
    kind: NAMED_TYPE,
    name: parseName(lexer),
    loc: loc(lexer, start)
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
function parseTypeSystemDefinition(lexer: Lexer<*>): TypeSystemDefinitionNode {
  if (peek(lexer, TokenKind.NAME)) {
    switch (lexer.token.value) {
      case 'schema': return parseSchemaDefinition(lexer);
      case 'scalar': return parseScalarTypeDefinition(lexer);
      case 'type': return parseObjectTypeDefinition(lexer);
      case 'interface': return parseInterfaceTypeDefinition(lexer);
      case 'union': return parseUnionTypeDefinition(lexer);
      case 'enum': return parseEnumTypeDefinition(lexer);
      case 'input': return parseInputObjectTypeDefinition(lexer);
      case 'extend': return parseTypeExtensionDefinition(lexer);
      case 'directive': return parseDirectiveDefinition(lexer);
    }
  }

  throw unexpected(lexer);
}

/**
 * SchemaDefinition : schema Directives? { OperationTypeDefinition+ }
 *
 * OperationTypeDefinition : OperationType : NamedType
 */
function parseSchemaDefinition(lexer: Lexer<*>): SchemaDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'schema');
  const directives = parseDirectives(lexer);
  const operationTypes = many(
    lexer,
    TokenKind.BRACE_L,
    parseOperationTypeDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: SCHEMA_DEFINITION,
    directives,
    operationTypes,
    loc: loc(lexer, start),
  };
}

function parseOperationTypeDefinition(
  lexer: Lexer<*>
): OperationTypeDefinitionNode {
  const start = lexer.token;
  const operation = parseOperationType(lexer);
  expect(lexer, TokenKind.COLON);
  const type = parseNamedType(lexer);
  return {
    kind: OPERATION_TYPE_DEFINITION,
    operation,
    type,
    loc: loc(lexer, start),
  };
}

/**
 * ScalarTypeDefinition : scalar Name Directives?
 */
function parseScalarTypeDefinition(lexer: Lexer<*>): ScalarTypeDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'scalar');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer);
  return {
    kind: SCALAR_TYPE_DEFINITION,
    name,
    directives,
    loc: loc(lexer, start),
  };
}

/**
 * ObjectTypeDefinition :
 *   - type Name ImplementsInterfaces? Directives? { FieldDefinition+ }
 */
function parseObjectTypeDefinition(lexer: Lexer<*>): ObjectTypeDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'type');
  const name = parseName(lexer);
  const interfaces = parseImplementsInterfaces(lexer);
  const directives = parseDirectives(lexer);
  const fields = any(
    lexer,
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
    loc: loc(lexer, start),
  };
}

/**
 * ImplementsInterfaces : implements NamedType+
 */
function parseImplementsInterfaces(lexer: Lexer<*>): Array<NamedTypeNode> {
  const types = [];
  if (lexer.token.value === 'implements') {
    lexer.advance();
    do {
      types.push(parseNamedType(lexer));
    } while (peek(lexer, TokenKind.NAME));
  }
  return types;
}

/**
 * FieldDefinition : Name ArgumentsDefinition? : Type Directives?
 */
function parseFieldDefinition(lexer: Lexer<*>): FieldDefinitionNode {
  const start = lexer.token;
  const name = parseName(lexer);
  const args = parseArgumentDefs(lexer);
  expect(lexer, TokenKind.COLON);
  const type = parseTypeReference(lexer);
  const directives = parseDirectives(lexer);
  return {
    kind: FIELD_DEFINITION,
    name,
    arguments: args,
    type,
    directives,
    loc: loc(lexer, start),
  };
}

/**
 * ArgumentsDefinition : ( InputValueDefinition+ )
 */
function parseArgumentDefs(lexer: Lexer<*>): Array<InputValueDefinitionNode> {
  if (!peek(lexer, TokenKind.PAREN_L)) {
    return [];
  }
  return many(lexer, TokenKind.PAREN_L, parseInputValueDef, TokenKind.PAREN_R);
}

/**
 * InputValueDefinition : Name : Type DefaultValue? Directives?
 */
function parseInputValueDef(lexer: Lexer<*>): InputValueDefinitionNode {
  const start = lexer.token;
  const name = parseName(lexer);
  expect(lexer, TokenKind.COLON);
  const type = parseTypeReference(lexer);
  let defaultValue = null;
  if (skip(lexer, TokenKind.EQUALS)) {
    defaultValue = parseConstValue(lexer);
  }
  const directives = parseDirectives(lexer);
  return {
    kind: INPUT_VALUE_DEFINITION,
    name,
    type,
    defaultValue,
    directives,
    loc: loc(lexer, start),
  };
}

/**
 * InterfaceTypeDefinition : interface Name Directives? { FieldDefinition+ }
 */
function parseInterfaceTypeDefinition(
  lexer: Lexer<*>
): InterfaceTypeDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'interface');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer);
  const fields = any(
    lexer,
    TokenKind.BRACE_L,
    parseFieldDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: INTERFACE_TYPE_DEFINITION,
    name,
    directives,
    fields,
    loc: loc(lexer, start),
  };
}

/**
 * UnionTypeDefinition : union Name Directives? = UnionMembers
 */
function parseUnionTypeDefinition(lexer: Lexer<*>): UnionTypeDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'union');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer);
  expect(lexer, TokenKind.EQUALS);
  const types = parseUnionMembers(lexer);
  return {
    kind: UNION_TYPE_DEFINITION,
    name,
    directives,
    types,
    loc: loc(lexer, start),
  };
}

/**
 * UnionMembers :
 *   - NamedType
 *   - UnionMembers | NamedType
 */
function parseUnionMembers(lexer: Lexer<*>): Array<NamedTypeNode> {
  const members = [];
  do {
    members.push(parseNamedType(lexer));
  } while (skip(lexer, TokenKind.PIPE));
  return members;
}

/**
 * EnumTypeDefinition : enum Name Directives? { EnumValueDefinition+ }
 */
function parseEnumTypeDefinition(lexer: Lexer<*>): EnumTypeDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'enum');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer);
  const values = many(
    lexer,
    TokenKind.BRACE_L,
    parseEnumValueDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: ENUM_TYPE_DEFINITION,
    name,
    directives,
    values,
    loc: loc(lexer, start),
  };
}

/**
 * EnumValueDefinition : EnumValue Directives?
 *
 * EnumValue : Name
 */
function parseEnumValueDefinition(lexer: Lexer<*>): EnumValueDefinitionNode {
  const start = lexer.token;
  const name = parseName(lexer);
  const directives = parseDirectives(lexer);
  return {
    kind: ENUM_VALUE_DEFINITION,
    name,
    directives,
    loc: loc(lexer, start),
  };
}

/**
 * InputObjectTypeDefinition : input Name Directives? { InputValueDefinition+ }
 */
function parseInputObjectTypeDefinition(
  lexer: Lexer<*>
): InputObjectTypeDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'input');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer);
  const fields = any(
    lexer,
    TokenKind.BRACE_L,
    parseInputValueDef,
    TokenKind.BRACE_R
  );
  return {
    kind: INPUT_OBJECT_TYPE_DEFINITION,
    name,
    directives,
    fields,
    loc: loc(lexer, start),
  };
}

/**
 * TypeExtensionDefinition : extend ObjectTypeDefinition
 */
function parseTypeExtensionDefinition(
  lexer: Lexer<*>
): TypeExtensionDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  const definition = parseObjectTypeDefinition(lexer);
  return {
    kind: TYPE_EXTENSION_DEFINITION,
    definition,
    loc: loc(lexer, start),
  };
}

/**
 * DirectiveDefinition :
 *   - directive @ Name ArgumentsDefinition? on DirectiveLocations
 */
function parseDirectiveDefinition(lexer: Lexer<*>): DirectiveDefinitionNode {
  const start = lexer.token;
  expectKeyword(lexer, 'directive');
  expect(lexer, TokenKind.AT);
  const name = parseName(lexer);
  const args = parseArgumentDefs(lexer);
  expectKeyword(lexer, 'on');
  const locations = parseDirectiveLocations(lexer);
  return {
    kind: DIRECTIVE_DEFINITION,
    name,
    arguments: args,
    locations,
    loc: loc(lexer, start)
  };
}

/**
 * DirectiveLocations :
 *   - Name
 *   - DirectiveLocations | Name
 */
function parseDirectiveLocations(lexer: Lexer<*>): Array<NameNode> {
  const locations = [];
  do {
    locations.push(parseName(lexer));
  } while (skip(lexer, TokenKind.PIPE));
  return locations;
}

// Core parsing utility functions

/**
 * Returns a location object, used to identify the place in
 * the source that created a given parsed object.
 */
function loc(lexer: Lexer<*>, startToken: Token): Location | void {
  if (!lexer.options.noLocation) {
    return new Loc(startToken, lexer.lastToken, lexer.source);
  }
}

function Loc(startToken: Token, endToken: Token, source: Source) {
  this.start = startToken.start;
  this.end = endToken.end;
  this.startToken = startToken;
  this.endToken = endToken;
  this.source = source;
}

// Print a simplified form when appearing in JSON/util.inspect.
Loc.prototype.toJSON = Loc.prototype.inspect = function toJSON() {
  return { start: this.start, end: this.end };
};

/**
 * Determines if the next token is of a given kind
 */
function peek(lexer: Lexer<*>, kind: string): boolean {
  return lexer.token.kind === kind;
}

/**
 * If the next token is of the given kind, return true after advancing
 * the lexer. Otherwise, do not change the parser state and return false.
 */
function skip(lexer: Lexer<*>, kind: string): boolean {
  const match = lexer.token.kind === kind;
  if (match) {
    lexer.advance();
  }
  return match;
}

/**
 * If the next token is of the given kind, return that token after advancing
 * the lexer. Otherwise, do not change the parser state and throw an error.
 */
function expect(lexer: Lexer<*>, kind: string): Token {
  const token = lexer.token;
  if (token.kind === kind) {
    lexer.advance();
    return token;
  }
  throw syntaxError(
    lexer.source,
    token.start,
    `Expected ${kind}, found ${getTokenDesc(token)}`
  );
}

/**
 * If the next token is a keyword with the given value, return that token after
 * advancing the lexer. Otherwise, do not change the parser state and return
 * false.
 */
function expectKeyword(lexer: Lexer<*>, value: string): Token {
  const token = lexer.token;
  if (token.kind === TokenKind.NAME && token.value === value) {
    lexer.advance();
    return token;
  }
  throw syntaxError(
    lexer.source,
    token.start,
    `Expected "${value}", found ${getTokenDesc(token)}`
  );
}

/**
 * Helper function for creating an error when an unexpected lexed token
 * is encountered.
 */
function unexpected(lexer: Lexer<*>, atToken?: ?Token): GraphQLError {
  const token = atToken || lexer.token;
  return syntaxError(
    lexer.source,
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
  lexer: Lexer<*>,
  openKind: string,
  parseFn: (lexer: Lexer<*>) => T,
  closeKind: string
): Array<T> {
  expect(lexer, openKind);
  const nodes = [];
  while (!skip(lexer, closeKind)) {
    nodes.push(parseFn(lexer));
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
  lexer: Lexer<*>,
  openKind: string,
  parseFn: (lexer: Lexer<*>) => T,
  closeKind: string
): Array<T> {
  expect(lexer, openKind);
  const nodes = [ parseFn(lexer) ];
  while (!skip(lexer, closeKind)) {
    nodes.push(parseFn(lexer));
  }
  return nodes;
}
