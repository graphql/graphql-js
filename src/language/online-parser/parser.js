import { Lexer } from '../lexer';
import { Source } from '../source';

import Language from './language';
import { RuleKind, TokenKind } from './types';
import type {
  Token,
  LexerToken,
  Styles,
  ParserRule,
  ParserState,
  ParserConfig,
  ParserConfigOption,
  Rule,
  RuleName,
  RuleConstraint,
  TokenParserRule,
  OfTypeParserRule,
  ListOfTypeParserRule,
  PeekParserRule,
  ConstraintsSetRule,
  OfTypeConstraint,
  ListOfTypeConstraint,
  TokenConstraint,
  PeekConstraint,
  ConstraintsSet,
} from './types';

export class Parser {
  state: ParserState;
  lexer: Lexer;
  styles: Styles;
  config: ParserConfig;

  constructor({
    state,
    styles,
    config,
    source,
  }: {|
    state: ?ParserState,
    styles: ?Styles,
    config: ?ParserConfigOption,
    source: string,
  |}) {
    this.state = state || Parser.startState();
    this.styles = styles || {};
    this.config = {
      tabSize: typeof config?.tabSize === 'number' ? config.tabSize : 2,
    };
    this.lexer = new Lexer(new Source(source));
  }

  static startState(): ParserState {
    return {
      rules: [
        {
          name: 'Document',
          state: 'Document',
          kind: 'ListOfTypeConstraint',
          ...Language.rules.Document,
          expanded: false,
          depth: 1,
          step: 1,
        },
      ],
      name: null,
      type: null,
      levels: [],
      indentLevel: 0,
      kind(): string {
        return this.rules[this.rules.length - 1]?.state || '';
      },
      step(): number {
        return this.rules[this.rules.length - 1]?.step || 0;
      },
    };
  }

  static copyState(state: ParserState): ParserState {
    return {
      name: state.name,
      type: state.type,
      rules: JSON.parse(JSON.stringify(state.rules)),
      levels: [...state.levels],
      indentLevel: state.indentLevel,
      kind(): string {
        return this.rules[this.rules.length - 1]?.state || '';
      },
      step(): number {
        return this.rules[this.rules.length - 1]?.step || 0;
      },
    };
  }

  sol(): boolean {
    return (
      this.lexer.source.locationOffset.line === 1 &&
      this.lexer.source.locationOffset.column === 1
    );
  }

  parseToken(): Token {
    const rule = (this.getNextRule(): any);

    if (this.sol()) {
      this.state.indentLevel = Math.floor(
        this.indentation() / this.config.tabSize,
      );
    }

    if (!rule) {
      return {
        kind: TokenKind.INVALID,
        style: this.styles[TokenKind.INVALID],
        value: '',
      };
    }

    let token;

    if (this.lookAhead().kind === '<EOF>') {
      return {
        kind: TokenKind.EOF,
        style: this.styles[TokenKind.EOF],
        value: '',
      };
    }

    switch (rule.kind) {
      case RuleKind.TOKEN_CONSTRAINT:
        token = this.parseTokenConstraint(rule);
        break;
      case RuleKind.LIST_OF_TYPE_CONSTRAINT:
        token = this.parseListOfTypeConstraint(rule);
        break;
      case RuleKind.OF_TYPE_CONSTRAINT:
        token = this.parseOfTypeConstraint(rule);
        break;
      case RuleKind.PEEK_CONSTRAINT:
        token = this.parsePeekConstraint(rule);
        break;
      case RuleKind.CONSTRAINTS_SET_ROOT:
        token = this.parseConstraintsSetRule(rule);
        break;
      default:
        return {
          kind: TokenKind.INVALID,
          style: this.styles[TokenKind.INVALID],
          value: '',
        };
    }

    if (token && token.kind === TokenKind.INVALID) {
      if (rule.optional === true) {
        this.state.rules.pop();
      } else {
        this.rollbackRule();
      }

      return this.parseToken() || token;
    }

    return token;
  }

