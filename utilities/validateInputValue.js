"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInputLiteral = exports.validateInputValue = void 0;
const didYouMean_js_1 = require("../jsutils/didYouMean.js");
const inspect_js_1 = require("../jsutils/inspect.js");
const isIterableObject_js_1 = require("../jsutils/isIterableObject.js");
const isObjectLike_js_1 = require("../jsutils/isObjectLike.js");
const keyMap_js_1 = require("../jsutils/keyMap.js");
const Path_js_1 = require("../jsutils/Path.js");
const suggestionList_js_1 = require("../jsutils/suggestionList.js");
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const kinds_js_1 = require("../language/kinds.js");
const printer_js_1 = require("../language/printer.js");
const definition_js_1 = require("../type/definition.js");
const replaceVariables_js_1 = require("./replaceVariables.js");
/**
 * Validate that the provided input value is allowed for this type, collecting
 * all errors via a callback function.
 */
function validateInputValue(inputValue, type, onError, hideSuggestions) {
    return validateInputValueImpl(inputValue, type, onError, hideSuggestions, undefined);
}
exports.validateInputValue = validateInputValue;
function validateInputValueImpl(inputValue, type, onError, hideSuggestions, path) {
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (inputValue === undefined) {
            reportInvalidValue(onError, `Expected a value of non-null type "${type}" to be provided.`, path);
            return;
        }
        if (inputValue === null) {
            reportInvalidValue(onError, `Expected value of non-null type "${type}" not to be null.`, path);
            return;
        }
        return validateInputValueImpl(inputValue, type.ofType, onError, hideSuggestions, path);
    }
    if (inputValue == null) {
        return;
    }
    if ((0, definition_js_1.isListType)(type)) {
        if (!(0, isIterableObject_js_1.isIterableObject)(inputValue)) {
            // Lists accept a non-list value as a list of one.
            validateInputValueImpl(inputValue, type.ofType, onError, hideSuggestions, path);
        }
        else {
            let index = 0;
            for (const itemValue of inputValue) {
                validateInputValueImpl(itemValue, type.ofType, onError, hideSuggestions, (0, Path_js_1.addPath)(path, index++, undefined));
            }
        }
    }
    else if ((0, definition_js_1.isInputObjectType)(type)) {
        if (!(0, isObjectLike_js_1.isObjectLike)(inputValue)) {
            reportInvalidValue(onError, `Expected value of type "${type}" to be an object, found: ${(0, inspect_js_1.inspect)(inputValue)}.`, path);
            return;
        }
        const fieldDefs = type.getFields();
        for (const field of Object.values(fieldDefs)) {
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if ((0, definition_js_1.isRequiredInputField)(field)) {
                    reportInvalidValue(onError, `Expected value of type "${type}" to include required field "${field.name}", found: ${(0, inspect_js_1.inspect)(inputValue)}.`, path);
                }
            }
            else {
                validateInputValueImpl(fieldValue, field.type, onError, hideSuggestions, (0, Path_js_1.addPath)(path, field.name, type.name));
            }
        }
        const fields = Object.keys(inputValue);
        // Ensure every provided field is defined.
        for (const fieldName of fields) {
            if (!Object.hasOwn(fieldDefs, fieldName)) {
                const suggestion = hideSuggestions
                    ? ''
                    : (0, didYouMean_js_1.didYouMean)((0, suggestionList_js_1.suggestionList)(fieldName, Object.keys(fieldDefs)));
                reportInvalidValue(onError, `Expected value of type "${type}" not to include unknown field "${fieldName}"${suggestion ? `.${suggestion} Found` : ', found'}: ${(0, inspect_js_1.inspect)(inputValue)}.`, path);
            }
        }
        if (type.isOneOf) {
            if (fields.length !== 1) {
                reportInvalidValue(onError, `Exactly one key must be specified for OneOf type "${type}".`, path);
            }
            const field = fields[0];
            const value = inputValue[field];
            if (value === null) {
                reportInvalidValue(onError, `Field "${field}" for OneOf type "${type}" must be non-null.`, path);
            }
        }
    }
    else {
        (0, definition_js_1.assertLeafType)(type);
        let result;
        let caughtError;
        try {
            result = type.coerceInputValue(inputValue, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError_js_1.GraphQLError) {
                onError(error, (0, Path_js_1.pathToArray)(path));
                return;
            }
            caughtError = error;
        }
        if (result === undefined) {
            reportInvalidValue(onError, `Expected value of type "${type}"${caughtError != null
                ? `, but encountered error "${caughtError.message != null && caughtError.message !== '' ? caughtError.message : caughtError}"; found`
                : ', found'}: ${(0, inspect_js_1.inspect)(inputValue)}.`, path, caughtError);
        }
    }
}
function reportInvalidValue(onError, message, path, originalError) {
    onError(new GraphQLError_js_1.GraphQLError(message, { originalError }), (0, Path_js_1.pathToArray)(path));
}
/**
 * Validate that the provided input literal is allowed for this type, collecting
 * all errors via a callback function.
 *
 * If variable values are not provided, the literal is validated statically
 * (not assuming that those variables are missing runtime values).
 */
