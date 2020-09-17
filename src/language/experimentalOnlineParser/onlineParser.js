import { Lexer } from '../lexer';
import { Source } from '../source';

import GraphQLGrammar from './grammar';
import type {
  GraphQLGrammarRule,
  GraphQLGrammarRuleName,
  GraphQLGrammarRuleConstraint,
  GraphQLGrammarTokenConstraint,
  GraphQLGrammarOfTypeConstraint,
  GraphQLGrammarListOfTypeConstraint,
  GraphQLGrammarPeekConstraint,
  GraphQLGrammarConstraintsSet,
} from './grammar';

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

export type OnlineParserState = {|
  rules: Array<OnlineParserRule>,
  kind: () => string,
  step: () => number,
  levels: Array<number>,
  indentLevel: number,
  name: string | null,
  type: string | null,
|};

type Token = {|
  kind: string,
  value: string,
  tokenName?: ?string,
  ruleName?: ?string,
|};

type LexerToken = {|
  kind: string,
  value: ?string,
|};

type OnlineParserConfig = {|
  tabSize: number,
|};

type OnlineParserConfigOption = {|
  tabSize: ?number,
|};

export class OnlineParser {
  state: OnlineParserState;
  _lexer: Lexer;
  _config: OnlineParserConfig;

  constructor(
    source: string,
    state?: OnlineParserState,
    config?: OnlineParserConfigOption,
  ) {
    this.state = state || OnlineParser.startState();
    this._config = {
      tabSize: config?.tabSize ?? 2,
    };
    this._lexer = new Lexer(new Source(source));
  }

