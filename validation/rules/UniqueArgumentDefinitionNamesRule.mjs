import { groupBy } from "../../jsutils/groupBy.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
export function UniqueArgumentDefinitionNamesRule(context) {
    return {
        DirectiveDefinition(directiveNode) {
            const argumentNodes = directiveNode.arguments ?? [];
            return checkArgUniqueness(`@${directiveNode.name.value}`, argumentNodes);
        },
        InterfaceTypeDefinition: checkArgUniquenessPerField,
        InterfaceTypeExtension: checkArgUniquenessPerField,
        ObjectTypeDefinition: checkArgUniquenessPerField,
        ObjectTypeExtension: checkArgUniquenessPerField,
    };
    function checkArgUniquenessPerField(typeNode) {
        const typeName = typeNode.name.value;
        const fieldNodes = typeNode.fields ?? [];
        for (const fieldDef of fieldNodes) {
            const fieldName = fieldDef.name.value;
            const argumentNodes = fieldDef.arguments ?? [];
            checkArgUniqueness(`${typeName}.${fieldName}`, argumentNodes);
        }
        return false;
    }
    function checkArgUniqueness(parentName, argumentNodes) {
        const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);
        for (const [argName, argNodes] of seenArgs) {
            if (argNodes.length > 1) {
                context.reportError(new GraphQLError(`Argument "${parentName}(${argName}:)" can only be defined once.`, { nodes: argNodes.map((node) => node.name) }));
            }
        }
        return false;
    }
}
//# sourceMappingURL=UniqueArgumentDefinitionNamesRule.mjs.map