import { Kind } from "../language/kinds.mjs";
import { visit } from "../language/visitor.mjs";
export function separateOperations(documentAST) {
    const operations = [];
    const depGraph = Object.create(null);
    for (const definitionNode of documentAST.definitions) {
        switch (definitionNode.kind) {
            case Kind.OPERATION_DEFINITION:
                operations.push(definitionNode);
                break;
            case Kind.FRAGMENT_DEFINITION:
                depGraph[definitionNode.name.value] = collectDependencies(definitionNode.selectionSet);
                break;
            default:
        }
    }
    const separatedDocumentASTs = Object.create(null);
    for (const operation of operations) {
        const dependencies = new Set();
        for (const fragmentName of collectDependencies(operation.selectionSet)) {
            collectTransitiveDependencies(dependencies, depGraph, fragmentName);
        }
        const operationName = operation.name ? operation.name.value : '';
        separatedDocumentASTs[operationName] = {
            kind: Kind.DOCUMENT,
            definitions: documentAST.definitions.filter((node) => node === operation ||
                (node.kind === Kind.FRAGMENT_DEFINITION &&
                    dependencies.has(node.name.value))),
        };
    }
    return separatedDocumentASTs;
}
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
    visit(selectionSet, {
        FragmentSpread(node) {
            dependencies.push(node.name.value);
        },
    });
    return dependencies;
}
//# sourceMappingURL=separateOperations.mjs.map