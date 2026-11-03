import { groupBy } from "../../jsutils/groupBy.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
export function UniqueArgumentNamesRule(context) {
    return {
        Field: checkArgUniqueness,
        Directive: checkArgUniqueness,
    };
    function checkArgUniqueness(parentNode) {
        const argumentNodes = parentNode.arguments ?? [];
        const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);
        for (const [argName, argNodes] of seenArgs) {
            if (argNodes.length > 1) {
                context.reportError(new GraphQLError(`There can be only one argument named "${argName}".`, { nodes: argNodes.map((node) => node.name) }));
            }
        }
    }
}
//# sourceMappingURL=UniqueArgumentNamesRule.mjs.map