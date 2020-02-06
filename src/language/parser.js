// @flow strict

import inspect from '../jsutils/inspect';
import devAssert from '../jsutils/devAssert';

import { syntaxError } from '../error/syntaxError';
import { type GraphQLError } from '../error/GraphQLError';

import { Kind } from './kinds';
import { Source } from './source';
import { DirectiveLocation } from './directiveLocation';
import { type TokenKindEnum, TokenKind } from './tokenKind';
import { Lexer, isPunctuatorTokenKind } from './lexer';
import {
  Location,
  type Token,
  type NameNode,
  type VariableNode,
  type DocumentNode,
  type DefinitionNode,
  type OperationDefinitionNode,
  type OperationTypeNode,
  type VariableDefinitionNode,
  type SelectionSetNode,
  type SelectionNode,
  type FieldNode,
  type ArgumentNode,
  type FragmentSpreadNode,
  type InlineFragmentNode,
  type FragmentDefinitionNode,
  type ValueNode,
  type StringValueNode,
  type ListValueNode,
  type ObjectValueNode,
  type ObjectFieldNode,
  type DirectiveNode,
  type TypeNode,
  type NamedTypeNode,
  type TypeSystemDefinitionNode,
  type SchemaDefinitionNode,
  type OperationTypeDefinitionNode,
  type ScalarTypeDefinitionNode,
  type ObjectTypeDefinitionNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type UnionTypeDefinitionNode,
  type EnumTypeDefinitionNode,
  type EnumValueDefinitionNode,
  type InputObjectTypeDefinitionNode,
  type DirectiveDefinitionNode,
  type TypeSystemExtensionNode,
  type SchemaExtensionNode,
  type ScalarTypeExtensionNode,
  type ObjectTypeExtensionNode,
  type InterfaceTypeExtensionNode,
  type UnionTypeExtensionNode,
  type EnumTypeExtensionNode,
  type InputObjectTypeExtensionNode,
} from './ast';

/**
 * Configuration options to control parser behavior
 */
export type ParseOptions = {|
  /**
   * By default, the parser creates AST nodes that know the location
   * in the source that they correspond to. This configuration flag
   * disables that behavior for performance or testing.
   */
  noLocation?: boolean,

  /**
   * If enabled, the parser will parse empty fields sets in the Schema
   * Definition Language. Otherwise, the parser will follow the current
   * specification.
   *
   * This option is provided to ease adoption of the final SDL specification
   * and will be removed in v16.
   */
  allowLegacySDLEmptyFields?: boolean,

  /**
   * If enabled, the parser will parse implemented interfaces with no `&`
   * character between each interface. Otherwise, the parser will follow the
   * current specification.
   *
   * This option is provided to ease adoption of the final SDL specification
   * and will be removed in v16.
   */
  allowLegacySDLImplementsInterfaces?: boolean,

  /**
   * EXPERIMENTAL:
   *
   * If enabled, the parser will understand and parse variable definitions
   * contained in a fragment definition. They'll be represented in the
   * `variableDefinitions` field of the FragmentDefinitionNode.
   *
   * The syntax is identical to normal, query-defined variables. For example:
   *
   *   fragment A($var: Boolean = false) on T  {
   *     ...
   *   }
   *
   * Note: this feature is experimental and may change or be removed in the
   * future.
   */
  experimentalFragmentVariables?: boolean,
|};

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */
export function parse(
  source: string | Source,
  options?: ParseOptions,
): DocumentNode {
  const parser = new Parser(source, options);
  return parser.parseDocument();
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
  options?: ParseOptions,
): ValueNode {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const value = parser.parseValueLiteral(false);
  parser.expectToken(TokenKind.EOF);
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
  options?: ParseOptions,
): TypeNode {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const type = parser.parseTypeReference();
  parser.expectToken(TokenKind.EOF);
  return type;
}

class Parser {
  _options: ?ParseOptions;
  _lexer: Lexer;

  constructor(source: string | Source, options?: ParseOptions) {
    const sourceObj = typeof source === 'string' ? new Source(source) : source;
    devAssert(
      sourceObj instanceof Source,
      `Must provide Source. Received: ${inspect(sourceObj)}.`,
    );

    this._lexer = new Lexer(sourceObj);
    this._options = options;
  }

