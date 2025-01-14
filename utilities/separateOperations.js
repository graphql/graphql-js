"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.separateOperations = separateOperations;
const kinds_js_1 = require("../language/kinds.js");
const visitor_js_1 = require("../language/visitor.js");
/**
 * separateOperations accepts a single AST document which may contain many
 * operations and fragments and returns a collection of AST documents each of
 * which contains a single operation as well the fragment definitions it
 * refers to.
 */
function separateOperations(documentAST) {
    const operations = [];
    const depGraph = Object.create(null);
    // Populate metadata and build a dependency graph.
    for (const definitionNode of documentAST.definitions) {
        switch (definitionNode.kind) {
            case kinds_js_1.Kind.OPERATION_DEFINITION:
                operations.push(definitionNode);
                break;
            case kinds_js_1.Kind.FRAGMENT_DEFINITION:
                depGraph[definitionNode.name.value] = collectDependencies(definitionNode.selectionSet);
                break;
            default:
            // ignore non-executable definitions
        }
    }
    // For each operation, produce a new synthesized AST which includes only what
    // is necessary for completing that operation.
    const separatedDocumentASTs = Object.create(null);
    for (const operation of operations) {
        const dependencies = new Set();
        for (const fragmentName of collectDependencies(operation.selectionSet)) {
            collectTransitiveDependencies(dependencies, depGraph, fragmentName);
        }
        // Provides the empty string for anonymous operations.
        const operationName = operation.name ? operation.name.value : '';
        // The list of definition nodes to be included for this operation, sorted
        // to retain the same order as the original document.
        separatedDocumentASTs[operationName] = {
            kind: kinds_js_1.Kind.DOCUMENT,
            definitions: documentAST.definitions.filter((node) => node === operation ||
                (node.kind === kinds_js_1.Kind.FRAGMENT_DEFINITION &&
                    dependencies.has(node.name.value))),
        };
    }
    return separatedDocumentASTs;
}
// From a dependency graph, collects a list of transitive dependencies by
// recursing through a dependency graph.
function collectTransitiveDependencies(collected, depGraph, fromName) {
    if (!collected.has(fromName)) {
        collected.add(fromName);
        const immediateDeps = depGraph[fromName];
        if (immediateDeps !== undefined) {
            for (const toName of immediateDeps) {
                collectTransitiveDependencies(collected, depGraph, toName);
            }
        }
    }
}
function collectDependencies(selectionSet) {
    const dependencies = [];
    (0, visitor_js_1.visit)(selectionSet, {
        FragmentSpread(node) {
            dependencies.push(node.name.value);
        },
    });
    return dependencies;
}
//# sourceMappingURL=separateOperations.js.map