'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unknownDirectiveMessage = unknownDirectiveMessage;
exports.misplacedDirectiveMessage = misplacedDirectiveMessage;
exports.KnownDirectives = KnownDirectives;

var _error = require('../../error');

var _find = require('../../jsutils/find');

var _find2 = _interopRequireDefault(_find);

var _kinds = require('../../language/kinds');

var Kind = _interopRequireWildcard(_kinds);

var _directiveLocation = require('../../language/directiveLocation');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function unknownDirectiveMessage(directiveName) {
  return 'Unknown directive "' + directiveName + '".';
} /**
   * Copyright (c) 2015-present, Facebook, Inc.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   * 
   */

function misplacedDirectiveMessage(directiveName, location) {
  return 'Directive "' + directiveName + '" may not be used on ' + location + '.';
}

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 */
function KnownDirectives(context) {
  return {
    Directive: function Directive(node, key, parent, path, ancestors) {
      var directiveDef = (0, _find2.default)(context.getSchema().getDirectives(), function (def) {
        return def.name === node.name.value;
      });
      if (!directiveDef) {
        context.reportError(new _error.GraphQLError(unknownDirectiveMessage(node.name.value), [node]));
        return;
      }
      var candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (candidateLocation && directiveDef.locations.indexOf(candidateLocation) === -1) {
        context.reportError(new _error.GraphQLError(misplacedDirectiveMessage(node.name.value, candidateLocation), [node]));
      }
    }
  };
}

function getDirectiveLocationForASTPath(ancestors) {
  var appliedTo = ancestors[ancestors.length - 1];
  if (!Array.isArray(appliedTo)) {
    switch (appliedTo.kind) {
      case Kind.OPERATION_DEFINITION:
        switch (appliedTo.operation) {
          case 'query':
            return _directiveLocation.DirectiveLocation.QUERY;
          case 'mutation':
            return _directiveLocation.DirectiveLocation.MUTATION;
          case 'subscription':
            return _directiveLocation.DirectiveLocation.SUBSCRIPTION;
        }
        break;
      case Kind.FIELD:
        return _directiveLocation.DirectiveLocation.FIELD;
      case Kind.FRAGMENT_SPREAD:
        return _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD;
      case Kind.INLINE_FRAGMENT:
        return _directiveLocation.DirectiveLocation.INLINE_FRAGMENT;
      case Kind.FRAGMENT_DEFINITION:
        return _directiveLocation.DirectiveLocation.FRAGMENT_DEFINITION;
      case Kind.SCHEMA_DEFINITION:
        return _directiveLocation.DirectiveLocation.SCHEMA;
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
        return _directiveLocation.DirectiveLocation.SCALAR;
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
        return _directiveLocation.DirectiveLocation.OBJECT;
      case Kind.FIELD_DEFINITION:
        return _directiveLocation.DirectiveLocation.FIELD_DEFINITION;
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION:
        return _directiveLocation.DirectiveLocation.INTERFACE;
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
        return _directiveLocation.DirectiveLocation.UNION;
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
        return _directiveLocation.DirectiveLocation.ENUM;
      case Kind.ENUM_VALUE_DEFINITION:
        return _directiveLocation.DirectiveLocation.ENUM_VALUE;
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        return _directiveLocation.DirectiveLocation.INPUT_OBJECT;
      case Kind.INPUT_VALUE_DEFINITION:
        var parentNode = ancestors[ancestors.length - 3];
        return parentNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? _directiveLocation.DirectiveLocation.INPUT_FIELD_DEFINITION : _directiveLocation.DirectiveLocation.ARGUMENT_DEFINITION;
    }
  }
}