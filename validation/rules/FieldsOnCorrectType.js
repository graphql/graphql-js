'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.undefinedFieldMessage = undefinedFieldMessage;
exports.FieldsOnCorrectType = FieldsOnCorrectType;

var _error = require('../../error');

var _suggestionList = require('../../jsutils/suggestionList');

var _suggestionList2 = _interopRequireDefault(_suggestionList);

var _quotedOrList = require('../../jsutils/quotedOrList');

var _quotedOrList2 = _interopRequireDefault(_quotedOrList);

var _definition = require('../../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function undefinedFieldMessage(fieldName, type, suggestedTypeNames, suggestedFieldNames) {
  var message = 'Cannot query field "' + fieldName + '" on type "' + type + '".';
  if (suggestedTypeNames.length !== 0) {
    var suggestions = (0, _quotedOrList2.default)(suggestedTypeNames);
    message += ' Did you mean to use an inline fragment on ' + suggestions + '?';
  } else if (suggestedFieldNames.length !== 0) {
    message += ' Did you mean ' + (0, _quotedOrList2.default)(suggestedFieldNames) + '?';
  }
  return message;
}

/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typename.
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
          // This field doesn't exist, lets look for suggestions.
          var schema = context.getSchema();
          var fieldName = node.name.value;
          // First determine if there are any suggested types to condition on.
          var suggestedTypeNames = getSuggestedTypeNames(schema, type, fieldName);
          // If there are no suggested types, then perhaps this was a typo?
          var suggestedFieldNames = suggestedTypeNames.length !== 0 ? [] : getSuggestedFieldNames(schema, type, fieldName);

          // Report an error, including helpful suggestions.
          context.reportError(new _error.GraphQLError(undefinedFieldMessage(fieldName, type.name, suggestedTypeNames, suggestedFieldNames), [node]));
        }
      }
    }
  };
}

/**
 * Go through all of the implementations of type, as well as the interfaces
 * that they implement. If any of those types include the provided field,
 * suggest them, sorted by how often the type is referenced,  starting
 * with Interfaces.
 */
function getSuggestedTypeNames(schema, type, fieldName) {
  if (type instanceof _definition.GraphQLInterfaceType || type instanceof _definition.GraphQLUnionType) {
    var _ret = function () {
      var suggestedObjectTypes = [];
      var interfaceUsageCount = Object.create(null);
      schema.getPossibleTypes(type).forEach(function (possibleType) {
        if (!possibleType.getFields()[fieldName]) {
          return;
        }
        // This object type defines this field.
        suggestedObjectTypes.push(possibleType.name);
        possibleType.getInterfaces().forEach(function (possibleInterface) {
          if (!possibleInterface.getFields()[fieldName]) {
            return;
          }
          // This interface type defines this field.
          interfaceUsageCount[possibleInterface.name] = (interfaceUsageCount[possibleInterface.name] || 0) + 1;
        });
      });

      // Suggest interface types based on how common they are.
      var suggestedInterfaceTypes = Object.keys(interfaceUsageCount).sort(function (a, b) {
        return interfaceUsageCount[b] - interfaceUsageCount[a];
      });

      // Suggest both interface and object types.
      return {
        v: suggestedInterfaceTypes.concat(suggestedObjectTypes)
      };
    }();

    if (typeof _ret === "object") return _ret.v;
  }

  // Otherwise, must be an Object type, which does not have possible fields.
  return [];
}

/**
 * For the field name provided, determine if there are any similar field names
 * that may be the result of a typo.
 */
function getSuggestedFieldNames(schema, type, fieldName) {
  if (type instanceof _definition.GraphQLObjectType || type instanceof _definition.GraphQLInterfaceType) {
    var possibleFieldNames = Object.keys(type.getFields());
    return (0, _suggestionList2.default)(fieldName, possibleFieldNames);
  }
  // Otherwise, must be a Union type, which does not define fields.
  return [];
}