  indentation(): number {
    const match = this.lexer.source.body.match(/\s*/);
    let indent = 0;

    if (match && match.length === 0) {
      const whiteSpaces = match[0];
      let pos = 0;
      while (whiteSpaces.length > pos) {
        if (whiteSpaces.charCodeAt(pos) === 9) {
          indent += 2;
        } else {
          indent++;
        }
        pos++;
      }
    }

    return indent;
  }

  parseTokenConstraint(rule: TokenParserRule): Token {
    rule.expanded = true;

    const token = this.lookAhead();

    if (!this.matchToken(token, rule)) {
      return {
        kind: TokenKind.INVALID,
        style: this.styles[TokenKind.INVALID],
        value: '',
      };
    }

    this.advanceToken();
    const parserToken = this.transformLexerToken(token, rule);
    this.popMatchedRule(parserToken);

    return parserToken;
  }

  parseListOfTypeConstraint(rule: ListOfTypeParserRule): Token {
    this.pushRule(
      Language.rules[rule.listOfType],
      rule.depth + 1,
      rule.listOfType,
      1,
      rule.state,
    );

    rule.expanded = true;

    const token = this.parseToken();

    return token;
  }

  parseOfTypeConstraint(rule: OfTypeParserRule): Token {
    if (rule.expanded) {
      this.popMatchedRule();
      return this.parseToken();
    }

    this.pushRule(rule.ofType, rule.depth + 1, rule.tokenName, 1, rule.state);
    rule.expanded = true;

    const token = this.parseToken();

    return token;
  }

  parsePeekConstraint(rule: PeekParserRule): Token {
    if (rule.expanded) {
      this.popMatchedRule();
      return this.parseToken();
    }

    while (!rule.matched && rule.index < rule.peek.length - 1) {
      rule.index++;
      const constraint = rule.peek[rule.index];

      let { ifCondition } = constraint;
      if (typeof ifCondition === 'string') {
        ifCondition = Language.rules[ifCondition];
      }

      let token = this.lookAhead();
      if (ifCondition && this.matchToken(token, ifCondition)) {
        rule.matched = true;
        rule.expanded = true;
        this.pushRule(constraint.expect, rule.depth + 1, '', 1, rule.state);

        token = this.parseToken();

        return token;
      }
    }

    return {
      kind: TokenKind.INVALID,
      style: this.styles[TokenKind.INVALID],
      value: '',
    };
  }

  parseConstraintsSetRule(rule: ConstraintsSetRule): Token {
    if (rule.expanded) {
      this.popMatchedRule();
      return this.parseToken();
    }

    for (let index = rule.constraints.length - 1; index >= 0; index--) {
      this.pushRule(
        rule.constraints[index],
        rule.depth + 1,
        '',
        index,
        rule.state,
      );
    }
    rule.expanded = true;

    return this.parseToken();
  }

  matchToken(token: Token | LexerToken, rule: TokenConstraint): boolean {
    if (typeof token.value === 'string') {
      if (
        (typeof rule.ofValue === 'string' && token.value !== rule.ofValue) ||
        (Array.isArray(rule.oneOf) && !rule.oneOf.includes(token.value)) ||
        (typeof rule.ofValue !== 'string' &&
          !Array.isArray(rule.oneOf) &&
          token.kind !== rule.token)
      ) {
        return false;
      }

      return this.butNot(token, rule);
    }

    if (token.kind !== rule.token) {
      return false;
    }

    return this.butNot(token, rule);
  }

  butNot(token: Token | LexerToken, rule: RuleConstraint): boolean {
    if (rule.butNot) {
      if (Array.isArray(rule.butNot)) {
        if (
          rule.butNot.reduce(
            (matched, constraint) =>
              matched || this.matchToken(token, constraint),
            false,
          )
        ) {
          return false;
        }

        return true;
      }

      return !this.matchToken(token, rule.butNot);
    }

    return true;
  }

