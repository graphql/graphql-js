export declare const TokenKind: {
  NAME: string;
  INT: string;
  FLOAT: string;
  STRING: string;
  BLOCK_STRING: string;
  COMMENT: string;
  PUNCTUATION: string;
  EOF: string;
  INVALID: string;
};
export declare const RuleKind: {
  TOKEN_CONSTRAINT: string;
  OF_TYPE_CONSTRAINT: string;
  LIST_OF_TYPE_CONSTRAINT: string;
  PEEK_CONSTRAINT: string;
  CONSTRAINTS_SET: string;
  CONSTRAINTS_SET_ROOT: string;
  RULE_NAME: string;
  INVALID: string;
};
export interface LanguageType {
  rules: Rules;
}
export interface Rules {
  [name: string]: Rule;
}
export declare type Rule = RuleName | RuleConstraint | ConstraintsSet;
export declare type RuleName = string;
export declare type RuleConstraint =
  | TokenConstraint
  | OfTypeConstraint
  | ListOfTypeConstraint
  | PeekConstraint;
export declare type ConstraintsSet = Array<RuleName | RuleConstraint>;
export interface BaseRuleConstraint {
  butNot?: TokenConstraint | Array<TokenConstraint>;
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
  ofValue?: string;
  oneOf?: Array<string>;
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
export declare type ParserRule =
  | TokenParserRule
  | OfTypeParserRule
  | ListOfTypeParserRule
  | PeekParserRule
  | ConstraintsSetRule;
export interface ParserState {
  rules: Array<ParserRule>;
  kind: () => string;
  step: () => number;
  levels: Array<number>;
  indentLevel: number | undefined;
  name: string | null;
  type: string | null;
}
export interface Token {
  kind: string;
  value?: string;
  style?: string;
}
export interface LexerToken {
  kind: string;
  value?: string;
}
export declare type Styles = {
  [name: string]: string;
};
export declare type ParserConfig = {
  tabSize: number;
};
export declare type ParserConfigOption = {
  tabSize?: number;
};
