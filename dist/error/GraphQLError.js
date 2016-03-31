'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GraphQLError = undefined;

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _language = require('../language');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var GraphQLError = exports.GraphQLError = function (_Error) {
  (0, _inherits3.default)(GraphQLError, _Error);

  function GraphQLError(message,
  // A flow bug keeps us from declaring nodes as an array of Node
  nodes, /* Node */stack, source, positions) {
    (0, _classCallCheck3.default)(this, GraphQLError);

    var _this = (0, _possibleConstructorReturn3.default)(this, (0, _getPrototypeOf2.default)(GraphQLError).call(this, message));

    _this.message = message;

    Object.defineProperty(_this, 'stack', { value: stack || message });
    Object.defineProperty(_this, 'nodes', { value: nodes });

    // Note: flow does not yet know about Object.defineProperty with `get`.
    Object.defineProperty(_this, 'source', {
      get: function get() {
        if (source) {
          return source;
        }
        if (nodes && nodes.length > 0) {
          var node = nodes[0];
          return node && node.loc && node.loc.source;
        }
      }
    });

    Object.defineProperty(_this, 'positions', {
      get: function get() {
        if (positions) {
          return positions;
        }
        if (nodes) {
          var nodePositions = nodes.map(function (node) {
            return node.loc && node.loc.start;
          });
          if (nodePositions.some(function (p) {
            return p;
          })) {
            return nodePositions;
          }
        }
      }
    });

    Object.defineProperty(_this, 'locations', {
      get: function get() {
        var _this2 = this;

        if (this.positions && this.source) {
          return this.positions.map(function (pos) {
            return (0, _language.getLocation)(_this2.source, pos);
          });
        }
      }
    });
    return _this;
  }

  return GraphQLError;
}(Error);
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */