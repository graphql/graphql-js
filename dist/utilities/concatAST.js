'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.concatAST = concatAST;


/**
 * Provided a collection of ASTs, presumably each from different files,
 * concatenate the ASTs together into batched AST, useful for validating many
 * GraphQL source files which together represent one conceptual application.
 */
function concatAST(asts) {
  var batchDefinitions = [];
  for (var i = 0; i < asts.length; i++) {
    var definitions = asts[i].definitions;
    for (var j = 0; j < definitions.length; j++) {
      batchDefinitions.push(definitions[j]);
    }
  }
  return {
    kind: 'Document',
    definitions: batchDefinitions
  };
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */