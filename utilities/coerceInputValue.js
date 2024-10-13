"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceDefaultValue = exports.coerceInputLiteral = exports.coerceInputValue = void 0;
const didYouMean_js_1 = require("../jsutils/didYouMean.js");
const inspect_js_1 = require("../jsutils/inspect.js");
const invariant_js_1 = require("../jsutils/invariant.js");
const isIterableObject_js_1 = require("../jsutils/isIterableObject.js");
const isObjectLike_js_1 = require("../jsutils/isObjectLike.js");
const Path_js_1 = require("../jsutils/Path.js");
const printPathArray_js_1 = require("../jsutils/printPathArray.js");
const suggestionList_js_1 = require("../jsutils/suggestionList.js");
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const kinds_js_1 = require("../language/kinds.js");
const definition_js_1 = require("../type/definition.js");
const replaceVariables_js_1 = require("./replaceVariables.js");
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
function coerceInputValue(inputValue, type, onError = defaultOnError, hideSuggestions) {
    return coerceInputValueImpl(inputValue, type, onError, undefined, hideSuggestions);
}
exports.coerceInputValue = coerceInputValue;
function defaultOnError(path, invalidValue, error) {
    let errorPrefix = 'Invalid value ' + (0, inspect_js_1.inspect)(invalidValue);
    if (path.length > 0) {
        errorPrefix += ` at "value${(0, printPathArray_js_1.printPathArray)(path)}"`;
    }
    error.message = errorPrefix + ': ' + error.message;
    throw error;
}
function coerceInputValueImpl(inputValue, type, onError, path, hideSuggestions) {
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (inputValue != null) {
            return coerceInputValueImpl(inputValue, type.ofType, onError, path, hideSuggestions);
        }
        onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Expected non-nullable type "${(0, inspect_js_1.inspect)(type)}" not to be null.`));
        return;
    }
    if (inputValue == null) {
        // Explicitly return the value null.
        return null;
    }
    if ((0, definition_js_1.isListType)(type)) {
        const itemType = type.ofType;
        if ((0, isIterableObject_js_1.isIterableObject)(inputValue)) {
            return Array.from(inputValue, (itemValue, index) => {
                const itemPath = (0, Path_js_1.addPath)(path, index, undefined);
                return coerceInputValueImpl(itemValue, itemType, onError, itemPath, hideSuggestions);
            });
        }
        // Lists accept a non-list value as a list of one.
        return [
            coerceInputValueImpl(inputValue, itemType, onError, path, hideSuggestions),
        ];
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
        if (!(0, isObjectLike_js_1.isObjectLike)(inputValue)) {
            onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Expected type "${type}" to be an object.`));
            return;
        }
        const coercedValue = {};
        const fieldDefs = type.getFields();
        for (const field of Object.values(fieldDefs)) {
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if (field.defaultValue) {
                    coercedValue[field.name] = coerceDefaultValue(field.defaultValue, field.type, hideSuggestions);
                }
                else if ((0, definition_js_1.isNonNullType)(field.type)) {
                    const typeStr = (0, inspect_js_1.inspect)(field.type);
                    onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Field "${type}.${field.name}" of required type "${typeStr}" was not provided.`));
                }
                continue;
            }
            coercedValue[field.name] = coerceInputValueImpl(fieldValue, field.type, onError, (0, Path_js_1.addPath)(path, field.name, type.name), hideSuggestions);
        }
        // Ensure every provided field is defined.
        for (const fieldName of Object.keys(inputValue)) {
            if (fieldDefs[fieldName] == null) {
                const suggestions = (0, suggestionList_js_1.suggestionList)(fieldName, Object.keys(type.getFields()));
                onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Field "${fieldName}" is not defined by type "${type}".` +
                    (hideSuggestions ? '' : (0, didYouMean_js_1.didYouMean)(suggestions))));
            }
        }
        if (type.isOneOf) {
            const keys = Object.keys(coercedValue);
            if (keys.length !== 1) {
                onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Exactly one key must be specified for OneOf type "${type}".`));
            }
            const key = keys[0];
            const value = coercedValue[key];
            if (value === null) {
                onError((0, Path_js_1.pathToArray)(path).concat(key), value, new GraphQLError_js_1.GraphQLError(`Field "${key}" must be non-null.`));
            }
        }
        return coercedValue;
    }
    if ((0, definition_js_1.isLeafType)(type)) {
        let parseResult;
        // Scalars and Enums determine if an input value is valid via parseValue(),
        // which can throw to indicate failure. If it throws, maintain a reference
        // to the original error.
        try {
            parseResult = type.parseValue(inputValue, hideSuggestions);
        }
        catch (error) {
            if (error instanceof GraphQLError_js_1.GraphQLError) {
                onError((0, Path_js_1.pathToArray)(path), inputValue, error);
            }
            else {
                onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Expected type "${type}". ` + error.message, {
                    originalError: error,
                }));
            }
            return;
        }
        if (parseResult === undefined) {
            onError((0, Path_js_1.pathToArray)(path), inputValue, new GraphQLError_js_1.GraphQLError(`Expected type "${type}".`));
        }
        return parseResult;
    }
    /* c8 ignore next 3 */
    // Not reachable, all possible types have been considered.
    (false) || (0, invariant_js_1.invariant)(false, 'Unexpected input type: ' + (0, inspect_js_1.inspect)(type));
}
/**
 * Produces a coerced "internal" JavaScript value given a GraphQL Value AST.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
function coerceInputLiteral(valueNode, type, variableValues, fragmentVariableValues, hideSuggestions) {
    if (valueNode.kind === kinds_js_1.Kind.VARIABLE) {
        const coercedVariableValue = getCoercedVariableValue(valueNode, variableValues, fragmentVariableValues);
        if (coercedVariableValue == null && (0, definition_js_1.isNonNullType)(type)) {
            return; // Invalid: intentionally return no value.
        }
        // Note: This does no further checking that this variable is correct.
        // This assumes validated has checked this variable is of the correct type.
        return coercedVariableValue;
    }
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (valueNode.kind === kinds_js_1.Kind.NULL) {
            return; // Invalid: intentionally return no value.
        }
        return coerceInputLiteral(valueNode, type.ofType, variableValues, fragmentVariableValues, hideSuggestions);
    }
    if (valueNode.kind === kinds_js_1.Kind.NULL) {
        return null; // Explicitly return the value null.
    }
    if ((0, definition_js_1.isListType)(type)) {
        if (valueNode.kind !== kinds_js_1.Kind.LIST) {
            // Lists accept a non-list value as a list of one.
            const itemValue = coerceInputLiteral(valueNode, type.ofType, variableValues, fragmentVariableValues, hideSuggestions);
            if (itemValue === undefined) {
                return; // Invalid: intentionally return no value.
            }
            return [itemValue];
        }
        const coercedValue = [];
        for (const itemNode of valueNode.values) {
            let itemValue = coerceInputLiteral(itemNode, type.ofType, variableValues, fragmentVariableValues, hideSuggestions);
            if (itemValue === undefined) {
                if (itemNode.kind === kinds_js_1.Kind.VARIABLE &&
                    getCoercedVariableValue(itemNode, variableValues, fragmentVariableValues) == null &&
                    !(0, definition_js_1.isNonNullType)(type.ofType)) {
                    // A missing variable within a list is coerced to null.
                    itemValue = null;
                }
                else {
                    return; // Invalid: intentionally return no value.
                }
            }
            coercedValue.push(itemValue);
        }
        return coercedValue;
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
        if (valueNode.kind !== kinds_js_1.Kind.OBJECT) {
            return; // Invalid: intentionally return no value.
        }
        const coercedValue = {};
        const fieldDefs = type.getFields();
        const hasUndefinedField = valueNode.fields.some((field) => !Object.hasOwn(fieldDefs, field.name.value));
        if (hasUndefinedField) {
            return; // Invalid: intentionally return no value.
        }
        const fieldNodes = new Map(valueNode.fields.map((field) => [field.name.value, field]));
        for (const field of Object.values(fieldDefs)) {
            const fieldNode = fieldNodes.get(field.name);
            if (!fieldNode ||
                (fieldNode.value.kind === kinds_js_1.Kind.VARIABLE &&
                    getCoercedVariableValue(fieldNode.value, variableValues, fragmentVariableValues) == null)) {
                if ((0, definition_js_1.isRequiredInputField)(field)) {
                    return; // Invalid: intentionally return no value.
                }
                if (field.defaultValue) {
                    coercedValue[field.name] = coerceDefaultValue(field.defaultValue, field.type, hideSuggestions);
                }
            }
            else {
                const fieldValue = coerceInputLiteral(fieldNode.value, field.type, variableValues, fragmentVariableValues, hideSuggestions);
                if (fieldValue === undefined) {
                    return; // Invalid: intentionally return no value.
                }
                coercedValue[field.name] = fieldValue;
            }
        }
        if (type.isOneOf) {
            const keys = Object.keys(coercedValue);
            if (keys.length !== 1) {
                return; // Invalid: not exactly one key, intentionally return no value.
            }
            if (coercedValue[keys[0]] === null) {
                return; // Invalid: value not non-null, intentionally return no value.
            }
        }
        return coercedValue;
    }
    const leafType = (0, definition_js_1.assertLeafType)(type);
    try {
        return leafType.coerceInputLiteral
            ? leafType.coerceInputLiteral((0, replaceVariables_js_1.replaceVariables)(valueNode, variableValues, fragmentVariableValues), hideSuggestions)
            : leafType.parseLiteral(valueNode, variableValues?.coerced, hideSuggestions);
    }
    catch (_error) {
        // Invalid: ignore error and intentionally return no value.
    }
}
exports.coerceInputLiteral = coerceInputLiteral;
// Retrieves the variable value for the given variable node.
function getCoercedVariableValue(variableNode, variableValues, fragmentVariableValues) {
    const varName = variableNode.name.value;
    if (fragmentVariableValues?.sources[varName] !== undefined) {
        return fragmentVariableValues.coerced[varName];
    }
    return variableValues?.coerced[varName];
}
/**
 * @internal
 */
function coerceDefaultValue(defaultValue, type, hideSuggestions) {
    // Memoize the result of coercing the default value in a hidden field.
    let coercedValue = defaultValue._memoizedCoercedValue;
    if (coercedValue === undefined) {
        coercedValue = defaultValue.literal
            ? coerceInputLiteral(defaultValue.literal, type, undefined, undefined, hideSuggestions)
            : defaultValue.value;
        defaultValue._memoizedCoercedValue = coercedValue;
    }
    return coercedValue;
}
exports.coerceDefaultValue = coerceDefaultValue;
