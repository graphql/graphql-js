import { GraphQLError } from "../../../error/GraphQLError.mjs";
import { getNamedType } from "../../../type/definition.mjs";
import { isIntrospectionType } from "../../../type/introspection.mjs";
export function NoSchemaIntrospectionCustomRule(context) {
    return {
        Field(node) {
            const type = getNamedType(context.getType());
            if (type && isIntrospectionType(type)) {
                context.reportError(new GraphQLError(`GraphQL introspection has been disabled, but the requested query contained the field "${node.name.value}".`, { nodes: node }));
            }
        },
    };
}
//# sourceMappingURL=NoSchemaIntrospectionCustomRule.mjs.map