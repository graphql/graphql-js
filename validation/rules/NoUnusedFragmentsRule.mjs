import { GraphQLError } from "../../error/GraphQLError.mjs";
export function NoUnusedFragmentsRule(context) {
    const operations = [];
    const fragmentDefs = [];
    return {
        OperationDefinition(operation) {
            operations.push(operation);
            return false;
        },
        FragmentDefinition(node) {
            fragmentDefs.push(node);
            return false;
        },
        Document: {
            leave() {
                const fragmentNameUsed = new Set(context
                    .getRecursivelyReferencedFragmentsForOperations(operations)
                    .map((fragment) => fragment.name.value));
                for (const fragmentDef of fragmentDefs) {
                    const fragName = fragmentDef.name.value;
                    if (!fragmentNameUsed.has(fragName)) {
                        context.reportError(new GraphQLError(`Fragment "${fragName}" is never used.`, {
                            nodes: fragmentDef,
                        }));
                    }
                }
            },
        },
    };
}
//# sourceMappingURL=NoUnusedFragmentsRule.js.map