  transformLexerToken(lexerToken: LexerToken, rule: any): Token {
    let token;
    const ruleName = rule.name || '';
    const tokenName = rule.tokenName || '';

    if (lexerToken.kind === '<EOF>' || lexerToken.value !== undefined) {
      token = {
        kind: lexerToken.kind,
        value: lexerToken.value || '',
        style:
          this.styles[tokenName] ||
          this.styles[ruleName] ||
          this.styles[lexerToken.kind],
      };

      if (token.kind === TokenKind.STRING) {
        token.value = `"${token.value}"`;
      } else if (token.kind === TokenKind.BLOCK_STRING) {
        token.value = `"""${token.value}"""`;
      }
    } else {
      token = {
        kind: TokenKind.PUNCTUATION,
        value: lexerToken.kind,
        style:
          this.styles[tokenName] ||
          this.styles[ruleName] ||
          this.styles[TokenKind.PUNCTUATION],
      };

      if (/^[{([]/.test(token.value)) {
        if (this.state.indentLevel !== undefined) {
          this.state.levels = this.state.levels.concat(
            this.state.indentLevel + 1,
          );
        }
      } else if (/^[})\]]/.test(token.value)) {
        this.state.levels.pop();
      }
    }

    return token;
  }

  getNextRule(): ParserRule | null {
    return this.state.rules[this.state.rules.length - 1] || null;
  }

  popMatchedRule(token: ?Token) {
    const rule = this.state.rules.pop();
    if (!rule) {
      return;
    }

    if (token && rule.kind === RuleKind.TOKEN_CONSTRAINT) {
      const constraint = rule;
      if (typeof constraint.definitionName === 'string') {
        this.state.name = token.value || null;
      } else if (typeof constraint.typeName === 'string') {
        this.state.type = token.value || null;
      }
    }

    const nextRule = this.getNextRule();
    if (!nextRule) {
      return;
    }

    if (
      nextRule.depth === rule.depth - 1 &&
      nextRule.expanded &&
      nextRule.kind === RuleKind.CONSTRAINTS_SET_ROOT
    ) {
      this.state.rules.pop();
    }

    if (
      nextRule.depth === rule.depth - 1 &&
      nextRule.expanded &&
      nextRule.kind === RuleKind.LIST_OF_TYPE_CONSTRAINT
    ) {
      nextRule.expanded = false;
      nextRule.optional = true;
    }
  }

  rollbackRule() {
    if (!this.state.rules.length) {
      return;
    }

    const popRule = () => {
      const lastPoppedRule = this.state.rules.pop();

      if (lastPoppedRule.eatNextOnFail === true) {
        this.state.rules.pop();
      }
    };

    const poppedRule = this.state.rules.pop();
    if (!poppedRule) {
      return;
    }

    let popped = 0;
    let nextRule = this.getNextRule();
    while (
      nextRule &&
      (poppedRule.kind !== RuleKind.LIST_OF_TYPE_CONSTRAINT ||
        nextRule.expanded) &&
      nextRule.depth > poppedRule.depth - 1
    ) {
      this.state.rules.pop();
      popped++;
      nextRule = this.getNextRule();
    }

    if (nextRule && nextRule.expanded) {
      if (nextRule.optional === true) {
        popRule();
      } else {
        if (
          nextRule.kind === RuleKind.LIST_OF_TYPE_CONSTRAINT &&
          popped === 1
        ) {
          this.state.rules.pop();
          return;
        }
        this.rollbackRule();
      }
    }
  }