  /**
   * Converts a name lex token into a name parse node.
   */
  parseName(): NameNode {
    const token = this.expectToken(TokenKind.NAME);
    return {
      kind: Kind.NAME,
      value: ((token.value: any): string),
      loc: this.loc(token),
    };
  }

  // Implements the parsing rules in the Document section.

  /**
   * Document : Definition+
   */
  parseDocument(): DocumentNode {
    const start = this._lexer.token;
    return {
      kind: Kind.DOCUMENT,
      definitions: this.many(
        TokenKind.SOF,
        this.parseDefinition,
        TokenKind.EOF,
      ),
      loc: this.loc(start),
    };
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
   */
  parseDefinition(): DefinitionNode {
    if (this.peek(TokenKind.NAME)) {
      switch (this._lexer.token.value) {
        case 'query':
        case 'mutation':
        case 'subscription':
          return this.parseOperationDefinition();
        case 'fragment':
          return this.parseFragmentDefinition();
        case 'schema':
        case 'scalar':
        case 'type':
        case 'interface':
        case 'union':
        case 'enum':
        case 'input':
        case 'directive':
          return this.parseTypeSystemDefinition();
        case 'extend':
          return this.parseTypeSystemExtension();
      }
    } else if (this.peek(TokenKind.BRACE_L)) {
      return this.parseOperationDefinition();
    } else if (this.peekDescription()) {
      return this.parseTypeSystemDefinition();
    }

    throw this.unexpected();
  }

  // Implements the parsing rules in the Operations section.

  /**
   * OperationDefinition :
   *  - SelectionSet
   *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
   */
  parseOperationDefinition(): OperationDefinitionNode {
    const start = this._lexer.token;
    if (this.peek(TokenKind.BRACE_L)) {
      return {
        kind: Kind.OPERATION_DEFINITION,
        operation: 'query',
        name: undefined,
        variableDefinitions: [],
        directives: [],
        selectionSet: this.parseSelectionSet(),
        loc: this.loc(start),
      };
    }
    const operation = this.parseOperationType();
    let name;
    if (this.peek(TokenKind.NAME)) {
      name = this.parseName();
    }
    return {
      kind: Kind.OPERATION_DEFINITION,
      operation,
      name,
      variableDefinitions: this.parseVariableDefinitions(),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet(),
      loc: this.loc(start),
    };
  }

  /**
   * OperationType : one of query mutation subscription
   */
  parseOperationType(): OperationTypeNode {
    const operationToken = this.expectToken(TokenKind.NAME);
    switch (operationToken.value) {
      case 'query':
        return 'query';
      case 'mutation':
        return 'mutation';
      case 'subscription':
        return 'subscription';
    }

    throw this.unexpected(operationToken);
  }

  /**
   * VariableDefinitions : ( VariableDefinition+ )
   */
  parseVariableDefinitions(): Array<VariableDefinitionNode> {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseVariableDefinition,
      TokenKind.PAREN_R,
    );
  }

  /**
   * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
   */
  parseVariableDefinition(): VariableDefinitionNode {
    const start = this._lexer.token;
    return {
      kind: Kind.VARIABLE_DEFINITION,
      variable: this.parseVariable(),
      type: (this.expectToken(TokenKind.COLON), this.parseTypeReference()),
      defaultValue: this.expectOptionalToken(TokenKind.EQUALS)
        ? this.parseValueLiteral(true)
        : undefined,
      directives: this.parseDirectives(true),
      loc: this.loc(start),
    };
  }

  /**
   * Variable : $ Name
   */
  parseVariable(): VariableNode {
    const start = this._lexer.token;
    this.expectToken(TokenKind.DOLLAR);
    return {
      kind: Kind.VARIABLE,
      name: this.parseName(),
      loc: this.loc(start),
    };
  }

  /**
   * SelectionSet : { Selection+ }
   */
  parseSelectionSet(): SelectionSetNode {
    const start = this._lexer.token;
    return {
      kind: Kind.SELECTION_SET,
      selections: this.many(
        TokenKind.BRACE_L,
        this.parseSelection,
        TokenKind.BRACE_R,
      ),
      loc: this.loc(start),
    };
  }

