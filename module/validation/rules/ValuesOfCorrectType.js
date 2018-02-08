
import { GraphQLError } from '../../error'; /**
                                             * Copyright (c) 2015-present, Facebook, Inc.
                                             *
                                             * This source code is licensed under the MIT license found in the
                                             * LICENSE file in the root directory of this source tree.
                                             *
                                             *  strict
                                             */

import { print } from '../../language/printer';

import { isScalarType, isEnumType, isInputObjectType, isListType, isNonNullType, getNullableType, getNamedType } from '../../type/definition';

import isInvalid from '../../jsutils/isInvalid';
import keyMap from '../../jsutils/keyMap';
import orList from '../../jsutils/orList';
import suggestionList from '../../jsutils/suggestionList';

export function badValueMessage(typeName, valueName, message) {
  return 'Expected type ' + typeName + ', found ' + valueName + (message ? '; ' + message : '.');
}

export function requiredFieldMessage(typeName, fieldName, fieldTypeName) {
  return 'Field ' + typeName + '.' + fieldName + ' of required type ' + (fieldTypeName + ' was not provided.');
}

export function unknownFieldMessage(typeName, fieldName, message) {
  return 'Field "' + fieldName + '" is not defined by type ' + typeName + (message ? '; ' + message : '.');
}

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 */
export function ValuesOfCorrectType(context) {
  return {
    NullValue: function NullValue(node) {
      var type = context.getInputType();
      if (isNonNullType(type)) {
        context.reportError(new GraphQLError(badValueMessage(String(type), print(node)), node));
      }
    },
    ListValue: function ListValue(node) {
      // Note: TypeInfo will traverse into a list's item type, so look to the
      // parent input type to check if it is a list.
      var type = getNullableType(context.getParentInputType());
      if (!isListType(type)) {
        isValidScalar(context, node);
        return false; // Don't traverse further.
      }
    },
    ObjectValue: function ObjectValue(node) {
      var type = getNamedType(context.getInputType());
      if (!isInputObjectType(type)) {
        isValidScalar(context, node);
        return false; // Don't traverse further.
      }
      // Ensure every required field exists.
      var inputFields = type.getFields();
      var fieldNodeMap = keyMap(node.fields, function (field) {
        return field.name.value;
      });
      Object.keys(inputFields).forEach(function (fieldName) {
        var fieldType = inputFields[fieldName].type;
        var fieldNode = fieldNodeMap[fieldName];
        if (!fieldNode && isNonNullType(fieldType)) {
          context.reportError(new GraphQLError(requiredFieldMessage(type.name, fieldName, String(fieldType)), node));
        }
      });
    },
    ObjectField: function ObjectField(node) {
      var parentType = getNamedType(context.getParentInputType());
      var fieldType = context.getInputType();
      if (!fieldType && isInputObjectType(parentType)) {
        var suggestions = suggestionList(node.name.value, Object.keys(parentType.getFields()));
        var didYouMean = suggestions.length !== 0 ? 'Did you mean ' + orList(suggestions) + '?' : undefined;
        context.reportError(new GraphQLError(unknownFieldMessage(parentType.name, node.name.value, didYouMean), node));
      }
    },
    EnumValue: function EnumValue(node) {
      var type = getNamedType(context.getInputType());
      if (!isEnumType(type)) {
        isValidScalar(context, node);
      } else if (!type.getValue(node.value)) {
        context.reportError(new GraphQLError(badValueMessage(type.name, print(node), enumTypeSuggestion(type, node)), node));
      }
    },

    IntValue: function IntValue(node) {
      return isValidScalar(context, node);
    },
    FloatValue: function FloatValue(node) {
      return isValidScalar(context, node);
    },
    StringValue: function StringValue(node) {
      return isValidScalar(context, node);
    },
    BooleanValue: function BooleanValue(node) {
      return isValidScalar(context, node);
    }
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidScalar(context, node) {
  // Report any error at the full type expected by the location.
  var locationType = context.getInputType();
  if (!locationType) {
    return;
  }

  var type = getNamedType(locationType);

  if (!isScalarType(type)) {
    context.reportError(new GraphQLError(badValueMessage(String(locationType), print(node), enumTypeSuggestion(type, node)), node));
    return;
  }

  // Scalars determine if a literal value is valid via parseLiteral() which
  // may throw or return an invalid value to indicate failure.
  try {
    var parseResult = type.parseLiteral(node, undefined /* variables */);
    if (isInvalid(parseResult)) {
      context.reportError(new GraphQLError(badValueMessage(String(locationType), print(node)), node));
    }
  } catch (error) {
    // Ensure a reference to the original error is maintained.
    context.reportError(new GraphQLError(badValueMessage(String(locationType), print(node), error.message), node, undefined, undefined, undefined, error));
  }
}

function enumTypeSuggestion(type, node) {
  if (isEnumType(type)) {
    var suggestions = suggestionList(print(node), type.getValues().map(function (value) {
      return value.name;
    }));
    if (suggestions.length !== 0) {
      return 'Did you mean the enum value ' + orList(suggestions) + '?';
    }
  }
}