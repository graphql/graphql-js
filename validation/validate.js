'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validate = validate;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _error = require('../error');

var _visitor = require('../language/visitor');

var _schema = require('../type/schema');

var _validate = require('../type/validate');

var _TypeInfo = require('../utilities/TypeInfo');

var _specifiedRules = require('./specifiedRules');

var _ValidationContext = require('./ValidationContext');

var _ValidationContext2 = _interopRequireDefault(_ValidationContext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Implements the "Validation" section of the spec.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 *
 * A list of specific validation rules may be provided. If not provided, the
 * default list of rules defined by the GraphQL specification will be used.
 *
 * Each validation rules is a function which returns a visitor
 * (see the language/visitor API). Visitor methods are expected to return
 * GraphQLErrors, or Arrays of GraphQLErrors when invalid.
 *
 * Optionally a custom TypeInfo instance may be provided. If not provided, one
 * will be created from the provided schema.
 */
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

function validate(schema, ast, rules, typeInfo) {
  !ast ? (0, _invariant2.default)(0, 'Must provide document') : void 0;
  // If the schema used for validation is invalid, throw an error.
  (0, _validate.assertValidSchema)(schema);
  return visitUsingRules(schema, typeInfo || new _TypeInfo.TypeInfo(schema), ast, rules || _specifiedRules.specifiedRules);
}

/**
 * This uses a specialized visitor which runs multiple visitors in parallel,
 * while maintaining the visitor skip and break API.
 *
 * @internal
 */
function visitUsingRules(schema, typeInfo, documentAST, rules) {
  var context = new _ValidationContext2.default(schema, documentAST, typeInfo);
  var visitors = rules.map(function (rule) {
    return rule(context);
  });
  // Visit the whole document with each instance of all provided rules.
  (0, _visitor.visit)(documentAST, (0, _visitor.visitWithTypeInfo)(typeInfo, (0, _visitor.visitInParallel)(visitors)));
  return context.getErrors();
}