  /**
   * Selection :
   *   - Field
   *   - FragmentSpread
   *   - InlineFragment
   */
  parseSelection(): SelectionNode {
    return this.peek(TokenKind.SPREAD)
      ? this.parseFragment()
      : this.parseField();
  }

  /**
   * Field : Alias? Name Arguments? Directives? SelectionSet?
   *
   * Alias : Name :
   */
  parseField(): FieldNode {
    const start = this._lexer.token;

    const nameOrAlias = this.parseName();
    let alias;
    let name;
    if (this.expectOptionalToken(TokenKind.COLON)) {
      alias = nameOrAlias;
      name = this.parseName();
    } else {
      name = nameOrAlias;
    }

    return {
      kind: Kind.FIELD,
      alias,
      name,
      arguments: this.parseArguments(false),
      directives: this.parseDirectives(false),
      selectionSet: this.peek(TokenKind.BRACE_L)
        ? this.parseSelectionSet()
        : undefined,
      loc: this.loc(start),
    };
  }

  /**
   * Arguments[Const] : ( Argument[?Const]+ )
   */
  parseArguments(isConst: boolean): Array<ArgumentNode> {
    const item = isConst ? this.parseConstArgument : this.parseArgument;
    return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
  }

  /**
   * Argument[Const] : Name : Value[?Const]
   */
  parseArgument(): ArgumentNode {
    const start = this._lexer.token;
    const name = this.parseName();

    this.expectToken(TokenKind.COLON);
    return {
      kind: Kind.ARGUMENT,
      name,
      value: this.parseValueLiteral(false),
      loc: this.loc(start),
    };
  }

