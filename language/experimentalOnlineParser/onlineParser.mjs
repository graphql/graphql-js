import { Lexer } from "../lexer.mjs";
import { Source } from "../source.mjs";
import { grammar } from "./grammar.mjs";
export const TokenKind = {
  NAME: 'Name',
  INT: 'Int',
  FLOAT: 'Float',
  STRING: 'String',
  BLOCK_STRING: 'BlockString',
  COMMENT: 'Comment',
  PUNCTUATION: 'Punctuation',
  EOF: '<EOF>',
  INVALID: 'Invalid'
};
export const RuleKind = {
  TOKEN_CONSTRAINT: 'TokenConstraint',
  OF_TYPE_CONSTRAINT: 'OfTypeConstraint',
  LIST_OF_TYPE_CONSTRAINT: 'ListOfTypeConstraint',
  PEEK_CONSTRAINT: 'PeekConstraint',
  CONSTRAINTS_SET: 'ConstraintsSet',
  CONSTRAINTS_SET_ROOT: 'ConstraintsSetRoot',
  RULE_NAME: 'RuleName',
  INVALID: 'Invalid'
};
export class OnlineParser {
  constructor(source, state, config) {
    var _config$tabSize;

    this.state = state || OnlineParser.startState();
    this._config = {
      tabSize: (_config$tabSize = config === null || config === void 0 ? void 0 : config.tabSize) !== null && _config$tabSize !== void 0 ? _config$tabSize : 2
    };
    this._lexer = new Lexer(new Source(source));
  }

  static startState() {
    return {
      rules: [// $FlowFixMe[cannot-spread-interface]
      {
        name: 'Document',
        state: 'Document',
        kind: 'ListOfTypeConstraint',
        ...grammar.Document,
        expanded: false,
        depth: 1,
        step: 1
      }],
      name: null,
      type: null,
      levels: [],
      indentLevel: 0,

      kind() {
        var _this$rules;

        return ((_this$rules = this.rules[this.rules.length - 1]) === null || _this$rules === void 0 ? void 0 : _this$rules.state) || '';
      },

      step() {
        var _this$rules2;

        return ((_this$rules2 = this.rules[this.rules.length - 1]) === null || _this$rules2 === void 0 ? void 0 : _this$rules2.step) || 0;
      }

    };
  }

  static copyState(state) {
    return {
      name: state.name,
      type: state.type,
      rules: JSON.parse(JSON.stringify(state.rules)),
      levels: [...state.levels],
      indentLevel: state.indentLevel,

      kind() {
        var _this$rules3;

        return ((_this$rules3 = this.rules[this.rules.length - 1]) === null || _this$rules3 === void 0 ? void 0 : _this$rules3.state) || '';
      },

      step() {
        var _this$rules4;

        return ((_this$rules4 = this.rules[this.rules.length - 1]) === null || _this$rules4 === void 0 ? void 0 : _this$rules4.step) || 0;
      }

    };
  }

  sol() {
    return this._lexer.source.locationOffset.line === 1 && this._lexer.source.locationOffset.column === 1;
  }

