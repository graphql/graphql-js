'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GraphQLSkipDirective = exports.GraphQLIncludeDirective = exports.GraphQLDirective = exports.DirectiveLocation = undefined;

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _definition = require('./definition');

var _scalars = require('./scalars');

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _assertValidName = require('../utilities/assertValidName');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var DirectiveLocation = exports.DirectiveLocation = {
  QUERY: 'QUERY',
  MUTATION: 'MUTATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  FIELD: 'FIELD',
  FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION',
  FRAGMENT_SPREAD: 'FRAGMENT_SPREAD',
  INLINE_FRAGMENT: 'INLINE_FRAGMENT'
};

// eslint-disable-line

/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */

var GraphQLDirective = exports.GraphQLDirective = function GraphQLDirective(config) {
  (0, _classCallCheck3.default)(this, GraphQLDirective);

  (0, _invariant2.default)(config.name, 'Directive must be named.');
  (0, _assertValidName.assertValidName)(config.name);
  (0, _invariant2.default)(Array.isArray(config.locations), 'Must provide locations for directive.');
  this.name = config.name;
  this.description = config.description;
  this.locations = config.locations;

  var args = config.args;
  if (!args) {
    this.args = [];
  } else {
    (0, _invariant2.default)(!Array.isArray(args), '@' + config.name + ' args must be an object with argument names as keys.');
    this.args = (0, _keys2.default)(args).map(function (argName) {
      (0, _assertValidName.assertValidName)(argName);
      var arg = args[argName];
      (0, _invariant2.default)((0, _definition.isInputType)(arg.type), '@' + config.name + '(' + argName + ':) argument type must be ' + ('Input Type but got: ' + arg.type + '.'));
      return {
        name: argName,
        description: arg.description === undefined ? null : arg.description,
        type: arg.type,
        defaultValue: arg.defaultValue === undefined ? null : arg.defaultValue
      };
    });
  }
};

/**
 * Used to conditionally include fields or fragments
 */
var GraphQLIncludeDirective = exports.GraphQLIncludeDirective = new GraphQLDirective({
  name: 'include',
  description: 'Directs the executor to include this field or fragment only when ' + 'the `if` argument is true.',
  locations: [DirectiveLocation.FIELD, DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
  args: {
    if: {
      type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
      description: 'Included when true.'
    }
  }
});

/**
 * Used to conditionally skip (exclude) fields or fragments
 */
var GraphQLSkipDirective = exports.GraphQLSkipDirective = new GraphQLDirective({
  name: 'skip',
  description: 'Directs the executor to skip this field or fragment when the `if` ' + 'argument is true.',
  locations: [DirectiveLocation.FIELD, DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
  args: {
    if: {
      type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
      description: 'Skipped when true.'
    }
  }
});