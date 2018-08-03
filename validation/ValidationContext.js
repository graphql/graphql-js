"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ValidationContext = exports.ASTValidationContext = void 0;

var _visitor = require("../language/visitor");

var _kinds = require("../language/kinds");

var _TypeInfo = require("../utilities/TypeInfo");

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
var ASTValidationContext =
/*#__PURE__*/
function () {
  function ASTValidationContext(ast) {
    _defineProperty(this, "_ast", void 0);

    _defineProperty(this, "_errors", void 0);

    this._ast = ast;
    this._errors = [];
  }

  var _proto = ASTValidationContext.prototype;

  _proto.reportError = function reportError(error) {
    this._errors.push(error);
  };

  _proto.getErrors = function getErrors() {
    return this._errors;
  };

  _proto.getDocument = function getDocument() {
    return this._ast;
  };

  return ASTValidationContext;
}();

exports.ASTValidationContext = ASTValidationContext;

var ValidationContext =
/*#__PURE__*/
function (_ASTValidationContext) {
  _inheritsLoose(ValidationContext, _ASTValidationContext);

  function ValidationContext(schema, ast, typeInfo) {
    var _this;

    _this = _ASTValidationContext.call(this, ast) || this;

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_schema", void 0);

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_typeInfo", void 0);

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_fragments", void 0);

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_fragmentSpreads", void 0);

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_recursivelyReferencedFragments", void 0);

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_variableUsages", void 0);

    _defineProperty(_assertThisInitialized(_assertThisInitialized(_this)), "_recursiveVariableUsages", void 0);

    _this._schema = schema;
    _this._typeInfo = typeInfo;
    _this._fragmentSpreads = new Map();
    _this._recursivelyReferencedFragments = new Map();
    _this._variableUsages = new Map();
    _this._recursiveVariableUsages = new Map();
    return _this;
  }

  var _proto2 = ValidationContext.prototype;

  _proto2.getSchema = function getSchema() {
    return this._schema;
  };

  _proto2.getFragment = function getFragment(name) {
    var fragments = this._fragments;

    if (!fragments) {
      this._fragments = fragments = this.getDocument().definitions.reduce(function (frags, statement) {
        if (statement.kind === _kinds.Kind.FRAGMENT_DEFINITION) {
          frags[statement.name.value] = statement;
        }

        return frags;
      }, Object.create(null));
    }

    return fragments[name];
  };

  _proto2.getFragmentSpreads = function getFragmentSpreads(node) {
    var spreads = this._fragmentSpreads.get(node);

    if (!spreads) {
      spreads = [];
      var setsToVisit = [node];

      while (setsToVisit.length !== 0) {
        var set = setsToVisit.pop();

        for (var i = 0; i < set.selections.length; i++) {
          var selection = set.selections[i];

          if (selection.kind === _kinds.Kind.FRAGMENT_SPREAD) {
            spreads.push(selection);
          } else if (selection.selectionSet) {
            setsToVisit.push(selection.selectionSet);
          }
        }
      }

      this._fragmentSpreads.set(node, spreads);
    }

    return spreads;
  };

  _proto2.getRecursivelyReferencedFragments = function getRecursivelyReferencedFragments(operation) {
    var fragments = this._recursivelyReferencedFragments.get(operation);

    if (!fragments) {
      fragments = [];
      var collectedNames = Object.create(null);
      var nodesToVisit = [operation.selectionSet];

      while (nodesToVisit.length !== 0) {
        var node = nodesToVisit.pop();
        var spreads = this.getFragmentSpreads(node);

        for (var i = 0; i < spreads.length; i++) {
          var fragName = spreads[i].name.value;

          if (collectedNames[fragName] !== true) {
            collectedNames[fragName] = true;
            var fragment = this.getFragment(fragName);

            if (fragment) {
              fragments.push(fragment);
              nodesToVisit.push(fragment.selectionSet);
            }
          }
        }
      }

      this._recursivelyReferencedFragments.set(operation, fragments);
    }

    return fragments;
  };

  _proto2.getVariableUsages = function getVariableUsages(node) {
    var usages = this._variableUsages.get(node);

    if (!usages) {
      var newUsages = [];
      var typeInfo = new _TypeInfo.TypeInfo(this._schema);
      (0, _visitor.visit)(node, (0, _visitor.visitWithTypeInfo)(typeInfo, {
        VariableDefinition: function VariableDefinition() {
          return false;
        },
        Variable: function Variable(variable) {
          newUsages.push({
            node: variable,
            type: typeInfo.getInputType(),
            defaultValue: typeInfo.getDefaultValue()
          });
        }
      }));
      usages = newUsages;

      this._variableUsages.set(node, usages);
    }

    return usages;
  };

  _proto2.getRecursiveVariableUsages = function getRecursiveVariableUsages(operation) {
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
  };

  _proto2.getType = function getType() {
    return this._typeInfo.getType();
  };

  _proto2.getParentType = function getParentType() {
    return this._typeInfo.getParentType();
  };

  _proto2.getInputType = function getInputType() {
    return this._typeInfo.getInputType();
  };

  _proto2.getParentInputType = function getParentInputType() {
    return this._typeInfo.getParentInputType();
  };

  _proto2.getFieldDef = function getFieldDef() {
    return this._typeInfo.getFieldDef();
  };

  _proto2.getDirective = function getDirective() {
    return this._typeInfo.getDirective();
  };

  _proto2.getArgument = function getArgument() {
    return this._typeInfo.getArgument();
  };

  return ValidationContext;
}(ASTValidationContext);

exports.ValidationContext = ValidationContext;