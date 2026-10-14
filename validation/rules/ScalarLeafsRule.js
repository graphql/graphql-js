"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalarLeafsRule = ScalarLeafsRule;
const inspect_ts_1 = require("../../jsutils/inspect.js");
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const definition_ts_1 = require("../../type/definition.js");
function ScalarLeafsRule(context) {
    return {
        Field(node) {
            const type = context.getType();
            const selectionSet = node.selectionSet;
            if (type) {
                if ((0, definition_ts_1.isLeafType)((0, definition_ts_1.getNamedType)(type))) {
                    if (selectionSet) {
                        const fieldName = node.name.value;
                        const typeStr = (0, inspect_ts_1.inspect)(type);
                        context.reportError(new GraphQLError_ts_1.GraphQLError(`Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`, { nodes: selectionSet }));
                    }
                }
                else if (!selectionSet) {
                    const fieldName = node.name.value;
                    const typeStr = (0, inspect_ts_1.inspect)(type);
                    context.reportError(new GraphQLError_ts_1.GraphQLError(`Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`, { nodes: node }));
                }
                else if (selectionSet.selections.length === 0 &&
                    !context.allowEmptySelectionSets) {
                    const fieldName = node.name.value;
                    const typeStr = (0, inspect_ts_1.inspect)(type);
                    context.reportError(new GraphQLError_ts_1.GraphQLError(`Field "${fieldName}" of type "${typeStr}" must have at least one field selected.`, { nodes: node }));
                }
            }
        },
    };
}
//# sourceMappingURL=ScalarLeafsRule.js.map