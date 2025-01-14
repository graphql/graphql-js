"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValuesOfCorrectTypeRule = ValuesOfCorrectTypeRule;
const validateInputValue_js_1 = require("../../utilities/validateInputValue.js");
/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 */
function ValuesOfCorrectTypeRule(context) {
    return {
        NullValue: (node) => isValidValueNode(context, node, context.getInputType()),
        ListValue: (node) => 
        // Note: TypeInfo will traverse into a list's item type, so look to the
        // parent input type to check if it is a list.
        isValidValueNode(context, node, context.getParentInputType()),
        ObjectValue: (node) => isValidValueNode(context, node, context.getInputType()),
        EnumValue: (node) => isValidValueNode(context, node, context.getInputType()),
        IntValue: (node) => isValidValueNode(context, node, context.getInputType()),
        FloatValue: (node) => isValidValueNode(context, node, context.getInputType()),
        StringValue: (node) => isValidValueNode(context, node, context.getInputType()),
        BooleanValue: (node) => isValidValueNode(context, node, context.getInputType()),
    };
}
/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidValueNode(context, node, inputType) {
    if (inputType) {
        (0, validateInputValue_js_1.validateInputLiteral)(node, inputType, (error) => {
            context.reportError(error);
        }, undefined, undefined, context.hideSuggestions);
    }
    return false;
}
//# sourceMappingURL=ValuesOfCorrectTypeRule.js.map