"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.separateOperations = separateOperations;

var _visitor = require("../language/visitor");

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/**
 * separateOperations accepts a single AST document which may contain many
 * operations and fragments and returns a collection of AST documents each of
 * which contains a single operation as well the fragment definitions it
 * refers to.
 */
function separateOperations(documentAST) {
  var operations = [];
  var fragments = Object.create(null);
  var positions = new Map();
  var depGraph = Object.create(null);
  var fromName;
  var idx = 0; // Populate metadata and build a dependency graph.

  (0, _visitor.visit)(documentAST, {
    OperationDefinition: function OperationDefinition(node) {
      fromName = opName(node);
      operations.push(node);
      positions.set(node, idx++);
    },
    FragmentDefinition: function FragmentDefinition(node) {
      fromName = node.name.value;
      fragments[fromName] = node;
      positions.set(node, idx++);
    },
    FragmentSpread: function FragmentSpread(node) {
      var toName = node.name.value;
      (depGraph[fromName] || (depGraph[fromName] = Object.create(null)))[toName] = true;
    }
  }); // For each operation, produce a new synthesized AST which includes only what
  // is necessary for completing that operation.

  var separatedDocumentASTs = Object.create(null);

  for (var _i = 0; _i < operations.length; _i++) {
    var operation = operations[_i];
    var operationName = opName(operation);
    var dependencies = Object.create(null);
    collectTransitiveDependencies(dependencies, depGraph, operationName); // The list of definition nodes to be included for this operation, sorted
    // to retain the same order as the original document.

    var definitions = [operation];

    var _arr = Object.keys(dependencies);

    for (var _i2 = 0; _i2 < _arr.length; _i2++) {
      var name = _arr[_i2];
      definitions.push(fragments[name]);
    }

    definitions.sort(function (n1, n2) {
      return (positions.get(n1) || 0) - (positions.get(n2) || 0);
    });
    separatedDocumentASTs[operationName] = {
      kind: 'Document',
      definitions: definitions
    };
  }

  return separatedDocumentASTs;
}

// Provides the empty string for anonymous operations.
function opName(operation) {
  return operation.name ? operation.name.value : '';
} // From a dependency graph, collects a list of transitive dependencies by
// recursing through a dependency graph.


function collectTransitiveDependencies(collected, depGraph, fromName) {
  var immediateDeps = depGraph[fromName];

  if (immediateDeps) {
    var _arr2 = Object.keys(immediateDeps);

    for (var _i3 = 0; _i3 < _arr2.length; _i3++) {
      var toName = _arr2[_i3];

      if (!collected[toName]) {
        collected[toName] = true;
        collectTransitiveDependencies(collected, depGraph, toName);
      }
    }
  }
}