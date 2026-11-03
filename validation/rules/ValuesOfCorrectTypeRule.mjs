import { validateInputLiteral } from "../../utilities/validateInputValue.mjs";
export function ValuesOfCorrectTypeRule(context) {
    return {
        NullValue: (node) => isValidValueNode(context, node, context.getInputType()),
        ListValue: (node) => isValidValueNode(context, node, context.getParentInputType()),
        ObjectValue: (node) => isValidValueNode(context, node, context.getInputType()),
        EnumValue: (node) => isValidValueNode(context, node, context.getInputType()),
        IntValue: (node) => isValidValueNode(context, node, context.getInputType()),
        FloatValue: (node) => isValidValueNode(context, node, context.getInputType()),
        StringValue: (node) => isValidValueNode(context, node, context.getInputType()),
        BooleanValue: (node) => isValidValueNode(context, node, context.getInputType()),
    };
}
function isValidValueNode(context, node, inputType) {
    if (inputType) {
        validateInputLiteral(node, inputType, (error) => {
            context.reportError(error);
        }, undefined, undefined, context.hideSuggestions);
    }
    return false;
}
//# sourceMappingURL=ValuesOfCorrectTypeRule.mjs.map