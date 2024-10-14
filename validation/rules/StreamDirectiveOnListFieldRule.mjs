import { GraphQLError } from "../../error/GraphQLError.mjs";
import { isListType, isWrappingType } from "../../type/definition.mjs";
import { GraphQLStreamDirective } from "../../type/directives.mjs";
/**
 * Stream directives are used on list fields
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
export function StreamDirectiveOnListFieldRule(context) {
    return {
        Directive(node) {
            const fieldDef = context.getFieldDef();
            const parentType = context.getParentType();
            if (fieldDef &&
                parentType &&
                node.name.value === GraphQLStreamDirective.name &&
                !(isListType(fieldDef.type) ||
                    (isWrappingType(fieldDef.type) && isListType(fieldDef.type.ofType)))) {
                context.reportError(new GraphQLError(`Directive "@stream" cannot be used on non-list field "${parentType}.${fieldDef.name}".`, { nodes: node }));
            }
        },
    };
}
//# sourceMappingURL=StreamDirectiveOnListFieldRule.js.map