  static startState(): OnlineParserState {
    return {
      rules: [
        // $FlowFixMe[cannot-spread-interface]
        {
          name: 'Document',
          state: 'Document',
          kind: 'ListOfTypeConstraint',
          ...GraphQLGrammar.Document,
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

  static copyState(state: OnlineParserState): OnlineParserState {
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
      this._lexer.source.locationOffset.line === 1 &&
      this._lexer.source.locationOffset.column === 1
    );
  }

  parseToken(): Token {
    const rule = (this._getNextRule(): any);

    if (this.sol()) {
      this.state.indentLevel = Math.floor(
        this.indentation() / this._config.tabSize,
      );
    }

    if (!rule) {
      return {
        kind: TokenKind.INVALID,
        value: '',
      };
    }

    let token;

    if (this._lookAhead().kind === '<EOF>') {
      return {
        kind: TokenKind.EOF,
        value: '',
        ruleName: rule.name,
      };
    }

    switch (rule.kind) {
      case RuleKind.TOKEN_CONSTRAINT:
        token = this._parseTokenConstraint(rule);
        break;
      case RuleKind.LIST_OF_TYPE_CONSTRAINT:
        token = this._parseListOfTypeConstraint(rule);
        break;
      case RuleKind.OF_TYPE_CONSTRAINT:
        token = this._parseOfTypeConstraint(rule);
        break;
      case RuleKind.PEEK_CONSTRAINT:
        token = this._parsePeekConstraint(rule);
        break;
      case RuleKind.CONSTRAINTS_SET_ROOT:
        token = this._parseConstraintsSetRule(rule);
        break;
      default:
        return {
          kind: TokenKind.INVALID,
          value: '',
          ruleName: rule.name,
        };
    }

    if (token && token.kind === TokenKind.INVALID) {
      if (rule.optional === true) {
        this.state.rules.pop();
      } else {
        this._rollbackRule();
      }

      return this.parseToken() || token;
    }

    return token;
  }

  indentation(): number {
    const match = this._lexer.source.body.match(/\s*/);
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

  _parseTokenConstraint(rule: TokenOnlineParserRule): Token {
    rule.expanded = true;

    const token = this._lookAhead();

    if (!this._matchToken(token, rule)) {
      return {
        kind: TokenKind.INVALID,
        value: '',
        tokenName: rule.tokenName,
        ruleName: rule.name,
      };
    }

    this._advanceToken();
    const parserToken = this._transformLexerToken(token, rule);
    this._popMatchedRule(parserToken);

    return parserToken;
  }

  _parseListOfTypeConstraint(rule: ListOfTypeOnlineParserRule): Token {
    this._pushRule(
      GraphQLGrammar[rule.listOfType],
      rule.depth + 1,
      rule.listOfType,
      1,
      rule.state,
    );

    rule.expanded = true;

    const token = this.parseToken();

    return token;
  }

  _parseOfTypeConstraint(rule: OfTypeOnlineParserRule): Token {
    if (rule.expanded) {
      this._popMatchedRule();
      return this.parseToken();
    }

    this._pushRule(rule.ofType, rule.depth + 1, rule.tokenName, 1, rule.state);
    rule.expanded = true;

    const token = this.parseToken();

    return token;
  }

  _parsePeekConstraint(rule: PeekOnlineParserRule): Token {
    if (rule.expanded) {
      this._popMatchedRule();
      return this.parseToken();
    }

    while (!rule.matched && rule.index < rule.peek.length - 1) {
      rule.index++;
      const constraint = rule.peek[rule.index];

      let { ifCondition } = constraint;
      if (typeof ifCondition === 'string') {
        ifCondition = GraphQLGrammar[ifCondition];
      }

      let token = this._lookAhead();
      if (ifCondition && this._matchToken(token, ifCondition)) {
        rule.matched = true;
        rule.expanded = true;
        this._pushRule(constraint.expect, rule.depth + 1, '', 1, rule.state);

        token = this.parseToken();

        return token;
      }
    }

    return {
      kind: TokenKind.INVALID,
      value: '',
      ruleName: rule.name,
    };
  }

  _parseConstraintsSetRule(rule: ConstraintsSetOnlineParserRule): Token {
    if (rule.expanded) {
      this._popMatchedRule();
      return this.parseToken();
    }

    for (let index = rule.constraints.length - 1; index >= 0; index--) {
      this._pushRule(
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

  _matchToken(
    token: Token | LexerToken,
    rule: GraphQLGrammarTokenConstraint,
  ): boolean {
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

      return this._butNot(token, rule);
    }

    if (token.kind !== rule.token) {
      return false;
    }

    return this._butNot(token, rule);
  }

  _butNot(
    token: Token | LexerToken,
    rule: GraphQLGrammarRuleConstraint,
  ): boolean {
    if (rule.butNot) {
      if (Array.isArray(rule.butNot)) {
        if (
          rule.butNot.reduce(
            (matched, constraint) =>
              matched || this._matchToken(token, constraint),
            false,
          )
        ) {
          return false;
        }

        return true;
      }

      return !this._matchToken(token, rule.butNot);
    }

    return true;
  }

  _transformLexerToken(lexerToken: LexerToken, rule: any): Token {
    let token;
    const ruleName = rule.name || '';
    const tokenName = rule.tokenName || '';

    if (lexerToken.kind === '<EOF>' || lexerToken.value !== undefined) {
      token = {
        kind: lexerToken.kind,
        value: lexerToken.value || '',
        tokenName,
        ruleName,
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
        tokenName,
        ruleName,
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

  _getNextRule(): OnlineParserRule | null {
    return this.state.rules[this.state.rules.length - 1] || null;
  }

  _popMatchedRule(token: ?Token) {
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

    const nextRule = this._getNextRule();
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

  _rollbackRule() {
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
    let nextRule = this._getNextRule();
    while (
      nextRule &&
      (poppedRule.kind !== RuleKind.LIST_OF_TYPE_CONSTRAINT ||
        nextRule.expanded) &&
      nextRule.depth > poppedRule.depth - 1
    ) {
      this.state.rules.pop();
      popped++;
      nextRule = this._getNextRule();
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
        this._rollbackRule();
      }
    }
  }

  _pushRule(
    baseRule: any,
    depth: number,
    name?: string,
    step?: number,
    state?: string,
  ) {
    this.state.name = null;
    this.state.type = null;
    let rule = baseRule;

    switch (this._getRuleKind(rule)) {
      case RuleKind.RULE_NAME:
        rule = (rule: GraphQLGrammarRuleName);
        this._pushRule(
          GraphQLGrammar[rule],
          depth,
          (typeof name === 'string' ? name : undefined) || rule,
          step,
          state,
        );
        break;
      case RuleKind.CONSTRAINTS_SET:
        rule = (rule: GraphQLGrammarConstraintsSet);
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
            this._getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this._getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.OF_TYPE_CONSTRAINT:
        rule = (rule: GraphQLGrammarOfTypeConstraint);
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
            this._getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this._getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.LIST_OF_TYPE_CONSTRAINT:
        rule = (rule: GraphQLGrammarListOfTypeConstraint);
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
            this._getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this._getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.TOKEN_CONSTRAINT:
        rule = (rule: GraphQLGrammarTokenConstraint);
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
            this._getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this._getNextRule()?.step || 0) + 1,
        });
        break;
      case RuleKind.PEEK_CONSTRAINT:
        rule = (rule: GraphQLGrammarPeekConstraint);
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
            this._getNextRule()?.state ||
            '',
          step:
            typeof step === 'number'
              ? step
              : (this._getNextRule()?.step || 0) + 1,
        });
        break;
    }
  }

  _getRuleKind(rule: GraphQLGrammarRule | OnlineParserRule): string {
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

  _advanceToken(): LexerToken {
    return (this._lexer.advance(): any);
  }

  _lookAhead(): LexerToken {
    try {
      return (this._lexer.lookahead(): any);
    } catch (err) {
      return { kind: TokenKind.INVALID, value: '' };
    }
  }
}
