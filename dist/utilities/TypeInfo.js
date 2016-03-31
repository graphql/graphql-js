'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TypeInfo = undefined;

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _kinds = require('../language/kinds');

var Kind = _interopRequireWildcard(_kinds);

var _definition = require('../type/definition');

var _introspection = require('../type/introspection');

var _typeFromAST = require('./typeFromAST');

var _find = require('../jsutils/find');

var _find2 = _interopRequireDefault(_find);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */

var TypeInfo = exports.TypeInfo = function () {
  function TypeInfo(schema,
  // NOTE: this experimental optional second parameter is only needed in order
  // to support non-spec-compliant codebases. You should never need to use it.
  getFieldDefFn) {
    (0, _classCallCheck3.default)(this, TypeInfo);

    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._directive = null;
    this._argument = null;
    this._getFieldDef = getFieldDefFn || getFieldDef;
  }

  (0, _createClass3.default)(TypeInfo, [{
    key: 'getType',
    value: function getType() {
      if (this._typeStack.length > 0) {
        return this._typeStack[this._typeStack.length - 1];
      }
    }
  }, {
    key: 'getParentType',
    value: function getParentType() {
      if (this._parentTypeStack.length > 0) {
        return this._parentTypeStack[this._parentTypeStack.length - 1];
      }
    }
  }, {
    key: 'getInputType',
    value: function getInputType() {
      if (this._inputTypeStack.length > 0) {
        return this._inputTypeStack[this._inputTypeStack.length - 1];
      }
    }
  }, {
    key: 'getFieldDef',
    value: function getFieldDef() {
      if (this._fieldDefStack.length > 0) {
        return this._fieldDefStack[this._fieldDefStack.length - 1];
      }
    }
  }, {
    key: 'getDirective',
    value: function getDirective() {
      return this._directive;
    }
  }, {
    key: 'getArgument',
    value: function getArgument() {
      return this._argument;
    }

    // Flow does not yet handle this case.

  }, {
    key: 'enter',
    value: function enter(node /* Node */) {
      var schema = this._schema;
      switch (node.kind) {
        case Kind.SELECTION_SET:
          var namedType = (0, _definition.getNamedType)(this.getType());
          var compositeType = void 0;
          if ((0, _definition.isCompositeType)(namedType)) {
            // isCompositeType is a type refining predicate, so this is safe.
            compositeType = namedType;
          }
          this._parentTypeStack.push(compositeType);
          break;
        case Kind.FIELD:
          var parentType = this.getParentType();
          var fieldDef = void 0;
          if (parentType) {
            fieldDef = this._getFieldDef(schema, parentType, node);
          }
          this._fieldDefStack.push(fieldDef);
          this._typeStack.push(fieldDef && fieldDef.type);
          break;
        case Kind.DIRECTIVE:
          this._directive = schema.getDirective(node.name.value);
          break;
        case Kind.OPERATION_DEFINITION:
          var type = void 0;
          if (node.operation === 'query') {
            type = schema.getQueryType();
          } else if (node.operation === 'mutation') {
            type = schema.getMutationType();
          } else if (node.operation === 'subscription') {
            type = schema.getSubscriptionType();
          }
          this._typeStack.push(type);
          break;
        case Kind.INLINE_FRAGMENT:
        case Kind.FRAGMENT_DEFINITION:
          var typeConditionAST = node.typeCondition;
          var outputType = typeConditionAST ? (0, _typeFromAST.typeFromAST)(schema, typeConditionAST) : this.getType();
          this._typeStack.push(outputType);
          break;
        case Kind.VARIABLE_DEFINITION:
          var inputType = (0, _typeFromAST.typeFromAST)(schema, node.type);
          this._inputTypeStack.push(inputType);
          break;
        case Kind.ARGUMENT:
          var argDef = void 0;
          var argType = void 0;
          var fieldOrDirective = this.getDirective() || this.getFieldDef();
          if (fieldOrDirective) {
            argDef = (0, _find2.default)(fieldOrDirective.args, function (arg) {
              return arg.name === node.name.value;
            });
            if (argDef) {
              argType = argDef.type;
            }
          }
          this._argument = argDef;
          this._inputTypeStack.push(argType);
          break;
        case Kind.LIST:
          var listType = (0, _definition.getNullableType)(this.getInputType());
          this._inputTypeStack.push(listType instanceof _definition.GraphQLList ? listType.ofType : undefined);
          break;
        case Kind.OBJECT_FIELD:
          var objectType = (0, _definition.getNamedType)(this.getInputType());
          var fieldType = void 0;
          if (objectType instanceof _definition.GraphQLInputObjectType) {
            var inputField = objectType.getFields()[node.name.value];
            fieldType = inputField ? inputField.type : undefined;
          }
          this._inputTypeStack.push(fieldType);
          break;
      }
    }
  }, {
    key: 'leave',
    value: function leave(node) {
      switch (node.kind) {
        case Kind.SELECTION_SET:
          this._parentTypeStack.pop();
          break;
        case Kind.FIELD:
          this._fieldDefStack.pop();
          this._typeStack.pop();
          break;
        case Kind.DIRECTIVE:
          this._directive = null;
          break;
        case Kind.OPERATION_DEFINITION:
        case Kind.INLINE_FRAGMENT:
        case Kind.FRAGMENT_DEFINITION:
          this._typeStack.pop();
          break;
        case Kind.VARIABLE_DEFINITION:
          this._inputTypeStack.pop();
          break;
        case Kind.ARGUMENT:
          this._argument = null;
          this._inputTypeStack.pop();
          break;
        case Kind.LIST:
        case Kind.OBJECT_FIELD:
          this._inputTypeStack.pop();
          break;
      }
    }
  }]);
  return TypeInfo;
}();

/**
 * Not exactly the same as the executor's definition of getFieldDef, in this
 * statically evaluated environment we do not always have an Object type,
 * and need to handle Interface and Union types.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function getFieldDef(schema, parentType, fieldAST) {
  var name = fieldAST.name.value;
  if (name === _introspection.SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
    return _introspection.SchemaMetaFieldDef;
  }
  if (name === _introspection.TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
    return _introspection.TypeMetaFieldDef;
  }
  if (name === _introspection.TypeNameMetaFieldDef.name && (parentType instanceof _definition.GraphQLObjectType || parentType instanceof _definition.GraphQLInterfaceType || parentType instanceof _definition.GraphQLUnionType)) {
    return _introspection.TypeNameMetaFieldDef;
  }
  if (parentType instanceof _definition.GraphQLObjectType || parentType instanceof _definition.GraphQLInterfaceType) {
    return parentType.getFields()[name];
  }
}