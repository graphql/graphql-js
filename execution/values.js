"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariableValues = getVariableValues;
exports.getFragmentVariableValues = getFragmentVariableValues;
exports.getArgumentValues = getArgumentValues;
exports.getDirectiveValues = getDirectiveValues;
const invariant_ts_1 = require("../jsutils/invariant.js");
const printPathArray_ts_1 = require("../jsutils/printPathArray.js");
const ensureGraphQLError_ts_1 = require("../error/ensureGraphQLError.js");
const GraphQLError_ts_1 = require("../error/GraphQLError.js");
const kinds_ts_1 = require("../language/kinds.js");
const definition_ts_1 = require("../type/definition.js");
const validate_ts_1 = require("../type/validate.js");
const coerceInputValue_ts_1 = require("../utilities/coerceInputValue.js");
const validateInputValue_ts_1 = require("../utilities/validateInputValue.js");
const getVariableSignature_ts_1 = require("./getVariableSignature.js");
function getVariableValues(schema, varDefNodes, inputs, options) {
    const errors = [];
    const maxErrors = options?.maxErrors;
    try {
        const variableValues = coerceVariableValues(schema, varDefNodes, inputs, (error) => {
            if (maxErrors != null && errors.length >= maxErrors) {
                throw new GraphQLError_ts_1.GraphQLError('Too many errors processing variables, error limit reached. Execution aborted.');
            }
            errors.push(error);
        }, options?.hideSuggestions);
        if (errors.length === 0) {
            return { variableValues };
        }
    }
    catch (error) {
        errors.push((0, ensureGraphQLError_ts_1.ensureGraphQLError)(error));
    }
    return { errors };
}
function coerceVariableValues(schema, varDefNodes, inputs, onError, hideSuggestions) {
    const sources = Object.create(null);
    const coerced = Object.create(null);
    for (const varDefNode of varDefNodes) {
        const varSignature = (0, getVariableSignature_ts_1.getVariableSignature)(schema, varDefNode);
        if (varSignature instanceof GraphQLError_ts_1.GraphQLError) {
            onError(varSignature);
            continue;
        }
        const { name: varName, type: varType } = varSignature;
        const value = Object.hasOwn(inputs, varName) ? inputs[varName] : undefined;
        if (value === undefined) {
            sources[varName] = { signature: varSignature };
            if (varDefNode.defaultValue) {
                maybeUseDefaultValue(coerced, varName, varSignature, (error, path) => {
                    onError(new GraphQLError_ts_1.GraphQLError(`Variable "$${varName}" has invalid default value${(0, printPathArray_ts_1.printPathArray)(path)}: ${error.message}`, { nodes: varDefNode }));
                }, hideSuggestions);
                continue;
            }
            else if (!(0, definition_ts_1.isNonNullType)(varType)) {
                continue;
            }
        }
        else {
            sources[varName] = { signature: varSignature, value };
        }
        const coercedValue = (0, coerceInputValue_ts_1.coerceInputValue)(value, varType);
        if (coercedValue !== undefined) {
            coerced[varName] = coercedValue;
        }
        else {
            (0, validateInputValue_ts_1.validateInputValue)(value, varType, (error, path) => {
                onError(new GraphQLError_ts_1.GraphQLError(`Variable "$${varName}" has invalid value${(0, printPathArray_ts_1.printPathArray)(path)}: ${error.message}`, { nodes: varDefNode, originalError: error }));
            }, hideSuggestions);
        }
    }
    return { sources, coerced };
}
function maybeUseDefaultValue(coercedValues, name, inputValue, onError, hideSuggestions) {
    try {
        const coercedDefaultValue = (0, coerceInputValue_ts_1.coerceDefaultValue)(inputValue);
        if (coercedDefaultValue !== undefined) {
            coercedValues[name] = coercedDefaultValue;
        }
    }
    catch (error) {
        const defaultInput = inputValue.default;
        if (defaultInput === undefined) {
            throw error;
        }
        let reportedValidationError = false;
        (0, validate_ts_1.validateDefaultInput)(defaultInput, inputValue.type, (defaultError, path) => {
            reportedValidationError = true;
            onError(defaultError, path);
        }, hideSuggestions);
        if (!reportedValidationError) {
            onError((0, ensureGraphQLError_ts_1.ensureGraphQLError)(error), []);
        }
    }
}
function getFragmentVariableValues(fragmentSpreadNode, fragmentSignatures, variableValues, fragmentVariableValues, hideSuggestions) {
    const argumentNodes = fragmentSpreadNode.arguments ?? [];
    const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
    const sources = Object.create(null);
    const coerced = Object.create(null);
    for (const [varName, varSignature] of Object.entries(fragmentSignatures)) {
        const argumentNode = argNodeMap.get(varName);
        if (argumentNode !== undefined) {
            sources[varName] =
                fragmentVariableValues == null
                    ? { signature: varSignature, value: argumentNode.value }
                    : {
                        signature: varSignature,
                        value: argumentNode.value,
                        fragmentVariableValues,
                    };
        }
        else {
            sources[varName] = {
                signature: varSignature,
            };
        }
        coerceArgument(coerced, fragmentSpreadNode, varName, varSignature, argumentNode, variableValues, fragmentVariableValues, hideSuggestions);
    }
    return { sources, coerced };
}
function getArgumentValues(def, node, variableValues, fragmentVariableValues, hideSuggestions) {
    const coercedValues = Object.create(null);
    if (def.args.length === 0) {
        return coercedValues;
    }
    const argumentNodes = node.arguments ?? [];
    const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
    for (const argDef of def.args) {
        const name = argDef.name;
        coerceArgument(coercedValues, node, name, argDef, argNodeMap.get(argDef.name), variableValues, fragmentVariableValues, hideSuggestions);
    }
    return coercedValues;
}
function coerceArgument(coercedValues, node, argName, argDef, argumentNode, variableValues, fragmentVariableValues, hideSuggestions) {
    const argType = argDef.type;
    const onArgDefaultValueError = (error, path) => {
        throw new GraphQLError_ts_1.GraphQLError(`${printArgumentOrFragmentVariable(argDef, node)} has invalid default value${(0, printPathArray_ts_1.printPathArray)(path)}: ${error.message}`, { nodes: node });
    };
    if (!argumentNode) {
        if ((0, definition_ts_1.isRequiredArgument)(argDef)) {
            throw new GraphQLError_ts_1.GraphQLError(`${printArgumentOrFragmentVariable(argDef, node)} of required type "${argType}" was not provided.`, { nodes: node });
        }
        maybeUseDefaultValue(coercedValues, argName, argDef, onArgDefaultValueError, hideSuggestions);
        return;
    }
    const valueNode = argumentNode.value;
    if (valueNode.kind === kinds_ts_1.Kind.VARIABLE) {
        const variableName = valueNode.name.value;
        const scopedVariableValues = fragmentVariableValues?.sources[variableName]
            ? fragmentVariableValues
            : variableValues;
        if ((scopedVariableValues == null ||
            !Object.hasOwn(scopedVariableValues.coerced, variableName)) &&
            !(0, definition_ts_1.isRequiredArgument)(argDef)) {
            maybeUseDefaultValue(coercedValues, argName, argDef, onArgDefaultValueError, hideSuggestions);
            return;
        }
    }
    const coercedValue = (0, coerceInputValue_ts_1.coerceInputLiteral)(valueNode, argType, variableValues, fragmentVariableValues);
    if (coercedValue === undefined) {
        (0, validateInputValue_ts_1.validateInputLiteral)(valueNode, argType, (error, path) => {
            error.message = `${printArgumentOrFragmentVariable(argDef, node)} has invalid value${(0, printPathArray_ts_1.printPathArray)(path)}: ${error.message}`;
            throw error;
        }, variableValues, fragmentVariableValues, hideSuggestions);
        (0, invariant_ts_1.invariant)(false, 'Invalid argument');
    }
    coercedValues[argName] = coercedValue;
}
function printArgumentOrFragmentVariable(argDef, node) {
    return (0, definition_ts_1.isArgument)(argDef)
        ? `Argument "${argDef}"`
        : `Variable "$${argDef.name}" defined by fragment "${node.name.value}"`;
}
function getDirectiveValues(directiveDef, node, variableValues, fragmentVariableValues, hideSuggestions) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === directiveDef.name);
    if (directiveNode) {
        return getArgumentValues(directiveDef, directiveNode, variableValues, fragmentVariableValues, hideSuggestions);
    }
}
//# sourceMappingURL=values.js.map