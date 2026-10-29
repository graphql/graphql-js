"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInputValue = validateInputValue;
exports.validateInputLiteral = validateInputLiteral;
const didYouMean_ts_1 = require("../jsutils/didYouMean.js");
const inspect_ts_1 = require("../jsutils/inspect.js");
const isIterableObject_ts_1 = require("../jsutils/isIterableObject.js");
const isObjectLike_ts_1 = require("../jsutils/isObjectLike.js");
const keyMap_ts_1 = require("../jsutils/keyMap.js");
const Path_ts_1 = require("../jsutils/Path.js");
const suggestionList_ts_1 = require("../jsutils/suggestionList.js");
const ensureGraphQLError_ts_1 = require("../error/ensureGraphQLError.js");
const GraphQLError_ts_1 = require("../error/GraphQLError.js");
const kinds_ts_1 = require("../language/kinds.js");
const printer_ts_1 = require("../language/printer.js");
const definition_ts_1 = require("../type/definition.js");
const replaceVariables_ts_1 = require("./replaceVariables.js");
function validateInputValue(inputValue, type, onError, hideSuggestions) {
    return validateInputValueImpl(inputValue, type, onError, hideSuggestions, undefined);
}
function validateInputValueImpl(inputValue, type, onError, hideSuggestions, path) {
    if ((0, definition_ts_1.isNonNullType)(type)) {
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
    if ((0, definition_ts_1.isListType)(type)) {
        if (!(0, isIterableObject_ts_1.isIterableObject)(inputValue)) {
            validateInputValueImpl(inputValue, type.ofType, onError, hideSuggestions, path);
        }
        else {
            let index = 0;
            for (const itemValue of inputValue) {
                validateInputValueImpl(itemValue, type.ofType, onError, hideSuggestions, (0, Path_ts_1.addPath)(path, index++, undefined));
            }
        }
    }
    else if ((0, definition_ts_1.isInputObjectType)(type)) {
        if (!(0, isObjectLike_ts_1.isObjectLike)(inputValue) || Array.isArray(inputValue)) {
            reportInvalidValue(onError, `Expected value of type "${type}" to be an object, found: ${(0, inspect_ts_1.inspect)(inputValue)}.`, path);
            return;
        }
        const fieldDefs = type.getFields();
        for (const field of Object.values(fieldDefs)) {
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if ((0, definition_ts_1.isRequiredInputField)(field)) {
                    reportInvalidValue(onError, `Expected value of type "${type}" to include required field "${field.name}", found: ${(0, inspect_ts_1.inspect)(inputValue)}.`, path);
                }
            }
            else {
                validateInputValueImpl(fieldValue, field.type, onError, hideSuggestions, (0, Path_ts_1.addPath)(path, field.name, type.name));
            }
        }
        const fields = [];
        for (const fieldName of Object.keys(inputValue)) {
            if (inputValue[fieldName] === undefined) {
                continue;
            }
            if (!Object.hasOwn(fieldDefs, fieldName)) {
                const suggestion = hideSuggestions
                    ? ''
                    : (0, didYouMean_ts_1.didYouMean)((0, suggestionList_ts_1.suggestionList)(fieldName, Object.keys(fieldDefs)));
                reportInvalidValue(onError, `Expected value of type "${type}" not to include unknown field "${fieldName}"${suggestion ? `.${suggestion} Found` : ', found'}: ${(0, inspect_ts_1.inspect)(inputValue)}.`, path);
                continue;
            }
            fields.push(fieldName);
        }
        if (type.isOneOf) {
            if (fields.length !== 1) {
                reportInvalidValue(onError, getOneOfInputObjectErrorMessage(type), path);
            }
            const field = fields[0];
            const value = inputValue[field];
            if (value === null) {
                reportInvalidValue(onError, getOneOfInputObjectErrorMessage(type), (0, Path_ts_1.addPath)(path, field, type.name));
            }
        }
    }
    else {
        (0, definition_ts_1.assertLeafType)(type);
        let result;
        let caughtError;
        try {
            result = type.coerceInputValue(inputValue, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError_ts_1.GraphQLError) {
                onError(error, (0, Path_ts_1.pathToArray)(path));
                return;
            }
            caughtError = error;
        }
        if (result === undefined) {
            reportInvalidValue(onError, `Expected value of type "${type}"${caughtError != null
                ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
                : ', found'}: ${(0, inspect_ts_1.inspect)(inputValue)}.`, path, (0, ensureGraphQLError_ts_1.ensureGraphQLError)(caughtError));
        }
    }
}
function reportInvalidValue(onError, message, path, originalError) {
    onError(new GraphQLError_ts_1.GraphQLError(message, { originalError }), (0, Path_ts_1.pathToArray)(path));
}
function validateInputLiteral(valueNode, type, onError, variables, fragmentVariableValues, hideSuggestions) {
    const context = {
        static: !variables && !fragmentVariableValues,
        onError,
        variables,
        fragmentVariableValues,
    };
    return validateInputLiteralImpl(context, valueNode, type, hideSuggestions, undefined);
}
function validateInputLiteralImpl(context, valueNode, type, hideSuggestions, path) {
    if (valueNode.kind === kinds_ts_1.Kind.VARIABLE) {
        if (context.static) {
            return;
        }
        const scopedVariableValues = getScopedVariableValues(context, valueNode);
        const value = scopedVariableValues?.coerced[valueNode.name.value];
        if ((0, definition_ts_1.isNonNullType)(type)) {
            if (value === undefined) {
                reportInvalidLiteral(context.onError, `Expected variable "$${valueNode.name.value}" provided to type "${type}" to provide a runtime value.`, valueNode, path);
            }
            else if (value === null) {
                reportInvalidLiteral(context.onError, `Expected variable "$${valueNode.name.value}" provided to non-null type "${type}" not to be null.`, valueNode, path);
            }
        }
        return;
    }
    if ((0, definition_ts_1.isNonNullType)(type)) {
        if (valueNode.kind === kinds_ts_1.Kind.NULL) {
            reportInvalidLiteral(context.onError, `Expected value of non-null type "${type}" not to be null.`, valueNode, path);
            return;
        }
        return validateInputLiteralImpl(context, valueNode, type.ofType, hideSuggestions, path);
    }
    if (valueNode.kind === kinds_ts_1.Kind.NULL) {
        return;
    }
    if ((0, definition_ts_1.isListType)(type)) {
        if (valueNode.kind !== kinds_ts_1.Kind.LIST) {
            validateInputLiteralImpl(context, valueNode, type.ofType, hideSuggestions, path);
        }
        else {
            let index = 0;
            for (const itemNode of valueNode.values) {
                validateInputLiteralImpl(context, itemNode, type.ofType, hideSuggestions, (0, Path_ts_1.addPath)(path, index++, undefined));
            }
        }
    }
    else if ((0, definition_ts_1.isInputObjectType)(type)) {
        if (valueNode.kind !== kinds_ts_1.Kind.OBJECT) {
            reportInvalidLiteral(context.onError, `Expected value of type "${type}" to be an object, found: ${(0, printer_ts_1.printForError)(valueNode)}.`, valueNode, path);
            return;
        }
        const fieldDefs = type.getFields();
        const fieldNodes = (0, keyMap_ts_1.keyMap)(valueNode.fields, (field) => field.name.value);
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes[field.name];
            if (fieldNode === undefined) {
                if ((0, definition_ts_1.isRequiredInputField)(field)) {
                    reportInvalidLiteral(context.onError, `Expected value of type "${type}" to include required field "${field.name}", found: ${(0, printer_ts_1.printForError)(valueNode)}.`, valueNode, path);
                }
            }
            else {
                const fieldValueNode = fieldNode.value;
                if (fieldValueNode.kind === kinds_ts_1.Kind.VARIABLE && !context.static) {
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
                    else if (value === undefined && !(0, definition_ts_1.isRequiredInputField)(field)) {
                        continue;
                    }
                }
                validateInputLiteralImpl(context, fieldValueNode, field.type, hideSuggestions, (0, Path_ts_1.addPath)(path, field.name, type.name));
            }
        }
        const fields = valueNode.fields;
        const knownFields = [];
        for (const fieldNode of fields) {
            const fieldName = fieldNode.name.value;
            if (!Object.hasOwn(fieldDefs, fieldName)) {
                const suggestion = hideSuggestions
                    ? ''
                    : (0, didYouMean_ts_1.didYouMean)((0, suggestionList_ts_1.suggestionList)(fieldName, Object.keys(fieldDefs)));
                reportInvalidLiteral(context.onError, `Expected value of type "${type}" not to include unknown field "${fieldName}"${suggestion ? `.${suggestion} Found` : ', found'}: ${(0, printer_ts_1.printForError)(valueNode)}.`, fieldNode, path);
            }
            else {
                knownFields.push(fieldNode);
            }
        }
        if (type.isOneOf) {
            const isNotExactlyOneField = knownFields.length !== 1;
            if (isNotExactlyOneField) {
                reportInvalidLiteral(context.onError, getOneOfInputObjectErrorMessage(type), valueNode, path);
                return;
            }
            const fieldValueNode = knownFields[0].value;
            if (fieldValueNode.kind === kinds_ts_1.Kind.NULL) {
                const fieldName = knownFields[0].name.value;
                reportInvalidLiteral(context.onError, getOneOfInputObjectErrorMessage(type), valueNode, (0, Path_ts_1.addPath)(path, fieldName, undefined));
            }
        }
    }
    else {
        (0, definition_ts_1.assertLeafType)(type);
        let result;
        let caughtError;
        try {
            result = type.coerceInputLiteral
                ? type.coerceInputLiteral((0, replaceVariables_ts_1.replaceVariables)(valueNode, context.variables, context.fragmentVariableValues), hideSuggestions)
                : type.parseLiteral(valueNode, undefined, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError_ts_1.GraphQLError) {
                context.onError(error, (0, Path_ts_1.pathToArray)(path));
                return;
            }
            caughtError = error;
        }
        if (result === undefined) {
            reportInvalidLiteral(context.onError, `Expected value of type "${type}"${caughtError != null
                ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
                : ', found'}: ${(0, printer_ts_1.printForError)(valueNode)}.`, valueNode, path, (0, ensureGraphQLError_ts_1.ensureGraphQLError)(caughtError));
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
    onError(new GraphQLError_ts_1.GraphQLError(message, {
        nodes: valueNode,
        originalError,
    }), (0, Path_ts_1.pathToArray)(path));
}
function getCaughtErrorMessage(caughtError) {
    if ((0, isObjectLike_ts_1.isObjectLike)(caughtError)) {
        const message = caughtError.message;
        if (typeof message === 'string' && message !== '') {
            return message;
        }
    }
    return String(caughtError);
}
function getOneOfInputObjectErrorMessage(type) {
    return `Within OneOf Input Object type "${type}", exactly one field must be specified, and the value for that field must be non-null.`;
}
//# sourceMappingURL=validateInputValue.js.map