// eslint-disable-next-line @typescript-eslint/max-params
function validateInputLiteral(valueNode, type, onError, variables, fragmentVariableValues, hideSuggestions) {
    const context = {
        static: !variables && !fragmentVariableValues,
        onError,
        variables,
        fragmentVariableValues,
    };
    return validateInputLiteralImpl(context, valueNode, type, hideSuggestions, undefined);
}
exports.validateInputLiteral = validateInputLiteral;
function validateInputLiteralImpl(context, valueNode, type, hideSuggestions, path) {
    if (valueNode.kind === kinds_js_1.Kind.VARIABLE) {
        if (context.static) {
            // If no variable values are provided, this is being validated statically,
            // and cannot yet produce any validation errors for variables.
            return;
        }
        const scopedVariableValues = getScopedVariableValues(context, valueNode);
        const value = scopedVariableValues?.coerced[valueNode.name.value];
        if ((0, definition_js_1.isNonNullType)(type)) {
            if (value === undefined) {
                reportInvalidLiteral(context.onError, `Expected variable "$${valueNode.name.value}" provided to type "${type}" to provide a runtime value.`, valueNode, path);
            }
            else if (value === null) {
                reportInvalidLiteral(context.onError, `Expected variable "$${valueNode.name.value}" provided to non-null type "${type}" not to be null.`, valueNode, path);
            }
        }
        // Note: This does no further checking that this variable is correct.
        // This assumes this variable usage has already been validated.
        return;
    }
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (valueNode.kind === kinds_js_1.Kind.NULL) {
            reportInvalidLiteral(context.onError, `Expected value of non-null type "${type}" not to be null.`, valueNode, path);
            return;
        }
        return validateInputLiteralImpl(context, valueNode, type.ofType, hideSuggestions, path);
    }
    if (valueNode.kind === kinds_js_1.Kind.NULL) {
        return;
    }
    if ((0, definition_js_1.isListType)(type)) {
        if (valueNode.kind !== kinds_js_1.Kind.LIST) {
            // Lists accept a non-list value as a list of one.
            validateInputLiteralImpl(context, valueNode, type.ofType, hideSuggestions, path);
        }
        else {
            let index = 0;
            for (const itemNode of valueNode.values) {
                validateInputLiteralImpl(context, itemNode, type.ofType, hideSuggestions, (0, Path_js_1.addPath)(path, index++, undefined));
            }
        }
    }
    else if ((0, definition_js_1.isInputObjectType)(type)) {
        if (valueNode.kind !== kinds_js_1.Kind.OBJECT) {
            reportInvalidLiteral(context.onError, `Expected value of type "${type}" to be an object, found: ${(0, printer_js_1.print)(valueNode)}.`, valueNode, path);
            return;
        }
        const fieldDefs = type.getFields();
        const fieldNodes = (0, keyMap_js_1.keyMap)(valueNode.fields, (field) => field.name.value);
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes[field.name];
            if (fieldNode === undefined) {
                if ((0, definition_js_1.isRequiredInputField)(field)) {
                    reportInvalidLiteral(context.onError, `Expected value of type "${type}" to include required field "${field.name}", found: ${(0, printer_js_1.print)(valueNode)}.`, valueNode, path);
                }
            }
            else {
                const fieldValueNode = fieldNode.value;
                if (fieldValueNode.kind === kinds_js_1.Kind.VARIABLE && !context.static) {
                    const scopedVariableValues = getScopedVariableValues(context, fieldValueNode);
                    const variableName = fieldValueNode.name.value;
                    const value = scopedVariableValues?.coerced[variableName];
                    if (type.isOneOf) {
                        if (value === undefined) {
                            reportInvalidLiteral(context.onError, `Expected variable "$${variableName}" provided to field "${field.name}" for OneOf Input Object type "${type}" to provide a runtime value.`, valueNode, path);
                        }
                        else if (value === null) {
                            reportInvalidLiteral(context.onError, `Expected variable "$${variableName}" provided to field "${field.name}" for OneOf Input Object type "${type}" not to be null.`, valueNode, path);
                        }
                    }
                    else if (value === undefined && !(0, definition_js_1.isRequiredInputField)(field)) {
                        continue;
                    }
                }
                validateInputLiteralImpl(context, fieldValueNode, field.type, hideSuggestions, (0, Path_js_1.addPath)(path, field.name, type.name));
            }
        }
        const fields = valueNode.fields;
        // Ensure every provided field is defined.
        for (const fieldNode of fields) {
            const fieldName = fieldNode.name.value;
            if (!Object.hasOwn(fieldDefs, fieldName)) {
                const suggestion = hideSuggestions
                    ? ''
                    : (0, didYouMean_js_1.didYouMean)((0, suggestionList_js_1.suggestionList)(fieldName, Object.keys(fieldDefs)));
                reportInvalidLiteral(context.onError, `Expected value of type "${type}" not to include unknown field "${fieldName}"${suggestion ? `.${suggestion} Found` : ', found'}: ${(0, printer_js_1.print)(valueNode)}.`, fieldNode, path);
            }
        }
        if (type.isOneOf) {
            const isNotExactlyOneField = fields.length !== 1;
            if (isNotExactlyOneField) {
                reportInvalidLiteral(context.onError, `OneOf Input Object "${type}" must specify exactly one key.`, valueNode, path);
                return;
            }
            const fieldValueNode = fields[0].value;
            if (fieldValueNode.kind === kinds_js_1.Kind.NULL) {
                const fieldName = fields[0].name.value;
                reportInvalidLiteral(context.onError, `Field "${type}.${fieldName}" used for OneOf Input Object must be non-null.`, valueNode, (0, Path_js_1.addPath)(path, fieldName, undefined));
            }
        }
    }
    else {
        (0, definition_js_1.assertLeafType)(type);
        let result;
        let caughtError;
        try {
            result = type.coerceInputLiteral
                ? type.coerceInputLiteral((0, replaceVariables_js_1.replaceVariables)(valueNode), hideSuggestions)
                : type.parseLiteral(valueNode, undefined, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError_js_1.GraphQLError) {
                context.onError(error, (0, Path_js_1.pathToArray)(path));
                return;
            }
            caughtError = error;
        }
        if (result === undefined) {
            reportInvalidLiteral(context.onError, `Expected value of type "${type}"${caughtError != null
                ? `, but encountered error "${caughtError.message != null && caughtError.message !== '' ? caughtError.message : caughtError}"; found`
                : ', found'}: ${(0, printer_js_1.print)(valueNode)}.`, valueNode, path, caughtError);
        }
    }
}
function getScopedVariableValues(context, valueNode) {
    const variableName = valueNode.name.value;
    const { fragmentVariableValues, variables } = context;
    return fragmentVariableValues?.sources[variableName]
        ? fragmentVariableValues
        : variables;
}
function reportInvalidLiteral(onError, message, valueNode, path, originalError) {
    onError(new GraphQLError_js_1.GraphQLError(message, { nodes: valueNode, originalError }), (0, Path_js_1.pathToArray)(path));
}
//# sourceMappingURL=validateInputValue.js.map