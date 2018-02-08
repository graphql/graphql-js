'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /**
                                                                                                                                                                                                                                                                               * Copyright (c) 2015-present, Facebook, Inc.
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               * This source code is licensed under the MIT license found in the
                                                                                                                                                                                                                                                                               * LICENSE file in the root directory of this source tree.
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               *  strict
                                                                                                                                                                                                                                                                               */

exports.coerceValue = coerceValue;

var _iterall = require('iterall');

var _isInvalid = require('../jsutils/isInvalid');

var _isInvalid2 = _interopRequireDefault(_isInvalid);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _orList = require('../jsutils/orList');

var _orList2 = _interopRequireDefault(_orList);

var _suggestionList = require('../jsutils/suggestionList');

var _suggestionList2 = _interopRequireDefault(_suggestionList);

var _error = require('../error');

var _definition = require('../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Coerces a JavaScript value given a GraphQL Type.
 *
 * Returns either a value which is valid for the provided type or a list of
 * encountered coercion errors.
 *
 */
function coerceValue(value, type, blameNode, path) {
  // A value must be provided if the type is non-null.
  if ((0, _definition.isNonNullType)(type)) {
    if ((0, _isNullish2.default)(value)) {
      return ofErrors([coercionError('Expected non-nullable type ' + String(type) + ' not to be null', blameNode, path)]);
    }
    return coerceValue(value, type.ofType, blameNode, path);
  }

  if ((0, _isNullish2.default)(value)) {
    // Explicitly return the value null.
    return ofValue(null);
  }

  if ((0, _definition.isScalarType)(type)) {
    // Scalars determine if a value is valid via parseValue(), which can
    // throw to indicate failure. If it throws, maintain a reference to
    // the original error.
    try {
      var parseResult = type.parseValue(value);
      if ((0, _isInvalid2.default)(parseResult)) {
        return ofErrors([coercionError('Expected type ' + type.name, blameNode, path)]);
      }
      return ofValue(parseResult);
    } catch (error) {
      return ofErrors([coercionError('Expected type ' + type.name, blameNode, path, error.message, error)]);
    }
  }

  if ((0, _definition.isEnumType)(type)) {
    if (typeof value === 'string') {
      var enumValue = type.getValue(value);
      if (enumValue) {
        return ofValue(enumValue.value);
      }
    }
    var suggestions = (0, _suggestionList2.default)(String(value), type.getValues().map(function (enumValue) {
      return enumValue.name;
    }));
    var didYouMean = suggestions.length !== 0 ? 'did you mean ' + (0, _orList2.default)(suggestions) + '?' : undefined;
    return ofErrors([coercionError('Expected type ' + type.name, blameNode, path, didYouMean)]);
  }

  if ((0, _definition.isListType)(type)) {
    var itemType = type.ofType;
    if ((0, _iterall.isCollection)(value)) {
      var _errors = void 0;
      var coercedValue = [];
      (0, _iterall.forEach)(value, function (itemValue, index) {
        var coercedItem = coerceValue(itemValue, itemType, blameNode, atPath(path, index));
        if (coercedItem.errors) {
          _errors = add(_errors, coercedItem.errors);
        } else if (!_errors) {
          coercedValue.push(coercedItem.value);
        }
      });
      return _errors ? ofErrors(_errors) : ofValue(coercedValue);
    }
    // Lists accept a non-list value as a list of one.
    var coercedItem = coerceValue(value, itemType, blameNode);
    return coercedItem.errors ? coercedItem : ofValue([coercedItem.value]);
  }

  if ((0, _definition.isInputObjectType)(type)) {
    if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== 'object') {
      return ofErrors([coercionError('Expected type ' + type.name + ' to be an object', blameNode, path)]);
    }
    var _errors2 = void 0;
    var _coercedValue = {};
    var fields = type.getFields();

    // Ensure every defined field is valid.
    for (var fieldName in fields) {
      if (hasOwnProperty.call(fields, fieldName)) {
        var field = fields[fieldName];
        var fieldValue = value[fieldName];
        if ((0, _isInvalid2.default)(fieldValue)) {
          if (!(0, _isInvalid2.default)(field.defaultValue)) {
            _coercedValue[fieldName] = field.defaultValue;
          } else if ((0, _definition.isNonNullType)(field.type)) {
            _errors2 = add(_errors2, coercionError('Field ' + printPath(atPath(path, fieldName)) + ' of required ' + ('type ' + String(field.type) + ' was not provided'), blameNode));
          }
        } else {
          var coercedField = coerceValue(fieldValue, field.type, blameNode, atPath(path, fieldName));
          if (coercedField.errors) {
            _errors2 = add(_errors2, coercedField.errors);
          } else if (!_errors2) {
            _coercedValue[fieldName] = coercedField.value;
          }
        }
      }
    }

    // Ensure every provided field is defined.
    for (var _fieldName in value) {
      if (hasOwnProperty.call(value, _fieldName)) {
        if (!fields[_fieldName]) {
          var _suggestions = (0, _suggestionList2.default)(_fieldName, Object.keys(fields));
          var _didYouMean = _suggestions.length !== 0 ? 'did you mean ' + (0, _orList2.default)(_suggestions) + '?' : undefined;
          _errors2 = add(_errors2, coercionError('Field "' + _fieldName + '" is not defined by type ' + type.name, blameNode, path, _didYouMean));
        }
      }
    }

    return _errors2 ? ofErrors(_errors2) : ofValue(_coercedValue);
  }

  /* istanbul ignore next */
  throw new Error('Unexpected type: ' + type + '.');
}

function ofValue(value) {
  return { errors: undefined, value: value };
}

function ofErrors(errors) {
  return { errors: errors, value: undefined };
}

function add(errors, moreErrors) {
  return (errors || []).concat(moreErrors);
}

function atPath(prev, key) {
  return { prev: prev, key: key };
}

function coercionError(message, blameNode, path, subMessage, originalError) {
  var pathStr = printPath(path);
  // Return a GraphQLError instance
  return new _error.GraphQLError(message + (pathStr ? ' at ' + pathStr : '') + (subMessage ? '; ' + subMessage : '.'), blameNode, undefined, undefined, undefined, originalError);
}

// Build a string describing the path into the value where the error was found
function printPath(path) {
  var pathStr = '';
  var currentPath = path;
  while (currentPath) {
    pathStr = (typeof currentPath.key === 'string' ? '.' + currentPath.key : '[' + String(currentPath.key) + ']') + pathStr;
    currentPath = currentPath.prev;
  }
  return pathStr ? 'value' + pathStr : '';
}

var hasOwnProperty = Object.prototype.hasOwnProperty;