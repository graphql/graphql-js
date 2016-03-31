'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

exports.getVariableValues = getVariableValues;
exports.getArgumentValues = getArgumentValues;

var _error = require('../error');

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _typeFromAST = require('../utilities/typeFromAST');

var _valueFromAST = require('../utilities/valueFromAST');

var _isValidJSValue = require('../utilities/isValidJSValue');

var _printer = require('../language/printer');

var _definition = require('../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 */
function getVariableValues(schema, definitionASTs, inputs) {
  return definitionASTs.reduce(function (values, defAST) {
    var varName = defAST.variable.name.value;
    values[varName] = getVariableValue(schema, defAST, inputs[varName]);
    return values;
  }, {});
}

/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function getArgumentValues(argDefs, argASTs, variableValues) {
  if (!argDefs || !argASTs) {
    return {};
  }
  var argASTMap = (0, _keyMap2.default)(argASTs, function (arg) {
    return arg.name.value;
  });
  return argDefs.reduce(function (result, argDef) {
    var name = argDef.name;
    var valueAST = argASTMap[name] ? argASTMap[name].value : null;
    var value = (0, _valueFromAST.valueFromAST)(valueAST, argDef.type, variableValues);
    if ((0, _isNullish2.default)(value)) {
      value = argDef.defaultValue;
    }
    if (!(0, _isNullish2.default)(value)) {
      result[name] = value;
    }
    return result;
  }, {});
}

/**
 * Given a variable definition, and any value of input, return a value which
 * adheres to the variable definition, or throw an error.
 */
function getVariableValue(schema, definitionAST, input) {
  var type = (0, _typeFromAST.typeFromAST)(schema, definitionAST.type);
  var variable = definitionAST.variable;
  if (!type || !(0, _definition.isInputType)(type)) {
    throw new _error.GraphQLError('Variable "$' + variable.name.value + '" expected value of type ' + ('"' + (0, _printer.print)(definitionAST.type) + '" which cannot be used as an input type.'), [definitionAST]);
  }
  var inputType = type;
  var errors = (0, _isValidJSValue.isValidJSValue)(input, inputType);
  if (!errors.length) {
    if ((0, _isNullish2.default)(input)) {
      var defaultValue = definitionAST.defaultValue;
      if (defaultValue) {
        return (0, _valueFromAST.valueFromAST)(defaultValue, inputType);
      }
    }
    return coerceValue(inputType, input);
  }
  if ((0, _isNullish2.default)(input)) {
    throw new _error.GraphQLError('Variable "$' + variable.name.value + '" of required type ' + ('"' + (0, _printer.print)(definitionAST.type) + '" was not provided.'), [definitionAST]);
  }
  var message = errors ? '\n' + errors.join('\n') : '';
  throw new _error.GraphQLError('Variable "$' + variable.name.value + '" got invalid value ' + ((0, _stringify2.default)(input) + '.' + message), [definitionAST]);
}

/**
 * Given a type and any value, return a runtime value coerced to match the type.
 */
function coerceValue(type, value) {
  // Ensure flow knows that we treat function params as const.
  var _value = value;

  if (type instanceof _definition.GraphQLNonNull) {
    // Note: we're not checking that the result of coerceValue is non-null.
    // We only call this function after calling isValidJSValue.
    return coerceValue(type.ofType, _value);
  }

  if ((0, _isNullish2.default)(_value)) {
    return null;
  }

  if (type instanceof _definition.GraphQLList) {
    var _ret = function () {
      var itemType = type.ofType;
      // TODO: support iterable input
      if (Array.isArray(_value)) {
        return {
          v: _value.map(function (item) {
            return coerceValue(itemType, item);
          })
        };
      }
      return {
        v: [coerceValue(itemType, _value)]
      };
    }();

    if ((typeof _ret === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret)) === "object") return _ret.v;
  }

  if (type instanceof _definition.GraphQLInputObjectType) {
    var _ret2 = function () {
      if ((typeof _value === 'undefined' ? 'undefined' : (0, _typeof3.default)(_value)) !== 'object' || _value === null) {
        return {
          v: null
        };
      }
      var fields = type.getFields();
      return {
        v: (0, _keys2.default)(fields).reduce(function (obj, fieldName) {
          var field = fields[fieldName];
          var fieldValue = coerceValue(field.type, _value[fieldName]);
          if ((0, _isNullish2.default)(fieldValue)) {
            fieldValue = field.defaultValue;
          }
          if (!(0, _isNullish2.default)(fieldValue)) {
            obj[fieldName] = fieldValue;
          }
          return obj;
        }, {})
      };
    }();

    if ((typeof _ret2 === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret2)) === "object") return _ret2.v;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must be input type');

  var parsed = type.parseValue(_value);
  if (!(0, _isNullish2.default)(parsed)) {
    return parsed;
  }
}