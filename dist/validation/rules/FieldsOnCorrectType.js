'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

exports.undefinedFieldMessage = undefinedFieldMessage;
exports.FieldsOnCorrectType = FieldsOnCorrectType;

var _error = require('../../error');

var _definition = require('../../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function undefinedFieldMessage(fieldName, type, suggestedTypes) {
  var message = 'Cannot query field "' + fieldName + '" on type "' + type + '".';
  var MAX_LENGTH = 5;
  if (suggestedTypes.length !== 0) {
    var suggestions = suggestedTypes.slice(0, MAX_LENGTH).map(function (t) {
      return '"' + t + '"';
    }).join(', ');
    if (suggestedTypes.length > MAX_LENGTH) {
      suggestions += ', and ' + (suggestedTypes.length - MAX_LENGTH) + ' other types';
    }
    message += ' However, this field exists on ' + suggestions + '.';
    message += ' Perhaps you meant to use an inline fragment?';
  }
  return message;
}

/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typenamme
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function FieldsOnCorrectType(context) {
  return {
    Field: function Field(node) {
      var type = context.getParentType();
      if (type) {
        var fieldDef = context.getFieldDef();
        if (!fieldDef) {
          // This isn't valid. Let's find suggestions, if any.
          var suggestedTypes = [];
          if ((0, _definition.isAbstractType)(type)) {
            var schema = context.getSchema();
            suggestedTypes = getSiblingInterfacesIncludingField(schema, type, node.name.value);
            suggestedTypes = suggestedTypes.concat(getImplementationsIncludingField(schema, type, node.name.value));
          }
          context.reportError(new _error.GraphQLError(undefinedFieldMessage(node.name.value, type.name, suggestedTypes), [node]));
        }
      }
    }
  };
}

/**
 * Return implementations of `type` that include `fieldName` as a valid field.
 */
function getImplementationsIncludingField(schema, type, fieldName) {
  return schema.getPossibleTypes(type).filter(function (t) {
    return t.getFields()[fieldName] !== undefined;
  }).map(function (t) {
    return t.name;
  }).sort();
}

/**
 * Go through all of the implementations of type, and find other interaces
 * that they implement. If those interfaces include `field` as a valid field,
 * return them, sorted by how often the implementations include the other
 * interface.
 */
function getSiblingInterfacesIncludingField(schema, type, fieldName) {
  var suggestedInterfaces = schema.getPossibleTypes(type).reduce(function (acc, t) {
    t.getInterfaces().forEach(function (i) {
      if (i.getFields()[fieldName] === undefined) {
        return;
      }
      if (acc[i.name] === undefined) {
        acc[i.name] = 0;
      }
      acc[i.name] += 1;
    });
    return acc;
  }, {});
  return (0, _keys2.default)(suggestedInterfaces).sort(function (a, b) {
    return suggestedInterfaces[b] - suggestedInterfaces[a];
  });
}