"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unknownTypeMessage = unknownTypeMessage;
exports.KnownTypeNames = KnownTypeNames;

var _GraphQLError = require("../../error/GraphQLError");

var _suggestionList = _interopRequireDefault(require("../../jsutils/suggestionList"));

var _quotedOrList = _interopRequireDefault(require("../../jsutils/quotedOrList"));

var _predicates = require("../../language/predicates");

var _scalars = require("../../type/scalars");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
function unknownTypeMessage(typeName, suggestedTypes) {
  var message = "Unknown type \"".concat(typeName, "\".");

  if (suggestedTypes.length) {
    message += " Did you mean ".concat((0, _quotedOrList.default)(suggestedTypes), "?");
  }

  return message;
}
/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 */


function KnownTypeNames(context) {
  var schema = context.getSchema();
  var existingTypesMap = schema ? schema.getTypeMap() : Object.create(null);
  var definedTypes = Object.create(null);
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = context.getDocument().definitions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var def = _step.value;

      if ((0, _predicates.isTypeDefinitionNode)(def)) {
        definedTypes[def.name.value] = true;
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return != null) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  var typeNames = Object.keys(existingTypesMap).concat(Object.keys(definedTypes));
  return {
    NamedType: function NamedType(node, _1, parent, _2, ancestors) {
      var typeName = node.name.value;

      if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
        var definitionNode = ancestors[2] || parent;
        var isSDL = isSDLNode(definitionNode);

        if (isSDL && isSpecifiedScalarName(typeName)) {
          return;
        }

        var suggestedTypes = (0, _suggestionList.default)(typeName, isSDL ? specifiedScalarsNames.concat(typeNames) : typeNames);
        context.reportError(new _GraphQLError.GraphQLError(unknownTypeMessage(typeName, suggestedTypes), node));
      }
    }
  };
}

var specifiedScalarsNames = _scalars.specifiedScalarTypes.map(function (type) {
  return type.name;
});

function isSpecifiedScalarName(typeName) {
  return specifiedScalarsNames.indexOf(typeName) !== -1;
}

function isSDLNode(value) {
  return Boolean(value && !Array.isArray(value) && ((0, _predicates.isTypeSystemDefinitionNode)(value) || (0, _predicates.isTypeSystemExtensionNode)(value)));
}