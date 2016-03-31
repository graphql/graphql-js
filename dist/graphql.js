'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

exports.graphql = graphql;

var _source = require('./language/source');

var _parser = require('./language/parser');

var _validate = require('./validation/validate');

var _execute = require('./execution/execute');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * This is the primary entry point function for fulfilling GraphQL operations
 * by parsing, validating, and executing a GraphQL document along side a
 * GraphQL schema.
 *
 * More sophisticated GraphQL servers, such as those which persist queries,
 * may wish to separate the validation and execution phases to a static time
 * tooling step, and a server runtime step.
 *
 * schema:
 *    The GraphQL type system to use when validating and executing a query.
 * requestString:
 *    A GraphQL language formatted string representing the requested operation.
 * rootValue:
 *    The value provided as the first argument to resolver functions on the top
 *    level type (e.g. the query object type).
 * variableValues:
 *    A mapping of variable name to runtime value to use for all variables
 *    defined in the requestString.
 * operationName:
 *    The name of the operation to use if requestString contains multiple
 *    possible operations. Can be omitted if requestString contains only
 *    one operation.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function graphql(schema, requestString, rootValue, contextValue, variableValues, operationName) {
  return new _promise2.default(function (resolve) {
    var source = new _source.Source(requestString || '', 'GraphQL request');
    var documentAST = (0, _parser.parse)(source);
    var validationErrors = (0, _validate.validate)(schema, documentAST);
    if (validationErrors.length > 0) {
      resolve({ errors: validationErrors });
    } else {
      resolve((0, _execute.execute)(schema, documentAST, rootValue, contextValue, variableValues, operationName));
    }
  }).catch(function (error) {
    return { errors: [error] };
  });
}

/**
 * The result of a GraphQL parse, validation and execution.
 *
 * `data` is the result of a successful execution of the query.
 * `errors` is included when any errors occurred as a non-empty array.
 */