'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

exports.isValidLiteralValue = isValidLiteralValue;

var _printer = require('../language/printer');

var _kinds = require('../language/kinds');

var _definition = require('../type/definition');

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Utility for validators which determines if a value literal AST is valid given
 * an input type.
 *
 * Note that this only validates literal values, variables are assumed to
 * provide values of the correct type.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function isValidLiteralValue(type, valueAST) {
  // A value must be provided if the type is non-null.
  if (type instanceof _definition.GraphQLNonNull) {
    if (!valueAST) {
      if (type.ofType.name) {
        return ['Expected "' + type.ofType.name + '!", found null.'];
      }
      return ['Expected non-null value, found null.'];
    }
    return isValidLiteralValue(type.ofType, valueAST);
  }

  if (!valueAST) {
    return [];
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueAST.kind === _kinds.VARIABLE) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof _definition.GraphQLList) {
    var _ret = function () {
      var itemType = type.ofType;
      if (valueAST.kind === _kinds.LIST) {
        return {
          v: valueAST.values.reduce(function (acc, itemAST, index) {
            var errors = isValidLiteralValue(itemType, itemAST);
            return acc.concat(errors.map(function (error) {
              return 'In element #' + index + ': ' + error;
            }));
          }, [])
        };
      }
      return {
        v: isValidLiteralValue(itemType, valueAST)
      };
    }();

    if ((typeof _ret === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret)) === "object") return _ret.v;
  }

  // Input objects check each defined field and look for undefined fields.
  if (type instanceof _definition.GraphQLInputObjectType) {
    if (valueAST.kind !== _kinds.OBJECT) {
      return ['Expected "' + type.name + '", found not an object.'];
    }
    var fields = type.getFields();

    var errors = [];

    // Ensure every provided field is defined.
    var fieldASTs = valueAST.fields;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(fieldASTs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var providedFieldAST = _step.value;

        if (!fields[providedFieldAST.name.value]) {
          errors.push('In field "' + providedFieldAST.name.value + '": Unknown field.');
        }
      }

      // Ensure every defined field is valid.
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    var fieldASTMap = (0, _keyMap2.default)(fieldASTs, function (fieldAST) {
      return fieldAST.name.value;
    });
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      var _loop = function _loop() {
        var fieldName = _step2.value;

        var result = isValidLiteralValue(fields[fieldName].type, fieldASTMap[fieldName] && fieldASTMap[fieldName].value);
        errors.push.apply(errors, (0, _toConsumableArray3.default)(result.map(function (error) {
          return 'In field "' + fieldName + '": ' + error;
        })));
      };

      for (var _iterator2 = (0, _getIterator3.default)((0, _keys2.default)(fields)), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        _loop();
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return errors;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must be input type');

  // Scalar/Enum input checks to ensure the type can parse the value to
  // a non-null value.
  var parseResult = type.parseLiteral(valueAST);
  if ((0, _isNullish2.default)(parseResult)) {
    return ['Expected type "' + type.name + '", found ' + (0, _printer.print)(valueAST) + '.'];
  }

  return [];
}