  pushRule(
    baseRule: any,
    depth: number,
    name?: string,
    step?: number,
    state?: string,
  ) {
    this.state.name = null;
    this.state.type = null;
    let rule = baseRule;

    switch (this.getRuleKind(rule)) {
      case RuleKind.RULE_NAME:
        rule = (rule: RuleName);
        this.pushRule(
          Language.rules[rule],
          depth,
          (typeof name === 'string' ? name : undefined) || rule,
          step,
          state,
        );
        break;
      case RuleKind.CONSTRAINTS_SET:
        rule = (rule: ConstraintsSet);
        this.state.rules.push({
          name: name || '',
          depth,
          expanded: false,
          constraints: rule,
          constraintsSet: true,
          kind: RuleKind.CONSTRAINTS_SET_ROOT,
          state:
            (typeof name === 'string' ? name : undefined) ||
            (typeof state === 'string' ? state : undefined) ||
            this.getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this.getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.OF_TYPE_CONSTRAINT:
        rule = (rule: OfTypeConstraint);
        this.state.rules.push({
          name: name || '',
          ofType: rule.ofType,
          optional: Boolean(rule.optional),
          butNot: rule.butNot,
          eatNextOnFail: Boolean(rule.eatNextOnFail),
          depth,
          expanded: false,
          kind: RuleKind.OF_TYPE_CONSTRAINT,
          state:
            (typeof rule.tokenName === 'string' ? rule.tokenName : undefined) ||
            (typeof name === 'string' ? name : undefined) ||
            (typeof state === 'string' ? state : undefined) ||
            this.getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this.getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.LIST_OF_TYPE_CONSTRAINT:
        rule = (rule: ListOfTypeConstraint);
        this.state.rules.push({
          listOfType: rule.listOfType,
          optional: Boolean(rule.optional),
          butNot: rule.butNot,
          eatNextOnFail: Boolean(rule.eatNextOnFail),
          name: name || '',
          depth,
          expanded: false,
          kind: RuleKind.LIST_OF_TYPE_CONSTRAINT,
          state:
            (typeof name === 'string' ? name : undefined) ||
            (typeof state === 'string' ? state : undefined) ||
            this.getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this.getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.TOKEN_CONSTRAINT:
        rule = (rule: TokenConstraint);
        this.state.rules.push({
          token: rule.token,
          ofValue: rule.ofValue,
          oneOf: rule.oneOf,
          definitionName: Boolean(rule.definitionName),
          typeName: Boolean(rule.typeName),
          optional: Boolean(rule.optional),
          butNot: rule.butNot,
          eatNextOnFail: Boolean(rule.eatNextOnFail),
          name: name || '',
          depth,
          expanded: false,
          kind: RuleKind.TOKEN_CONSTRAINT,
          state:
            (typeof rule.tokenName === 'string' ? rule.tokenName : undefined) ||
            (typeof state === 'string' ? state : undefined) ||
            this.getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this.getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.PEEK_CONSTRAINT:
        rule = (rule: PeekConstraint);
        this.state.rules.push({
          peek: rule.peek,
          optional: Boolean(rule.optional),
          butNot: rule.butNot,
          eatNextOnFail: Boolean(rule.eatNextOnFail),
          name: name || '',
          depth,
          index: -1,
          matched: false,
          expanded: false,
          kind: RuleKind.PEEK_CONSTRAINT,
          state:
            (typeof state === 'string' ? state : undefined) ||
            this.getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this.getNextRule()?.step || 0) + 1,
        });
        break;
    }
  }

  getRuleKind(rule: Rule | ParserRule): string {
    if (Array.isArray(rule)) {
      return RuleKind.CONSTRAINTS_SET;
    }

    if (rule.constraintsSet === true) {
      return RuleKind.CONSTRAINTS_SET_ROOT;
    }

    if (typeof rule === 'string') {
      return RuleKind.RULE_NAME;
    }

    if (Object.prototype.hasOwnProperty.call(rule, 'ofType')) {
      return RuleKind.OF_TYPE_CONSTRAINT;
    }

    if (Object.prototype.hasOwnProperty.call(rule, 'listOfType')) {
      return RuleKind.LIST_OF_TYPE_CONSTRAINT;
    }

    if (Object.prototype.hasOwnProperty.call(rule, 'peek')) {
      return RuleKind.PEEK_CONSTRAINT;
    }

    if (Object.prototype.hasOwnProperty.call(rule, 'token')) {
      return RuleKind.TOKEN_CONSTRAINT;
    }

    return RuleKind.INVALID;
  }

  advanceToken(): LexerToken {
    return (this.lexer.advance(): any);
  }

  lookAhead(): LexerToken {
    try {
      return (this.lexer.lookahead(): any);
    } catch (err) {
      return { kind: TokenKind.INVALID, value: '' };
    }
  }
}
