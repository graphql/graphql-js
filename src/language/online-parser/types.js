// @flow

export const TokenKind = {
  NAME: 'Name',
  INT: 'Int',
  FLOAT: 'Float',
  STRING: 'String',
  BLOCK_STRING: 'BlockString',
  COMMENT: 'Comment',
  PUNCTUATION: 'Punctuation',
  EOF: '<EOF>',
  INVALID: 'Invalid',
};

export const RuleKind = {
  TOKEN_CONSTRAINT: 'TokenConstraint',
  OF_TYPE_CONSTRAINT: 'OfTypeConstraint',
  LIST_OF_TYPE_CONSTRAINT: 'ListOfTypeConstraint',
  PEEK_CONSTRAINT: 'PeekConstraint',
  CONSTRAINTS_SET: 'ConstraintsSet',
  CONSTRAINTS_SET_ROOT: 'ConstraintsSetRoot',
  RULE_NAME: 'RuleName',
  INVALID: 'Invalid',
};

export type LanguageType = {|
  rules: Rules,
|};

export interface Rules {
  [name: string]: Rule;
}
export type RuleName = string;
export type RuleConstraint =
  | TokenConstraint
  | OfTypeConstraint
  | ListOfTypeConstraint
  | PeekConstraint;
export type ConstraintsSet = Array<RuleName | RuleConstraint>;
export type Rule = RuleName | RuleConstraint | ConstraintsSet;
export interface BaseRuleConstraint {
  butNot?: ?TokenConstraint | ?Array<TokenConstraint>;
  optional?: boolean;
  eatNextOnFail?: boolean;
}
export interface TokenConstraint extends BaseRuleConstraint {
  token:
    | '!'
    | '$'
    | '&'
    | '('
    | ')'
    | '...'
    | ':'
    | '='
    | '@'
    | '['
    | ']'
    | '{'
    | '}'
    | '|'
    | 'Name'
    | 'Int'
    | 'Float'
    | 'String'
    | 'BlockString'
    | 'Comment';
  ofValue?: ?string;
  oneOf?: ?Array<string>;
  tokenName?: string;
  definitionName?: boolean;
  typeName?: boolean;
}
export interface OfTypeConstraint extends BaseRuleConstraint {
  ofType: Rule;
  tokenName?: string;
}
export interface ListOfTypeConstraint extends BaseRuleConstraint {
  listOfType: RuleName;
}
export interface PeekConstraint extends BaseRuleConstraint {
  peek: Array<PeekCondition>;
}
export interface PeekCondition {
  ifCondition: TokenConstraint;
  expect: Rule;
  end?: boolean;
}
export interface BaseParserRule {
  kind: string;
  name?: string;
  depth: number;
  step: number;
  expanded: boolean;
  state: string;
  optional?: boolean;
  eatNextOnFail?: boolean;
}
export interface TokenParserRule extends BaseParserRule, TokenConstraint {}
export interface OfTypeParserRule extends BaseParserRule, OfTypeConstraint {}
export interface ListOfTypeParserRule
  extends BaseParserRule,
    ListOfTypeConstraint {}
export interface PeekParserRule extends BaseParserRule, PeekConstraint {
  index: number;
  matched: boolean;
}
export interface ConstraintsSetRule extends BaseParserRule {
  constraintsSet: boolean;
  constraints: ConstraintsSet;
}

export type ParserRule =
  | TokenParserRule
  | OfTypeParserRule
  | ListOfTypeParserRule
  | PeekParserRule
  | ConstraintsSetRule;

export type ParserState = {|
  rules: Array<ParserRule>,
  kind: () => string,
  step: () => number,
  levels: Array<number>,
  indentLevel: number,
  name: string | null,
  type: string | null,
|};

export type Token = {|
  kind: string,
  value: string,
  style: ?string,
|};

export type LexerToken = {|
  kind: string,
  value: ?string,
|};

export type Styles = {|
  [name: string]: string,
|};

export type ParserConfig = {|
  tabSize: number,
|};

export type ParserConfigOption = {|
  tabSize: ?number,
|};
