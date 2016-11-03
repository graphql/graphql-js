/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { visit } from '../language/visitor';
import type {
  DocumentNode,
  OperationDefinitionNode,
} from '../language/ast';

/**
 * separateOperations accepts a single AST document which may contain many
 * operations and fragments and returns a collection of AST documents each of
 * which contains a single operation as well the fragment definitions it
 * refers to.
 */
export function separateOperations(
  documentAST: DocumentNode
): { [operationName: string]: DocumentNode } {

  const operations = [];
  const depGraph: DepGraph = Object.create(null);
  let fromName;

  // Populate the list of operations and build a dependency graph.
  visit(documentAST, {
    OperationDefinition(node) {
      operations.push(node);
      fromName = opName(node);
    },
    FragmentDefinition(node) {
      fromName = node.name.value;
    },
    FragmentSpread(node) {
      const toName = node.name.value;
      (depGraph[fromName] ||
        (depGraph[fromName] = Object.create(null)))[toName] = true;
    }
  });

  // For each operation, produce a new synthesized AST which includes only what
  // is necessary for completing that operation.
  const separatedDocumentASTs = Object.create(null);
  operations.forEach(operation => {
    const operationName = opName(operation);
    const dependencies = Object.create(null);
    collectTransitiveDependencies(dependencies, depGraph, operationName);

    separatedDocumentASTs[operationName] = {
      kind: 'Document',
      definitions: documentAST.definitions.filter(def =>
        def === operation ||
        def.kind === 'FragmentDefinition' && dependencies[def.name.value]
      )
    };
  });

  return separatedDocumentASTs;
}

type DepGraph = {[from: string]: {[to: string]: boolean}};

// Provides the empty string for anonymous operations.
function opName(operation: OperationDefinitionNode): string {
  return operation.name ? operation.name.value : '';
}

// From a dependency graph, collects a list of transitive dependencies by
// recursing through a dependency graph.
function collectTransitiveDependencies(
  collected: {[key: string]: boolean},
  depGraph: DepGraph,
  fromName: string
): void {
  const immediateDeps = depGraph[fromName];
  if (immediateDeps) {
    Object.keys(immediateDeps).forEach(toName => {
      if (!collected[toName]) {
        collected[toName] = true;
        collectTransitiveDependencies(collected, depGraph, toName);
      }
    });
  }
}