  parseConstArgument(): ArgumentNode {
    const start = this._lexer.token;
    return {
      kind: Kind.ARGUMENT,
      name: this.parseName(),
      value: (this.expectToken(TokenKind.COLON), this.parseValueLiteral(true)),
      loc: this.loc(start),
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
  parseFragment(): FragmentSpreadNode | InlineFragmentNode {
    const start = this._lexer.token;
    this.expectToken(TokenKind.SPREAD);

    const hasTypeCondition = this.expectOptionalKeyword('on');
    if (!hasTypeCondition && this.peek(TokenKind.NAME)) {
      return {
        kind: Kind.FRAGMENT_SPREAD,
        name: this.parseFragmentName(),
        directives: this.parseDirectives(false),
        loc: this.loc(start),
      };
    }
    return {
      kind: Kind.INLINE_FRAGMENT,
      typeCondition: hasTypeCondition ? this.parseNamedType() : undefined,
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet(),
      loc: this.loc(start),
    };
  }

  /**
   * FragmentDefinition :
   *   - fragment FragmentName on TypeCondition Directives? SelectionSet
   *
   * TypeCondition : NamedType
   */
  parseFragmentDefinition(): FragmentDefinitionNode {
    const start = this._lexer.token;
    this.expectKeyword('fragment');
    // Experimental support for defining variables within fragments changes
    // the grammar of FragmentDefinition:
    //   - fragment FragmentName VariableDefinitions? on TypeCondition Directives? SelectionSet
    if (this._options?.experimentalFragmentVariables === true) {
      return {
        kind: Kind.FRAGMENT_DEFINITION,
        name: this.parseFragmentName(),
        variableDefinitions: this.parseVariableDefinitions(),
        typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
        directives: this.parseDirectives(false),
        selectionSet: this.parseSelectionSet(),
        loc: this.loc(start),
      };
    }
    return {
      kind: Kind.FRAGMENT_DEFINITION,
      name: this.parseFragmentName(),
      typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet(),
      loc: this.loc(start),
    };
  }

  /**
   * FragmentName : Name but not `on`
   */
  parseFragmentName(): NameNode {
    if (this._lexer.token.value === 'on') {
      throw this.unexpected();
    }
    return this.parseName();
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
  parseValueLiteral(isConst: boolean): ValueNode {
    const token = this._lexer.token;
    switch (token.kind) {
      case TokenKind.BRACKET_L:
        return this.parseList(isConst);
      case TokenKind.BRACE_L:
        return this.parseObject(isConst);
      case TokenKind.INT:
        this._lexer.advance();
        return {
          kind: Kind.INT,
          value: ((token.value: any): string),
          loc: this.loc(token),
        };
      case TokenKind.FLOAT:
        this._lexer.advance();
        return {
          kind: Kind.FLOAT,
          value: ((token.value: any): string),
          loc: this.loc(token),
        };
      case TokenKind.STRING:
      case TokenKind.BLOCK_STRING:
        return this.parseStringLiteral();
      case TokenKind.NAME:
        this._lexer.advance();
        switch (token.value) {
          case 'true':
            return { kind: Kind.BOOLEAN, value: true, loc: this.loc(token) };
          case 'false':
            return { kind: Kind.BOOLEAN, value: false, loc: this.loc(token) };
          case 'null':
            return { kind: Kind.NULL, loc: this.loc(token) };
          default:
            return {
              kind: Kind.ENUM,
              value: ((token.value: any): string),
              loc: this.loc(token),
            };
        }
      case TokenKind.DOLLAR:
        if (!isConst) {
          return this.parseVariable();
        }
        break;
    }
    throw this.unexpected();
  }

  parseStringLiteral(): StringValueNode {
    const token = this._lexer.token;
    this._lexer.advance();
    return {
      kind: Kind.STRING,
      value: ((token.value: any): string),
      block: token.kind === TokenKind.BLOCK_STRING,
      loc: this.loc(token),
    };
  }

  /**
   * ListValue[Const] :
   *   - [ ]
   *   - [ Value[?Const]+ ]
   */
  parseList(isConst: boolean): ListValueNode {
    const start = this._lexer.token;
    const item = () => this.parseValueLiteral(isConst);
    return {
      kind: Kind.LIST,
      values: this.any(TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
      loc: this.loc(start),
    };
  }

  /**
   * ObjectValue[Const] :
   *   - { }
   *   - { ObjectField[?Const]+ }
   */
  parseObject(isConst: boolean): ObjectValueNode {
    const start = this._lexer.token;
    const item = () => this.parseObjectField(isConst);
    return {
      kind: Kind.OBJECT,
      fields: this.any(TokenKind.BRACE_L, item, TokenKind.BRACE_R),
      loc: this.loc(start),
    };
  }

  /**
   * ObjectField[Const] : Name : Value[?Const]
   */
  parseObjectField(isConst: boolean): ObjectFieldNode {
    const start = this._lexer.token;
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);

    return {
      kind: Kind.OBJECT_FIELD,
      name,
      value: this.parseValueLiteral(isConst),
      loc: this.loc(start),
    };
  }

  // Implements the parsing rules in the Directives section.

  /**
   * Directives[Const] : Directive[?Const]+
   */
  parseDirectives(isConst: boolean): Array<DirectiveNode> {
    const directives = [];
    while (this.peek(TokenKind.AT)) {
      directives.push(this.parseDirective(isConst));
    }
    return directives;
  }

  /**
   * Directive[Const] : @ Name Arguments[?Const]?
   */
  parseDirective(isConst: boolean): DirectiveNode {
    const start = this._lexer.token;
    this.expectToken(TokenKind.AT);
    return {
      kind: Kind.DIRECTIVE,
      name: this.parseName(),
      arguments: this.parseArguments(isConst),
      loc: this.loc(start),
    };
  }

  // Implements the parsing rules in the Types section.

  /**
   * Type :
   *   - NamedType
   *   - ListType
   *   - NonNullType
   */
  parseTypeReference(): TypeNode {
    const start = this._lexer.token;
    let type;
    if (this.expectOptionalToken(TokenKind.BRACKET_L)) {
      type = this.parseTypeReference();
      this.expectToken(TokenKind.BRACKET_R);
      type = {
        kind: Kind.LIST_TYPE,
        type,
        loc: this.loc(start),
      };
    } else {
      type = this.parseNamedType();
    }

    if (this.expectOptionalToken(TokenKind.BANG)) {
      return {
        kind: Kind.NON_NULL_TYPE,
        type,
        loc: this.loc(start),
      };
    }
    return type;
  }

  /**
   * NamedType : Name
   */
  parseNamedType(): NamedTypeNode {
    const start = this._lexer.token;
    return {
      kind: Kind.NAMED_TYPE,
      name: this.parseName(),
      loc: this.loc(start),
    };
  }

  // Implements the parsing rules in the Type Definition section.

  /**
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
  parseTypeSystemDefinition(): TypeSystemDefinitionNode {
    // Many definitions begin with a description and require a lookahead.
    const keywordToken = this.peekDescription()
      ? this._lexer.lookahead()
      : this._lexer.token;

    if (keywordToken.kind === TokenKind.NAME) {
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
    }

    throw this.unexpected(keywordToken);
  }

  peekDescription(): boolean {
    return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
  }

  /**
   * Description : StringValue
   */
  parseDescription(): void | StringValueNode {
    if (this.peekDescription()) {
      return this.parseStringLiteral();
    }
  }

  /**
   * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
   */
  parseSchemaDefinition(): SchemaDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('schema');
    const directives = this.parseDirectives(true);
    const operationTypes = this.many(
      TokenKind.BRACE_L,
      this.parseOperationTypeDefinition,
      TokenKind.BRACE_R,
    );
    return {
      kind: Kind.SCHEMA_DEFINITION,
      description,
      directives,
      operationTypes,
      loc: this.loc(start),
    };
  }

  /**
   * OperationTypeDefinition : OperationType : NamedType
   */
  parseOperationTypeDefinition(): OperationTypeDefinitionNode {
    const start = this._lexer.token;
    const operation = this.parseOperationType();
    this.expectToken(TokenKind.COLON);
    const type = this.parseNamedType();
    return {
      kind: Kind.OPERATION_TYPE_DEFINITION,
      operation,
      type,
      loc: this.loc(start),
    };
  }

  /**
   * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
   */
  parseScalarTypeDefinition(): ScalarTypeDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('scalar');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    return {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      description,
      name,
      directives,
      loc: this.loc(start),
    };
  }

  /**
   * ObjectTypeDefinition :
   *   Description?
   *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
   */
  parseObjectTypeDefinition(): ObjectTypeDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('type');
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseDirectives(true);
    const fields = this.parseFieldsDefinition();
    return {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      description,
      name,
      interfaces,
      directives,
      fields,
      loc: this.loc(start),
    };
  }

