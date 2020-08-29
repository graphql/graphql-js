import { Lexer } from '../lexer';

import {
  Token,
  Styles,
  ParserState,
  ParserConfig,
  ParserConfigOption,
  Rule,
} from './types';

export declare class Parser {
  state: ParserState;
  lexer: Lexer;
  styles: Styles;
  config: ParserConfig;
  constructor({
    state,
    styles,
    config,
    source,
  }: {
    state?: ParserState;
    styles?: Styles;
    config?: ParserConfigOption;
    source: string;
  });
  static startState(): ParserState;
  static copyState(state: ParserState): ParserState;
  sol(): boolean;
  parseToken(): Token;
  indentation(): number;
  private readonly parseTokenConstraint;
  private readonly parseListOfTypeConstraint;
  private readonly parseOfTypeConstraint;
  private readonly parsePeekConstraint;
  private readonly parseConstraintsSetRule;
  private readonly matchToken;
  private readonly butNot;
  private readonly transformLexerToken;
  private readonly getNextRule;
  private readonly popMatchedRule;
  private readonly rollbackRule;
  pushRule(
    rule: Rule,
    depth: number,
    name?: string,
    step?: number,
    state?: string,
  ): void;
  private readonly getRuleKind;
  private readonly advanceToken;
  private readonly lookAhead;
}
