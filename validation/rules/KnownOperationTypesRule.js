"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnownOperationTypesRule = void 0;
const GraphQLError_js_1 = require("../../error/GraphQLError.js");
/**
 * Known Operation Types
 *
 * A GraphQL document is only valid if when it contains an operation,
 * the root type for the operation exists within the schema.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Type-Existence
 */
function KnownOperationTypesRule(context) {
    const schema = context.getSchema();
    return {
        OperationDefinition(node) {
            const operation = node.operation;
            if (!schema.getRootType(operation)) {
                context.reportError(new GraphQLError_js_1.GraphQLError(`The ${operation} operation is not supported by the schema.`, { nodes: node }));
            }
        },
    };
}
exports.KnownOperationTypesRule = KnownOperationTypesRule;
//# sourceMappingURL=KnownOperationTypesRule.js.map