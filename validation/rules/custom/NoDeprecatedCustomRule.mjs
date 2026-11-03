import { GraphQLError } from "../../../error/GraphQLError.mjs";
import { getNamedType, isInputObjectType } from "../../../type/definition.mjs";
export function NoDeprecatedCustomRule(context) {
    return {
        Field(node) {
            const fieldDef = context.getFieldDef();
            const deprecationReason = fieldDef?.deprecationReason;
            if (fieldDef && deprecationReason != null) {
                context.reportError(new GraphQLError(`The field ${fieldDef} is deprecated. ${deprecationReason}`, { nodes: node }));
            }
        },
        Argument(node) {
            const argDef = context.getArgument();
            const deprecationReason = argDef?.deprecationReason;
            if (argDef && deprecationReason != null) {
                context.reportError(new GraphQLError(`The argument "${argDef}" is deprecated. ${deprecationReason}`, { nodes: node }));
            }
        },
        ObjectField(node) {
            const inputObjectDef = getNamedType(context.getParentInputType());
            if (isInputObjectType(inputObjectDef)) {
                const inputFieldDef = inputObjectDef.getFields()[node.name.value];
                const deprecationReason = inputFieldDef?.deprecationReason;
                if (deprecationReason != null) {
                    context.reportError(new GraphQLError(`The input field ${inputFieldDef} is deprecated. ${deprecationReason}`, { nodes: node }));
                }
            }
        },
        EnumValue(node) {
            const enumValueDef = context.getEnumValue();
            const deprecationReason = enumValueDef?.deprecationReason;
            if (enumValueDef && deprecationReason != null) {
                context.reportError(new GraphQLError(`The enum value "${enumValueDef}" is deprecated. ${deprecationReason}`, { nodes: node }));
            }
        },
    };
}
//# sourceMappingURL=NoDeprecatedCustomRule.mjs.map