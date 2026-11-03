import { GraphQLError } from "../../error/GraphQLError.mjs";
import { print } from "../../language/printer.mjs";
import { isCompositeType } from "../../type/definition.mjs";
import { typeFromAST } from "../../utilities/typeFromAST.mjs";
export function FragmentsOnCompositeTypesRule(context) {
    return {
        InlineFragment(node) {
            const typeCondition = node.typeCondition;
            if (typeCondition) {
                const type = typeFromAST(context.getSchema(), typeCondition);
                if (type && !isCompositeType(type)) {
                    const typeStr = print(typeCondition);
                    context.reportError(new GraphQLError(`Fragment cannot condition on non composite type "${typeStr}".`, { nodes: typeCondition }));
                }
            }
        },
        FragmentDefinition(node) {
            const type = typeFromAST(context.getSchema(), node.typeCondition);
            if (type && !isCompositeType(type)) {
                const typeStr = print(node.typeCondition);
                context.reportError(new GraphQLError(`Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`, { nodes: node.typeCondition }));
            }
        },
    };
}
//# sourceMappingURL=FragmentsOnCompositeTypesRule.mjs.map