  parseToken() {
    const rule = this._getNextRule();

    if (this.sol()) {
      this.state.indentLevel = Math.floor(this.indentation() / this._config.tabSize);
    }

    if (!rule) {
      return {
        kind: TokenKind.INVALID,
        value: ''
      };
    }

    let token;

    if (this._lookAhead().kind === '<EOF>') {
      return {
        kind: TokenKind.EOF,
        value: '',
        ruleName: rule.name
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
          ruleName: rule.name
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

  indentation() {
    const match = /\s*/.exec(this._lexer.source.body);
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

  _parseTokenConstraint(rule) {
    rule.expanded = true;

    const token = this._lookAhead();

    if (!this._matchToken(token, rule)) {
      return {
        kind: TokenKind.INVALID,
        value: '',
        tokenName: rule.tokenName,
        ruleName: rule.name
      };
    }

    this._advanceToken();

    const parserToken = this._transformLexerToken(token, rule);

    this._popMatchedRule(parserToken);

    return parserToken;
  }

  _parseListOfTypeConstraint(rule) {
    this._pushRule(grammar[rule.listOfType], rule.depth + 1, rule.listOfType, 1, rule.state);

    rule.expanded = true;
    const token = this.parseToken();
    return token;
  }

  _parseOfTypeConstraint(rule) {
    if (rule.expanded) {
      this._popMatchedRule();

      return this.parseToken();
    }

    this._pushRule(rule.ofType, rule.depth + 1, rule.tokenName, 1, rule.state);

    rule.expanded = true;
    const token = this.parseToken();
    return token;
  }

  _parsePeekConstraint(rule) {
    if (rule.expanded) {
      this._popMatchedRule();

      return this.parseToken();
    }

    while (!rule.matched && rule.index < rule.peek.length - 1) {
      rule.index++;
      const constraint = rule.peek[rule.index];
      let {
        ifCondition
      } = constraint;

      if (typeof ifCondition === 'string') {
        ifCondition = grammar[ifCondition];
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
      ruleName: rule.name
    };
  }

  _parseConstraintsSetRule(rule) {
    if (rule.expanded) {
      this._popMatchedRule();

      return this.parseToken();
    }

    for (let index = rule.constraints.length - 1; index >= 0; index--) {
      this._pushRule(rule.constraints[index], rule.depth + 1, '', index, rule.state);
    }

    rule.expanded = true;
    return this.parseToken();
  }

  _matchToken(token, rule) {
    if (typeof token.value === 'string') {
      if (typeof rule.ofValue === 'string' && token.value !== rule.ofValue || Array.isArray(rule.oneOf) && !rule.oneOf.includes(token.value) || typeof rule.ofValue !== 'string' && !Array.isArray(rule.oneOf) && token.kind !== rule.token) {
        return false;
      }

      return this._butNot(token, rule);
    }

    if (token.kind !== rule.token) {
      return false;
    }

    return this._butNot(token, rule);
  }

  _butNot(token, rule) {
    if (rule.butNot) {
      if (Array.isArray(rule.butNot)) {
        if (rule.butNot.reduce((matched, constraint) => matched || this._matchToken(token, constraint), false)) {
          return false;
        }

        return true;
      }

      return !this._matchToken(token, rule.butNot);
    }

    return true;
  }

  _transformLexerToken(lexerToken, rule) {
    let token;
    const ruleName = rule.name || '';
    const tokenName = rule.tokenName || '';

    if (lexerToken.kind === '<EOF>' || lexerToken.value !== undefined) {
      token = {
        kind: lexerToken.kind,
        value: lexerToken.value || '',
        tokenName,
        ruleName
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
        ruleName
      };

      if (/^[{([]/.test(token.value)) {
        if (this.state.indentLevel !== undefined) {
          this.state.levels = this.state.levels.concat(this.state.indentLevel + 1);
        }
      } else if (/^[})\]]/.test(token.value)) {
        this.state.levels.pop();
      }
    }

    return token;
  }

  _getNextRule() {
    return this.state.rules[this.state.rules.length - 1] || null;
  }

  _popMatchedRule(token) {
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

    if (nextRule.depth === rule.depth - 1 && nextRule.expanded && nextRule.kind === RuleKind.CONSTRAINTS_SET_ROOT) {
      this.state.rules.pop();
    }

    if (nextRule.depth === rule.depth - 1 && nextRule.expanded && nextRule.kind === RuleKind.LIST_OF_TYPE_CONSTRAINT) {
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

    while (nextRule && (poppedRule.kind !== RuleKind.LIST_OF_TYPE_CONSTRAINT || nextRule.expanded) && nextRule.depth > poppedRule.depth - 1) {
      this.state.rules.pop();
      popped++;
      nextRule = this._getNextRule();
    }

    if (nextRule && nextRule.expanded) {
      if (nextRule.optional === true) {
        popRule();
      } else {
        if (nextRule.kind === RuleKind.LIST_OF_TYPE_CONSTRAINT && popped === 1) {
          this.state.rules.pop();
          return;
        }

        this._rollbackRule();
      }
    }
  }

  _pushRule(baseRule, depth, name, step, state) {
    var _this$_getNextRule, _this$_getNextRule2, _this$_getNextRule3, _this$_getNextRule4, _this$_getNextRule5, _this$_getNextRule6, _this$_getNextRule7, _this$_getNextRule8, _this$_getNextRule9, _this$_getNextRule10;

    this.state.name = null;
    this.state.type = null;
    let rule = baseRule;

    switch (this._getRuleKind(rule)) {
      case RuleKind.RULE_NAME:
        rule = rule;

        this._pushRule(grammar[rule], depth, (typeof name === 'string' ? name : undefined) || rule, step, state);

        break;

      case RuleKind.CONSTRAINTS_SET:
        rule = rule;
        this.state.rules.push({
          name: name || '',
          depth,
          expanded: false,
          constraints: rule,
          constraintsSet: true,
          kind: RuleKind.CONSTRAINTS_SET_ROOT,
          state: (typeof name === 'string' ? name : undefined) || (typeof state === 'string' ? state : undefined) || ((_this$_getNextRule = this._getNextRule()) === null || _this$_getNextRule === void 0 ? void 0 : _this$_getNextRule.state) || '',
          step: typeof step === 'number' ? step : (((_this$_getNextRule2 = this._getNextRule()) === null || _this$_getNextRule2 === void 0 ? void 0 : _this$_getNextRule2.step) || 0) + 1
        });
        break;

      case RuleKind.OF_TYPE_CONSTRAINT:
        rule = rule;
        this.state.rules.push({
          name: name || '',
          ofType: rule.ofType,
          optional: Boolean(rule.optional),
          butNot: rule.butNot,
          eatNextOnFail: Boolean(rule.eatNextOnFail),
          depth,
          expanded: false,
          kind: RuleKind.OF_TYPE_CONSTRAINT,
          state: (typeof rule.tokenName === 'string' ? rule.tokenName : undefined) || (typeof name === 'string' ? name : undefined) || (typeof state === 'string' ? state : undefined) || ((_this$_getNextRule3 = this._getNextRule()) === null || _this$_getNextRule3 === void 0 ? void 0 : _this$_getNextRule3.state) || '',
          step: typeof step === 'number' ? step : (((_this$_getNextRule4 = this._getNextRule()) === null || _this$_getNextRule4 === void 0 ? void 0 : _this$_getNextRule4.step) || 0) + 1
        });
        break;

      case RuleKind.LIST_OF_TYPE_CONSTRAINT:
        rule = rule;
        this.state.rules.push({
          listOfType: rule.listOfType,
          optional: Boolean(rule.optional),
          butNot: rule.butNot,
          eatNextOnFail: Boolean(rule.eatNextOnFail),
          name: name || '',
          depth,
          expanded: false,
          kind: RuleKind.LIST_OF_TYPE_CONSTRAINT,
          state: (typeof name === 'string' ? name : undefined) || (typeof state === 'string' ? state : undefined) || ((_this$_getNextRule5 = this._getNextRule()) === null || _this$_getNextRule5 === void 0 ? void 0 : _this$_getNextRule5.state) || '',
          step: typeof step === 'number' ? step : (((_this$_getNextRule6 = this._getNextRule()) === null || _this$_getNextRule6 === void 0 ? void 0 : _this$_getNextRule6.step) || 0) + 1
        });
        break;

      case RuleKind.TOKEN_CONSTRAINT:
        rule = rule;
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
          state: (typeof rule.tokenName === 'string' ? rule.tokenName : undefined) || (typeof state === 'string' ? state : undefined) || ((_this$_getNextRule7 = this._getNextRule()) === null || _this$_getNextRule7 === void 0 ? void 0 : _this$_getNextRule7.state) || '',
          step: typeof step === 'number' ? step : (((_this$_getNextRule8 = this._getNextRule()) === null || _this$_getNextRule8 === void 0 ? void 0 : _this$_getNextRule8.step) || 0) + 1
        });
        break;

      case RuleKind.PEEK_CONSTRAINT:
        rule = rule;
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
          state: (typeof state === 'string' ? state : undefined) || ((_this$_getNextRule9 = this._getNextRule()) === null || _this$_getNextRule9 === void 0 ? void 0 : _this$_getNextRule9.state) || '',
          step: typeof step === 'number' ? step : (((_this$_getNextRule10 = this._getNextRule()) === null || _this$_getNextRule10 === void 0 ? void 0 : _this$_getNextRule10.step) || 0) + 1
        });
        break;
    }
  }

  _getRuleKind(rule) {
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

  _advanceToken() {
    return this._lexer.advance();
  }

  _lookAhead() {
    try {
      return this._lexer.lookahead();
    } catch (err) {
      return {
        kind: TokenKind.INVALID,
        value: ''
      };
    }
  }

}
