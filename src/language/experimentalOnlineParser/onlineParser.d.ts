import { Lexer } from '../lexer';

import {
  GraphQLGrammarTokenConstraint,
  GraphQLGrammarOfTypeConstraint,
  GraphQLGrammarListOfTypeConstraint,
  GraphQLGrammarPeekConstraint,
  GraphQLGrammarConstraintsSet,
} from './grammar';

interface BaseOnlineParserRule {
  kind: string;
  name?: string;
  depth: number;
  step: number;
  expanded: boolean;
  state: string;
  optional?: boolean;
  eatNextOnFail?: boolean;
}
interface TokenOnlineParserRule
  extends BaseOnlineParserRule,
    GraphQLGrammarTokenConstraint {}
interface OfTypeOnlineParserRule
  extends BaseOnlineParserRule,
    GraphQLGrammarOfTypeConstraint {}
interface ListOfTypeOnlineParserRule
  extends BaseOnlineParserRule,
    GraphQLGrammarListOfTypeConstraint {}
interface PeekOnlineParserRule
  extends BaseOnlineParserRule,
    GraphQLGrammarPeekConstraint {
  index: number;
  matched: boolean;
}
interface ConstraintsSetOnlineParserRule extends BaseOnlineParserRule {
  constraintsSet: boolean;
  constraints: GraphQLGrammarConstraintsSet;
}

type OnlineParserRule =
  | TokenOnlineParserRule
  | OfTypeOnlineParserRule
  | ListOfTypeOnlineParserRule
  | PeekOnlineParserRule
  | ConstraintsSetOnlineParserRule;

export interface OnlineParserState {
  rules: Array<OnlineParserRule>;
  kind: () => string;
  step: () => number;
  levels: Array<number>;
  indentLevel: number | undefined;
  name: string | null;
  type: string | null;
}

interface Token {
  kind: string;
  value?: string;
  tokenName?: string | undefined;
  ruleName?: string | undefined;
}

type OnlineParserConfig = {
  tabSize: number;
};

type OnlineParserConfigOption = {
  tabSize?: number;
};

export class OnlineParser {
  state: OnlineParserState;
  _lexer: Lexer;
  _config: OnlineParserConfig;
  constructor(
    source: string,
    state?: OnlineParserState,
    config?: OnlineParserConfigOption,
  );
  static startState(): OnlineParserState;
  static copyState(state: OnlineParserState): OnlineParserState;
  sol(): boolean;
  parseToken(): Token;
  indentation(): number;
  private readonly _parseTokenConstraint;
  private readonly _parseListOfTypeConstraint;
  private readonly _parseOfTypeConstraint;
  private readonly _parsePeekConstraint;
  private readonly _parseConstraintsSetRule;
  private readonly _matchToken;
  private readonly _butNot;
  private readonly _transformLexerToken;
  private readonly _getNextRule;
  private readonly _popMatchedRule;
  private readonly _rollbackRule;
  private readonly _pushRule;
  private readonly _getRuleKind;
  private readonly _advanceToken;
  private readonly _lookAhead;
}

export const TokenKind: {
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

export const RuleKind: {
  TOKEN_CONSTRAINT: string;
  OF_TYPE_CONSTRAINT: string;
  LIST_OF_TYPE_CONSTRAINT: string;
  PEEK_CONSTRAINT: string;
  CONSTRAINTS_SET: string;
  CONSTRAINTS_SET_ROOT: string;
  RULE_NAME: string;
  INVALID: string;
};
