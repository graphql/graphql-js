'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ValidationContext = undefined;

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

exports.validate = validate;
exports.visitUsingRules = visitUsingRules;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _error = require('../error');

var _visitor = require('../language/visitor');

var _kinds = require('../language/kinds');

var Kind = _interopRequireWildcard(_kinds);

var _schema = require('../type/schema');

var _TypeInfo = require('../utilities/TypeInfo');

var _specifiedRules = require('./specifiedRules');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Implements the "Validation" section of the spec.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 *
 * A list of specific validation rules may be provided. If not provided, the
 * default list of rules defined by the GraphQL specification will be used.
 *
 * Each validation rules is a function which returns a visitor
 * (see the language/visitor API). Visitor methods are expected to return
 * GraphQLErrors, or Arrays of GraphQLErrors when invalid.
 */
function validate(schema, ast, rules) {
  (0, _invariant2.default)(schema, 'Must provide schema');
  (0, _invariant2.default)(ast, 'Must provide document');
  (0, _invariant2.default)(schema instanceof _schema.GraphQLSchema, 'Schema must be an instance of GraphQLSchema. Also ensure that there are ' + 'not multiple versions of GraphQL installed in your node_modules directory.');
  var typeInfo = new _TypeInfo.TypeInfo(schema);
  return visitUsingRules(schema, typeInfo, ast, rules || _specifiedRules.specifiedRules);
}

/**
 * This uses a specialized visitor which runs multiple visitors in parallel,
 * while maintaining the visitor skip and break API.
 *
 * @internal
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function visitUsingRules(schema, typeInfo, documentAST, rules) {
  var context = new ValidationContext(schema, documentAST, typeInfo);
  var visitors = rules.map(function (rule) {
    return rule(context);
  });
  // Visit the whole document with each instance of all provided rules.
  (0, _visitor.visit)(documentAST, (0, _visitor.visitWithTypeInfo)(typeInfo, (0, _visitor.visitInParallel)(visitors)));
  return context.getErrors();
}

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */

var ValidationContext = exports.ValidationContext = function () {
  function ValidationContext(schema, ast, typeInfo) {
    (0, _classCallCheck3.default)(this, ValidationContext);

    this._schema = schema;
    this._ast = ast;
    this._typeInfo = typeInfo;
    this._errors = [];
    this._fragmentSpreads = new _map2.default();
    this._recursivelyReferencedFragments = new _map2.default();
    this._variableUsages = new _map2.default();
    this._recursiveVariableUsages = new _map2.default();
  }

  (0, _createClass3.default)(ValidationContext, [{
    key: 'reportError',
    value: function reportError(error) {
      this._errors.push(error);
    }
  }, {
    key: 'getErrors',
    value: function getErrors() {
      return this._errors;
    }
  }, {
    key: 'getSchema',
    value: function getSchema() {
      return this._schema;
    }
  }, {
    key: 'getDocument',
    value: function getDocument() {
      return this._ast;
    }
  }, {
    key: 'getFragment',
    value: function getFragment(name) {
      var fragments = this._fragments;
      if (!fragments) {
        this._fragments = fragments = this.getDocument().definitions.reduce(function (frags, statement) {
          if (statement.kind === Kind.FRAGMENT_DEFINITION) {
            frags[statement.name.value] = statement;
          }
          return frags;
        }, {});
      }
      return fragments[name];
    }
  }, {
    key: 'getFragmentSpreads',
    value: function getFragmentSpreads(node) {
      var spreads = this._fragmentSpreads.get(node);
      if (!spreads) {
        spreads = [];
        var setsToVisit = [node.selectionSet];
        while (setsToVisit.length !== 0) {
          var set = setsToVisit.pop();
          for (var i = 0; i < set.selections.length; i++) {
            var selection = set.selections[i];
            if (selection.kind === Kind.FRAGMENT_SPREAD) {
              spreads.push(selection);
            } else if (selection.selectionSet) {
              setsToVisit.push(selection.selectionSet);
            }
          }
        }
        this._fragmentSpreads.set(node, spreads);
      }
      return spreads;
    }
  }, {
    key: 'getRecursivelyReferencedFragments',
    value: function getRecursivelyReferencedFragments(operation) {
      var fragments = this._recursivelyReferencedFragments.get(operation);
      if (!fragments) {
        fragments = [];
        var collectedNames = (0, _create2.default)(null);
        var nodesToVisit = [operation];
        while (nodesToVisit.length !== 0) {
          var _node = nodesToVisit.pop();
          var spreads = this.getFragmentSpreads(_node);
          for (var i = 0; i < spreads.length; i++) {
            var fragName = spreads[i].name.value;
            if (collectedNames[fragName] !== true) {
              collectedNames[fragName] = true;
              var fragment = this.getFragment(fragName);
              if (fragment) {
                fragments.push(fragment);
                nodesToVisit.push(fragment);
              }
            }
          }
        }
        this._recursivelyReferencedFragments.set(operation, fragments);
      }
      return fragments;
    }
  }, {
    key: 'getVariableUsages',
    value: function getVariableUsages(node) {
      var _this = this;

      var usages = this._variableUsages.get(node);
      if (!usages) {
        (function () {
          var newUsages = [];
          var typeInfo = new _TypeInfo.TypeInfo(_this._schema);
          (0, _visitor.visit)(node, (0, _visitor.visitWithTypeInfo)(typeInfo, {
            VariableDefinition: function VariableDefinition() {
              return false;
            },
            Variable: function Variable(variable) {
              newUsages.push({ node: variable, type: typeInfo.getInputType() });
            }
          }));
          usages = newUsages;
          _this._variableUsages.set(node, usages);
        })();
      }
      return usages;
    }
  }, {
    key: 'getRecursiveVariableUsages',
    value: function getRecursiveVariableUsages(operation) {
      var usages = this._recursiveVariableUsages.get(operation);
      if (!usages) {
        usages = this.getVariableUsages(operation);
        var fragments = this.getRecursivelyReferencedFragments(operation);
        for (var i = 0; i < fragments.length; i++) {
          Array.prototype.push.apply(usages, this.getVariableUsages(fragments[i]));
        }
        this._recursiveVariableUsages.set(operation, usages);
      }
      return usages;
    }
  }, {
    key: 'getType',
    value: function getType() {
      return this._typeInfo.getType();
    }
  }, {
    key: 'getParentType',
    value: function getParentType() {
      return this._typeInfo.getParentType();
    }
  }, {
    key: 'getInputType',
    value: function getInputType() {
      return this._typeInfo.getInputType();
    }
  }, {
    key: 'getFieldDef',
    value: function getFieldDef() {
      return this._typeInfo.getFieldDef();
    }
  }, {
    key: 'getDirective',
    value: function getDirective() {
      return this._typeInfo.getDirective();
    }
  }, {
    key: 'getArgument',
    value: function getArgument() {
      return this._typeInfo.getArgument();
    }
  }]);
  return ValidationContext;
}();