  /**
   * ImplementsInterfaces :
   *   - implements `&`? NamedType
   *   - ImplementsInterfaces & NamedType
   */
  parseImplementsInterfaces(): Array<NamedTypeNode> {
    const types = [];
    if (this.expectOptionalKeyword('implements')) {
      // Optional leading ampersand
      this.expectOptionalToken(TokenKind.AMP);
      do {
        types.push(this.parseNamedType());
      } while (
        this.expectOptionalToken(TokenKind.AMP) ||
        // Legacy support for the SDL?
        (this._options?.allowLegacySDLImplementsInterfaces === true &&
          this.peek(TokenKind.NAME))
      );
    }
    return types;
  }

  /**
   * FieldsDefinition : { FieldDefinition+ }
   */
  parseFieldsDefinition(): Array<FieldDefinitionNode> {
    // Legacy support for the SDL?
    if (
      this._options?.allowLegacySDLEmptyFields === true &&
      this.peek(TokenKind.BRACE_L) &&
      this._lexer.lookahead().kind === TokenKind.BRACE_R
    ) {
      this._lexer.advance();
      this._lexer.advance();
      return [];
    }
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseFieldDefinition,
      TokenKind.BRACE_R,
    );
  }

  /**
   * FieldDefinition :
   *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
   */
  parseFieldDefinition(): FieldDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    const directives = this.parseDirectives(true);
    return {
      kind: Kind.FIELD_DEFINITION,
      description,
      name,
      arguments: args,
      type,
      directives,
      loc: this.loc(start),
    };
  }

  /**
   * ArgumentsDefinition : ( InputValueDefinition+ )
   */
  parseArgumentDefs(): Array<InputValueDefinitionNode> {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseInputValueDef,
      TokenKind.PAREN_R,
    );
  }

  /**
   * InputValueDefinition :
   *   - Description? Name : Type DefaultValue? Directives[Const]?
   */
  parseInputValueDef(): InputValueDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    let defaultValue;
    if (this.expectOptionalToken(TokenKind.EQUALS)) {
      defaultValue = this.parseValueLiteral(true);
    }
    const directives = this.parseDirectives(true);
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description,
      name,
      type,
      defaultValue,
      directives,
      loc: this.loc(start),
    };
  }

  /**
   * InterfaceTypeDefinition :
   *   - Description? interface Name Directives[Const]? FieldsDefinition?
   */
  parseInterfaceTypeDefinition(): InterfaceTypeDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('interface');
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseDirectives(true);
    const fields = this.parseFieldsDefinition();
    return {
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      description,
      name,
      interfaces,
      directives,
      fields,
      loc: this.loc(start),
    };
  }

  /**
   * UnionTypeDefinition :
   *   - Description? union Name Directives[Const]? UnionMemberTypes?
   */
  parseUnionTypeDefinition(): UnionTypeDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('union');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    const types = this.parseUnionMemberTypes();
    return {
      kind: Kind.UNION_TYPE_DEFINITION,
      description,
      name,
      directives,
      types,
      loc: this.loc(start),
    };
  }

  /**
   * UnionMemberTypes :
   *   - = `|`? NamedType
   *   - UnionMemberTypes | NamedType
   */
  parseUnionMemberTypes(): Array<NamedTypeNode> {
    const types = [];
    if (this.expectOptionalToken(TokenKind.EQUALS)) {
      // Optional leading pipe
      this.expectOptionalToken(TokenKind.PIPE);
      do {
        types.push(this.parseNamedType());
      } while (this.expectOptionalToken(TokenKind.PIPE));
    }
    return types;
  }

  /**
   * EnumTypeDefinition :
   *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
   */
  parseEnumTypeDefinition(): EnumTypeDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('enum');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    const values = this.parseEnumValuesDefinition();
    return {
      kind: Kind.ENUM_TYPE_DEFINITION,
      description,
      name,
      directives,
      values,
      loc: this.loc(start),
    };
  }

  /**
   * EnumValuesDefinition : { EnumValueDefinition+ }
   */
  parseEnumValuesDefinition(): Array<EnumValueDefinitionNode> {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseEnumValueDefinition,
      TokenKind.BRACE_R,
    );
  }

  /**
   * EnumValueDefinition : Description? EnumValue Directives[Const]?
   *
   * EnumValue : Name
   */
  parseEnumValueDefinition(): EnumValueDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    return {
      kind: Kind.ENUM_VALUE_DEFINITION,
      description,
      name,
      directives,
      loc: this.loc(start),
    };
  }

  /**
   * InputObjectTypeDefinition :
   *   - Description? input Name Directives[Const]? InputFieldsDefinition?
   */
  parseInputObjectTypeDefinition(): InputObjectTypeDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('input');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    const fields = this.parseInputFieldsDefinition();
    return {
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      description,
      name,
      directives,
      fields,
      loc: this.loc(start),
    };
  }

  /**
   * InputFieldsDefinition : { InputValueDefinition+ }
   */
  parseInputFieldsDefinition(): Array<InputValueDefinitionNode> {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseInputValueDef,
      TokenKind.BRACE_R,
    );
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
  parseTypeSystemExtension(): TypeSystemExtensionNode {
    const keywordToken = this._lexer.lookahead();

    if (keywordToken.kind === TokenKind.NAME) {
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
   * SchemaExtension :
   *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
   *  - extend schema Directives[Const]
   */
  parseSchemaExtension(): SchemaExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('schema');
    const directives = this.parseDirectives(true);
    const operationTypes = this.optionalMany(
      TokenKind.BRACE_L,
      this.parseOperationTypeDefinition,
      TokenKind.BRACE_R,
    );
    if (directives.length === 0 && operationTypes.length === 0) {
      throw this.unexpected();
    }
    return {
      kind: Kind.SCHEMA_EXTENSION,
      directives,
      operationTypes,
      loc: this.loc(start),
    };
  }

  /**
   * ScalarTypeExtension :
   *   - extend scalar Name Directives[Const]
   */
  parseScalarTypeExtension(): ScalarTypeExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('scalar');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    if (directives.length === 0) {
      throw this.unexpected();
    }
    return {
      kind: Kind.SCALAR_TYPE_EXTENSION,
      name,
      directives,
      loc: this.loc(start),
    };
  }

  /**
   * ObjectTypeExtension :
   *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend type Name ImplementsInterfaces? Directives[Const]
   *  - extend type Name ImplementsInterfaces
   */
  parseObjectTypeExtension(): ObjectTypeExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('type');
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseDirectives(true);
    const fields = this.parseFieldsDefinition();
    if (
      interfaces.length === 0 &&
      directives.length === 0 &&
      fields.length === 0
    ) {
      throw this.unexpected();
    }
    return {
      kind: Kind.OBJECT_TYPE_EXTENSION,
      name,
      interfaces,
      directives,
      fields,
      loc: this.loc(start),
    };
  }

  /**
   * InterfaceTypeExtension :
   *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend interface Name ImplementsInterfaces? Directives[Const]
   *  - extend interface Name ImplementsInterfaces
   */
  parseInterfaceTypeExtension(): InterfaceTypeExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('interface');
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseDirectives(true);
    const fields = this.parseFieldsDefinition();
    if (
      interfaces.length === 0 &&
      directives.length === 0 &&
      fields.length === 0
    ) {
      throw this.unexpected();
    }
    return {
      kind: Kind.INTERFACE_TYPE_EXTENSION,
      name,
      interfaces,
      directives,
      fields,
      loc: this.loc(start),
    };
  }

  /**
   * UnionTypeExtension :
   *   - extend union Name Directives[Const]? UnionMemberTypes
   *   - extend union Name Directives[Const]
   */
  parseUnionTypeExtension(): UnionTypeExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('union');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    const types = this.parseUnionMemberTypes();
    if (directives.length === 0 && types.length === 0) {
      throw this.unexpected();
    }
    return {
      kind: Kind.UNION_TYPE_EXTENSION,
      name,
      directives,
      types,
      loc: this.loc(start),
    };
  }

  /**
   * EnumTypeExtension :
   *   - extend enum Name Directives[Const]? EnumValuesDefinition
   *   - extend enum Name Directives[Const]
   */
  parseEnumTypeExtension(): EnumTypeExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('enum');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    const values = this.parseEnumValuesDefinition();
    if (directives.length === 0 && values.length === 0) {
      throw this.unexpected();
    }
    return {
      kind: Kind.ENUM_TYPE_EXTENSION,
      name,
      directives,
      values,
      loc: this.loc(start),
    };
  }

  /**
   * InputObjectTypeExtension :
   *   - extend input Name Directives[Const]? InputFieldsDefinition
   *   - extend input Name Directives[Const]
   */
  parseInputObjectTypeExtension(): InputObjectTypeExtensionNode {
    const start = this._lexer.token;
    this.expectKeyword('extend');
    this.expectKeyword('input');
    const name = this.parseName();
    const directives = this.parseDirectives(true);
    const fields = this.parseInputFieldsDefinition();
    if (directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return {
      kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
      name,
      directives,
      fields,
      loc: this.loc(start),
    };
  }

  /**
   * DirectiveDefinition :
   *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
   */
  parseDirectiveDefinition(): DirectiveDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('directive');
    this.expectToken(TokenKind.AT);
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    const repeatable = this.expectOptionalKeyword('repeatable');
    this.expectKeyword('on');
    const locations = this.parseDirectiveLocations();
    return {
      kind: Kind.DIRECTIVE_DEFINITION,
      description,
      name,
      arguments: args,
      repeatable,
      locations,
      loc: this.loc(start),
    };
  }

  /**
   * DirectiveLocations :
   *   - `|`? DirectiveLocation
   *   - DirectiveLocations | DirectiveLocation
   */
  parseDirectiveLocations(): Array<NameNode> {
    // Optional leading pipe
    this.expectOptionalToken(TokenKind.PIPE);
    const locations = [];
    do {
      locations.push(this.parseDirectiveLocation());
    } while (this.expectOptionalToken(TokenKind.PIPE));
    return locations;
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
  parseDirectiveLocation(): NameNode {
    const start = this._lexer.token;
    const name = this.parseName();
    if (DirectiveLocation[name.value] !== undefined) {
      return name;
    }
    throw this.unexpected(start);
  }

  // Core parsing utility functions

  /**
   * Returns a location object, used to identify the place in
   * the source that created a given parsed object.
   */
  loc(startToken: Token): Location | void {
    if (this._options?.noLocation !== true) {
      return new Location(
        startToken,
        this._lexer.lastToken,
        this._lexer.source,
      );
    }
  }

  /**
   * Determines if the next token is of a given kind
   */
  peek(kind: TokenKindEnum): boolean {
    return this._lexer.token.kind === kind;
  }

  /**
   * If the next token is of the given kind, return that token after advancing
   * the lexer. Otherwise, do not change the parser state and throw an error.
   */
  expectToken(kind: TokenKindEnum): Token {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this._lexer.advance();
      return token;
    }

    throw syntaxError(
      this._lexer.source,
      token.start,
      `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`,
    );
  }

  /**
   * If the next token is of the given kind, return that token after advancing
   * the lexer. Otherwise, do not change the parser state and return undefined.
   */
  expectOptionalToken(kind: TokenKindEnum): ?Token {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this._lexer.advance();
      return token;
    }
    return undefined;
  }

  /**
   * If the next token is a given keyword, advance the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectKeyword(value: string) {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this._lexer.advance();
    } else {
      throw syntaxError(
        this._lexer.source,
        token.start,
        `Expected "${value}", found ${getTokenDesc(token)}.`,
      );
    }
  }

  /**
   * If the next token is a given keyword, return "true" after advancing
   * the lexer. Otherwise, do not change the parser state and return "false".
   */
  expectOptionalKeyword(value: string): boolean {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this._lexer.advance();
      return true;
    }
    return false;
  }

  /**
   * Helper function for creating an error when an unexpected lexed token
   * is encountered.
   */
  unexpected(atToken?: ?Token): GraphQLError {
    const token = atToken ?? this._lexer.token;
    return syntaxError(
      this._lexer.source,
      token.start,
      `Unexpected ${getTokenDesc(token)}.`,
    );
  }

  /**
   * Returns a possibly empty list of parse nodes, determined by
   * the parseFn. This list begins with a lex token of openKind
   * and ends with a lex token of closeKind. Advances the parser
   * to the next lex token after the closing token.
   */
  any<T>(
    openKind: TokenKindEnum,
    parseFn: () => T,
    closeKind: TokenKindEnum,
  ): Array<T> {
    this.expectToken(openKind);
    const nodes = [];
    while (!this.expectOptionalToken(closeKind)) {
      nodes.push(parseFn.call(this));
    }
    return nodes;
  }

  /**
   * Returns a list of parse nodes, determined by the parseFn.
   * It can be empty only if open token is missing otherwise it will always
   * return non-empty list that begins with a lex token of openKind and ends
   * with a lex token of closeKind. Advances the parser to the next lex token
   * after the closing token.
   */
  optionalMany<T>(
    openKind: TokenKindEnum,
    parseFn: () => T,
    closeKind: TokenKindEnum,
  ): Array<T> {
    if (this.expectOptionalToken(openKind)) {
      const nodes = [];
      do {
        nodes.push(parseFn.call(this));
      } while (!this.expectOptionalToken(closeKind));
      return nodes;
    }
    return [];
  }

  /**
   * Returns a non-empty list of parse nodes, determined by
   * the parseFn. This list begins with a lex token of openKind
   * and ends with a lex token of closeKind. Advances the parser
   * to the next lex token after the closing token.
   */
  many<T>(
    openKind: TokenKindEnum,
    parseFn: () => T,
    closeKind: TokenKindEnum,
  ): Array<T> {
    this.expectToken(openKind);
    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (!this.expectOptionalToken(closeKind));
    return nodes;
  }
}

/**
 * A helper function to describe a token as a string for debugging
 */
function getTokenDesc(token: Token): string {
  const value = token.value;
  return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : '');
}

/**
 * A helper function to describe a token kind as a string for debugging
 */
function getTokenKindDesc(kind: TokenKindEnum): string {
  return isPunctuatorTokenKind(kind) ? `"${kind}"` : kind;
}
