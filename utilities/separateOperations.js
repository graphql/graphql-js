'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.separateOperations = separateOperations;

var _visitor = require('../language/visitor');

/**
 * separateOperations accepts a single AST document which may contain many
 * operations and fragments and returns a collection of AST documents each of
 * which contains a single operation as well the fragment definitions it
 * refers to.
 */
function separateOperations(documentAST) {

  var operations = [];
  var depGraph = Object.create(null);
  var fromName = void 0;

  // Populate the list of operations and build a dependency graph.
  (0, _visitor.visit)(documentAST, {
    OperationDefinition: function OperationDefinition(node) {
      operations.push(node);
      fromName = opName(node);
    },
    FragmentDefinition: function FragmentDefinition(node) {
      fromName = node.name.value;
    },
    FragmentSpread: function FragmentSpread(node) {
      var toName = node.name.value;
      (depGraph[fromName] || (depGraph[fromName] = Object.create(null)))[toName] = true;
    }
  });

  // For each operation, produce a new synthesized AST which includes only what
  // is necessary for completing that operation.
  var separatedDocumentASTs = Object.create(null);
  operations.forEach(function (operation) {
    var operationName = opName(operation);
    var dependencies = Object.create(null);
    collectTransitiveDependencies(dependencies, depGraph, operationName);

    separatedDocumentASTs[operationName] = {
      kind: 'Document',
      definitions: documentAST.definitions.filter(function (def) {
        return def === operation || def.kind === 'FragmentDefinition' && dependencies[def.name.value];
      })
    };
  });

  return separatedDocumentASTs;
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// Provides the empty string for anonymous operations.
function opName(operation) {
  return operation.name ? operation.name.value : '';
}

// From a dependency graph, collects a list of transitive dependencies by
// recursing through a dependency graph.
function collectTransitiveDependencies(collected, depGraph, fromName) {
  var immediateDeps = depGraph[fromName];
  if (immediateDeps) {
    Object.keys(immediateDeps).forEach(function (toName) {
      if (!collected[toName]) {
        collected[toName] = true;
        collectTransitiveDependencies(collected, depGraph, toName);
      }
    });
  }
}