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

var _directives = require('../../type/directives');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function unknownDirectiveMessage(directiveName) {
  return 'Unknown directive "' + directiveName + '".';
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
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
      var appliedTo = ancestors[ancestors.length - 1];
      var candidateLocation = getLocationForAppliedNode(appliedTo);
      if (!candidateLocation) {
        context.reportError(new _error.GraphQLError(misplacedDirectiveMessage(node.name.value, node.type), [node]));
      } else if (directiveDef.locations.indexOf(candidateLocation) === -1) {
        context.reportError(new _error.GraphQLError(misplacedDirectiveMessage(node.name.value, candidateLocation), [node]));
      }
    }
  };
}

function getLocationForAppliedNode(appliedTo) {
  switch (appliedTo.kind) {
    case _kinds.OPERATION_DEFINITION:
      switch (appliedTo.operation) {
        case 'query':
          return _directives.DirectiveLocation.QUERY;
        case 'mutation':
          return _directives.DirectiveLocation.MUTATION;
        case 'subscription':
          return _directives.DirectiveLocation.SUBSCRIPTION;
      }
      break;
    case _kinds.FIELD:
      return _directives.DirectiveLocation.FIELD;
    case _kinds.FRAGMENT_SPREAD:
      return _directives.DirectiveLocation.FRAGMENT_SPREAD;
    case _kinds.INLINE_FRAGMENT:
      return _directives.DirectiveLocation.INLINE_FRAGMENT;
    case _kinds.FRAGMENT_DEFINITION:
      return _directives.DirectiveLocation.FRAGMENT_DEFINITION;
  }
}