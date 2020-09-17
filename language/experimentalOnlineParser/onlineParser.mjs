function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import { Lexer } from "../lexer.mjs";
import { Source } from "../source.mjs";
import GraphQLGrammar from "./grammar.mjs";
export var TokenKind = {
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
export var RuleKind = {
  TOKEN_CONSTRAINT: 'TokenConstraint',
  OF_TYPE_CONSTRAINT: 'OfTypeConstraint',
  LIST_OF_TYPE_CONSTRAINT: 'ListOfTypeConstraint',
  PEEK_CONSTRAINT: 'PeekConstraint',
  CONSTRAINTS_SET: 'ConstraintsSet',
  CONSTRAINTS_SET_ROOT: 'ConstraintsSetRoot',
  RULE_NAME: 'RuleName',
  INVALID: 'Invalid'
};
export var OnlineParser = /*#__PURE__*/function () {
  function OnlineParser(source, state, config) {
    var _config$tabSize;

    this.state = state || OnlineParser.startState();
    this._config = {
      tabSize: (_config$tabSize = config === null || config === void 0 ? void 0 : config.tabSize) !== null && _config$tabSize !== void 0 ? _config$tabSize : 2
    };
    this._lexer = new Lexer(new Source(source));
  }

  OnlineParser.startState = function startState() {
    return {
      rules: [// $FlowFixMe[cannot-spread-interface]
      _objectSpread(_objectSpread({
        name: 'Document',
        state: 'Document',
        kind: 'ListOfTypeConstraint'
      }, GraphQLGrammar.Document), {}, {
        expanded: false,
        depth: 1,
        step: 1
      })],
      name: null,
      type: null,
      levels: [],
      indentLevel: 0,
      kind: function kind() {
        var _this$rules;

        return ((_this$rules = this.rules[this.rules.length - 1]) === null || _this$rules === void 0 ? void 0 : _this$rules.state) || '';
      },
      step: function step() {
        var _this$rules2;

        return ((_this$rules2 = this.rules[this.rules.length - 1]) === null || _this$rules2 === void 0 ? void 0 : _this$rules2.step) || 0;
      }
    };
  };

  OnlineParser.copyState = function copyState(state) {
    return {
      name: state.name,
      type: state.type,
      rules: JSON.parse(JSON.stringify(state.rules)),
      levels: [].concat(state.levels),
      indentLevel: state.indentLevel,
      kind: function kind() {
        var _this$rules3;

        return ((_this$rules3 = this.rules[this.rules.length - 1]) === null || _this$rules3 === void 0 ? void 0 : _this$rules3.state) || '';
      },
      step: function step() {
        var _this$rules4;

        return ((_this$rules4 = this.rules[this.rules.length - 1]) === null || _this$rules4 === void 0 ? void 0 : _this$rules4.step) || 0;
      }
    };
  };

  var _proto = OnlineParser.prototype;

  _proto.sol = function sol() {
    return this._lexer.source.locationOffset.line === 1 && this._lexer.source.locationOffset.column === 1;
  };

  _proto.parseToken = function parseToken() {
    var rule = this._getNextRule();

    if (this.sol()) {
      this.state.indentLevel = Math.floor(this.indentation() / this._config.tabSize);
    }

    if (!rule) {
      return {
        kind: TokenKind.INVALID,
        value: ''
      };
    }

    var token;

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
  };

  _proto.indentation = function indentation() {
    var match = this._lexer.source.body.match(/\s*/);

    var indent = 0;

    if (match && match.length === 0) {
      var whiteSpaces = match[0];
      var pos = 0;

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
  };

  _proto._parseTokenConstraint = function _parseTokenConstraint(rule) {
    rule.expanded = true;

    var token = this._lookAhead();

    if (!this._matchToken(token, rule)) {
      return {
        kind: TokenKind.INVALID,
        value: '',
        tokenName: rule.tokenName,
        ruleName: rule.name
      };
    }

    this._advanceToken();

    var parserToken = this._transformLexerToken(token, rule);

    this._popMatchedRule(parserToken);

    return parserToken;
  };

  _proto._parseListOfTypeConstraint = function _parseListOfTypeConstraint(rule) {
    this._pushRule(GraphQLGrammar[rule.listOfType], rule.depth + 1, rule.listOfType, 1, rule.state);

    rule.expanded = true;
    var token = this.parseToken();
    return token;
  };

  _proto._parseOfTypeConstraint = function _parseOfTypeConstraint(rule) {
    if (rule.expanded) {
      this._popMatchedRule();

      return this.parseToken();
    }

    this._pushRule(rule.ofType, rule.depth + 1, rule.tokenName, 1, rule.state);

    rule.expanded = true;
    var token = this.parseToken();
    return token;
  };

  _proto._parsePeekConstraint = function _parsePeekConstraint(rule) {
    if (rule.expanded) {
      this._popMatchedRule();

      return this.parseToken();
    }

    while (!rule.matched && rule.index < rule.peek.length - 1) {
      rule.index++;
      var constraint = rule.peek[rule.index];
      var ifCondition = constraint.ifCondition;

      if (typeof ifCondition === 'string') {
        ifCondition = GraphQLGrammar[ifCondition];
      }

      var token = this._lookAhead();

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
  };

  _proto._parseConstraintsSetRule = function _parseConstraintsSetRule(rule) {
    if (rule.expanded) {
      this._popMatchedRule();

      return this.parseToken();
    }

    for (var index = rule.constraints.length - 1; index >= 0; index--) {
      this._pushRule(rule.constraints[index], rule.depth + 1, '', index, rule.state);
    }

    rule.expanded = true;
    return this.parseToken();
  };

  _proto._matchToken = function _matchToken(token, rule) {
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
  };

  _proto._butNot = function _butNot(token, rule) {
    var _this = this;

    if (rule.butNot) {
      if (Array.isArray(rule.butNot)) {
        if (rule.butNot.reduce(function (matched, constraint) {
          return matched || _this._matchToken(token, constraint);
        }, false)) {
          return false;
        }

        return true;
      }

      return !this._matchToken(token, rule.butNot);
    }

    return true;
  };

  _proto._transformLexerToken = function _transformLexerToken(lexerToken, rule) {
    var token;
    var ruleName = rule.name || '';
    var tokenName = rule.tokenName || '';

    if (lexerToken.kind === '<EOF>' || lexerToken.value !== undefined) {
      token = {
        kind: lexerToken.kind,
        value: lexerToken.value || '',
        tokenName: tokenName,
        ruleName: ruleName
      };

      if (token.kind === TokenKind.STRING) {
        token.value = "\"".concat(token.value, "\"");
      } else if (token.kind === TokenKind.BLOCK_STRING) {
        token.value = "\"\"\"".concat(token.value, "\"\"\"");
      }
    } else {
      token = {
        kind: TokenKind.PUNCTUATION,
        value: lexerToken.kind,
        tokenName: tokenName,
        ruleName: ruleName
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
  };

  _proto._getNextRule = function _getNextRule() {
    return this.state.rules[this.state.rules.length - 1] || null;
  };

  _proto._popMatchedRule = function _popMatchedRule(token) {
    var rule = this.state.rules.pop();

    if (!rule) {
      return;
    }

    if (token && rule.kind === RuleKind.TOKEN_CONSTRAINT) {
      var constraint = rule;

      if (typeof constraint.definitionName === 'string') {
        this.state.name = token.value || null;
      } else if (typeof constraint.typeName === 'string') {
        this.state.type = token.value || null;
      }
    }

    var nextRule = this._getNextRule();

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
  };

  _proto._rollbackRule = function _rollbackRule() {
    var _this2 = this;

    if (!this.state.rules.length) {
      return;
    }

    var popRule = function popRule() {
      var lastPoppedRule = _this2.state.rules.pop();

      if (lastPoppedRule.eatNextOnFail === true) {
        _this2.state.rules.pop();
      }
    };

    var poppedRule = this.state.rules.pop();

    if (!poppedRule) {
      return;
    }

    var popped = 0;

    var nextRule = this._getNextRule();

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
  };

  _proto._pushRule = function _pushRule(baseRule, depth, name, step, state) {
    var _this$_getNextRule, _this$_getNextRule2, _this$_getNextRule3, _this$_getNextRule4, _this$_getNextRule5, _this$_getNextRule6, _this$_getNextRule7, _this$_getNextRule8, _this$_getNextRule9, _this$_getNextRule10;

    this.state.name = null;
    this.state.type = null;
    var rule = baseRule;

    switch (this._getRuleKind(rule)) {
      case RuleKind.RULE_NAME:
        rule = rule;

        this._pushRule(GraphQLGrammar[rule], depth, (typeof name === 'string' ? name : undefined) || rule, step, state);

        break;

      case RuleKind.CONSTRAINTS_SET:
        rule = rule;
        this.state.rules.push({
          name: name || '',
          depth: depth,
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
          depth: depth,
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
          depth: depth,
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
          depth: depth,
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
          depth: depth,
          index: -1,
          matched: false,
          expanded: false,
          kind: RuleKind.PEEK_CONSTRAINT,
          state: (typeof state === 'string' ? state : undefined) || ((_this$_getNextRule9 = this._getNextRule()) === null || _this$_getNextRule9 === void 0 ? void 0 : _this$_getNextRule9.state) || '',
          step: typeof step === 'number' ? step : (((_this$_getNextRule10 = this._getNextRule()) === null || _this$_getNextRule10 === void 0 ? void 0 : _this$_getNextRule10.step) || 0) + 1
        });
        break;
    }
  };

  _proto._getRuleKind = function _getRuleKind(rule) {
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
  };

  _proto._advanceToken = function _advanceToken() {
    return this._lexer.advance();
  };

  _proto._lookAhead = function _lookAhead() {
    try {
      return this._lexer.lookahead();
    } catch (err) {
      return {
        kind: TokenKind.INVALID,
        value: ''
      };
    }
  };

  return OnlineParser;
}();
