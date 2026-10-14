import { inspect } from "../../jsutils/inspect.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
import { getNamedType, isLeafType } from "../../type/definition.mjs";
export function ScalarLeafsRule(context) {
    return {
        Field(node) {
            const type = context.getType();
            const selectionSet = node.selectionSet;
            if (type) {
                if (isLeafType(getNamedType(type))) {
                    if (selectionSet) {
                        const fieldName = node.name.value;
                        const typeStr = inspect(type);
                        context.reportError(new GraphQLError(`Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`, { nodes: selectionSet }));
                    }
                }
                else if (!selectionSet) {
                    const fieldName = node.name.value;
                    const typeStr = inspect(type);
                    context.reportError(new GraphQLError(`Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`, { nodes: node }));
                }
                else if (selectionSet.selections.length === 0 &&
                    !context.allowEmptySelectionSets) {
                    const fieldName = node.name.value;
                    const typeStr = inspect(type);
                    context.reportError(new GraphQLError(`Field "${fieldName}" of type "${typeStr}" must have at least one field selected.`, { nodes: node }));
                }
            }
        },
    };
}
//# sourceMappingURL=ScalarLeafsRule.js.map