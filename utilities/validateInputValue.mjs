import { didYouMean } from "../jsutils/didYouMean.mjs";
import { inspect } from "../jsutils/inspect.mjs";
import { isIterableObject } from "../jsutils/isIterableObject.mjs";
import { isObjectLike } from "../jsutils/isObjectLike.mjs";
import { keyMap } from "../jsutils/keyMap.mjs";
import { addPath, pathToArray } from "../jsutils/Path.mjs";
import { suggestionList } from "../jsutils/suggestionList.mjs";
import { ensureGraphQLError } from "../error/ensureGraphQLError.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { Kind } from "../language/kinds.mjs";
import { printForError as print } from "../language/printer.mjs";
import { assertLeafType, isInputObjectType, isListType, isNonNullType, isRequiredInputField, } from "../type/definition.mjs";
import { replaceVariables } from "./replaceVariables.mjs";
export function validateInputValue(inputValue, type, onError, hideSuggestions) {
    return validateInputValueImpl(inputValue, type, onError, hideSuggestions, undefined);
}
function validateInputValueImpl(inputValue, type, onError, hideSuggestions, path) {
    if (isNonNullType(type)) {
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
    if (isListType(type)) {
        if (!isIterableObject(inputValue)) {
            validateInputValueImpl(inputValue, type.ofType, onError, hideSuggestions, path);
        }
        else {
            let index = 0;
            for (const itemValue of inputValue) {
                validateInputValueImpl(itemValue, type.ofType, onError, hideSuggestions, addPath(path, index++, undefined));
            }
        }
    }
    else if (isInputObjectType(type)) {
        if (!isObjectLike(inputValue) || Array.isArray(inputValue)) {
            reportInvalidValue(onError, `Expected value of type "${type}" to be an object, found: ${inspect(inputValue)}.`, path);
            return;
        }
        const fieldDefs = type.getFields();
        for (const field of Object.values(fieldDefs)) {
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if (isRequiredInputField(field)) {
                    reportInvalidValue(onError, `Expected value of type "${type}" to include required field "${field.name}", found: ${inspect(inputValue)}.`, path);
                }
            }
            else {
                validateInputValueImpl(fieldValue, field.type, onError, hideSuggestions, addPath(path, field.name, type.name));
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
                    : didYouMean(suggestionList(fieldName, Object.keys(fieldDefs)));
                reportInvalidValue(onError, `Expected value of type "${type}" not to include unknown field "${fieldName}"${suggestion ? `.${suggestion} Found` : ', found'}: ${inspect(inputValue)}.`, path);
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
                reportInvalidValue(onError, getOneOfInputObjectErrorMessage(type), addPath(path, field, type.name));
            }
        }
    }
    else {
        assertLeafType(type);
        let result;
        let caughtError;
        try {
            result = type.coerceInputValue(inputValue, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError) {
                onError(error, pathToArray(path));
                return;
            }
            caughtError = error;
        }
        if (result === undefined) {
            reportInvalidValue(onError, `Expected value of type "${type}"${caughtError != null
                ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
                : ', found'}: ${inspect(inputValue)}.`, path, ensureGraphQLError(caughtError));
        }
    }
}
function reportInvalidValue(onError, message, path, originalError) {
    onError(new GraphQLError(message, { originalError }), pathToArray(path));
}
export function validateInputLiteral(valueNode, type, onError, variables, fragmentVariableValues, hideSuggestions) {
    const context = {
        static: !variables && !fragmentVariableValues,
        onError,
        variables,
        fragmentVariableValues,
    };
    return validateInputLiteralImpl(context, valueNode, type, hideSuggestions, undefined);
}
function validateInputLiteralImpl(context, valueNode, type, hideSuggestions, path) {
    if (valueNode.kind === Kind.VARIABLE) {
        if (context.static) {
            return;
        }
        const scopedVariableValues = getScopedVariableValues(context, valueNode);
        const value = scopedVariableValues?.coerced[valueNode.name.value];
        if (isNonNullType(type)) {
            if (value === undefined) {
                reportInvalidLiteral(context.onError, `Expected variable "$${valueNode.name.value}" provided to type "${type}" to provide a runtime value.`, valueNode, path);
            }
            else if (value === null) {
                reportInvalidLiteral(context.onError, `Expected variable "$${valueNode.name.value}" provided to non-null type "${type}" not to be null.`, valueNode, path);
            }
        }
        return;
    }
    if (isNonNullType(type)) {
        if (valueNode.kind === Kind.NULL) {
            reportInvalidLiteral(context.onError, `Expected value of non-null type "${type}" not to be null.`, valueNode, path);
            return;
        }
        return validateInputLiteralImpl(context, valueNode, type.ofType, hideSuggestions, path);
    }
    if (valueNode.kind === Kind.NULL) {
        return;
    }
    if (isListType(type)) {
        if (valueNode.kind !== Kind.LIST) {
            validateInputLiteralImpl(context, valueNode, type.ofType, hideSuggestions, path);
        }
        else {
            let index = 0;
            for (const itemNode of valueNode.values) {
                validateInputLiteralImpl(context, itemNode, type.ofType, hideSuggestions, addPath(path, index++, undefined));
            }
        }
    }
    else if (isInputObjectType(type)) {
        if (valueNode.kind !== Kind.OBJECT) {
            reportInvalidLiteral(context.onError, `Expected value of type "${type}" to be an object, found: ${print(valueNode)}.`, valueNode, path);
            return;
        }
        const fieldDefs = type.getFields();
        const fieldNodes = keyMap(valueNode.fields, (field) => field.name.value);
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes[field.name];
            if (fieldNode === undefined) {
                if (isRequiredInputField(field)) {
                    reportInvalidLiteral(context.onError, `Expected value of type "${type}" to include required field "${field.name}", found: ${print(valueNode)}.`, valueNode, path);
                }
            }
            else {
                const fieldValueNode = fieldNode.value;
                if (fieldValueNode.kind === Kind.VARIABLE && !context.static) {
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
                    else if (value === undefined && !isRequiredInputField(field)) {
                        continue;
                    }
                }
                validateInputLiteralImpl(context, fieldValueNode, field.type, hideSuggestions, addPath(path, field.name, type.name));
            }
        }
        const fields = valueNode.fields;
        const knownFields = [];
        for (const fieldNode of fields) {
            const fieldName = fieldNode.name.value;
            if (!Object.hasOwn(fieldDefs, fieldName)) {
                const suggestion = hideSuggestions
                    ? ''
                    : didYouMean(suggestionList(fieldName, Object.keys(fieldDefs)));
                reportInvalidLiteral(context.onError, `Expected value of type "${type}" not to include unknown field "${fieldName}"${suggestion ? `.${suggestion} Found` : ', found'}: ${print(valueNode)}.`, fieldNode, path);
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
            if (fieldValueNode.kind === Kind.NULL) {
                const fieldName = knownFields[0].name.value;
                reportInvalidLiteral(context.onError, getOneOfInputObjectErrorMessage(type), valueNode, addPath(path, fieldName, undefined));
            }
        }
    }
    else {
        assertLeafType(type);
        let result;
        let caughtError;
        try {
            result = type.coerceInputLiteral
                ? type.coerceInputLiteral(replaceVariables(valueNode, context.variables, context.fragmentVariableValues), hideSuggestions)
                : type.parseLiteral(valueNode, undefined, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError) {
                context.onError(error, pathToArray(path));
                return;
            }
            caughtError = error;
        }
        if (result === undefined) {
            reportInvalidLiteral(context.onError, `Expected value of type "${type}"${caughtError != null
                ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
                : ', found'}: ${print(valueNode)}.`, valueNode, path, ensureGraphQLError(caughtError));
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
    onError(new GraphQLError(message, {
        nodes: valueNode,
        originalError,
    }), pathToArray(path));
}
function getCaughtErrorMessage(caughtError) {
    if (isObjectLike(caughtError)) {
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