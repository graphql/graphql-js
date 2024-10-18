"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDirectiveValues = exports.experimentalGetArgumentValues = exports.getArgumentValues = exports.getFragmentVariableValues = exports.getVariableValues = void 0;
const invariant_js_1 = require("../jsutils/invariant.js");
const printPathArray_js_1 = require("../jsutils/printPathArray.js");
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const kinds_js_1 = require("../language/kinds.js");
const definition_js_1 = require("../type/definition.js");
const coerceInputValue_js_1 = require("../utilities/coerceInputValue.js");
const validateInputValue_js_1 = require("../utilities/validateInputValue.js");
const getVariableSignature_js_1 = require("./getVariableSignature.js");
/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
function getVariableValues(schema, varDefNodes, inputs, options) {
    const errors = [];
    const maxErrors = options?.maxErrors;
    try {
        const variableValues = coerceVariableValues(schema, varDefNodes, inputs, (error) => {
            if (maxErrors != null && errors.length >= maxErrors) {
                throw new GraphQLError_js_1.GraphQLError('Too many errors processing variables, error limit reached. Execution aborted.');
            }
            errors.push(error);
        }, options?.hideSuggestions);
        if (errors.length === 0) {
            return { variableValues };
        }
    }
    catch (error) {
        errors.push(error);
    }
    return { errors };
}
exports.getVariableValues = getVariableValues;
function coerceVariableValues(schema, varDefNodes, inputs, onError, hideSuggestions) {
    const sources = Object.create(null);
    const coerced = Object.create(null);
    for (const varDefNode of varDefNodes) {
        const varSignature = (0, getVariableSignature_js_1.getVariableSignature)(schema, varDefNode);
        if (varSignature instanceof GraphQLError_js_1.GraphQLError) {
            onError(varSignature);
            continue;
        }
        const { name: varName, type: varType } = varSignature;
        let value;
        if (!Object.hasOwn(inputs, varName)) {
            sources[varName] = { signature: varSignature };
            if (varDefNode.defaultValue) {
                coerced[varName] = (0, coerceInputValue_js_1.coerceInputLiteral)(varDefNode.defaultValue, varType);
                continue;
            }
            else if (!(0, definition_js_1.isNonNullType)(varType)) {
                // Non-provided values for nullable variables are omitted.
                continue;
            }
        }
        else {
            value = inputs[varName];
            sources[varName] = { signature: varSignature, value };
        }
        const coercedValue = (0, coerceInputValue_js_1.coerceInputValue)(value, varType);
        if (coercedValue !== undefined) {
            coerced[varName] = coercedValue;
        }
        else {
            (0, validateInputValue_js_1.validateInputValue)(value, varType, (error, path) => {
                onError(new GraphQLError_js_1.GraphQLError(`Variable "$${varName}" has invalid value${(0, printPathArray_js_1.printPathArray)(path)}: ${error.message}`, { nodes: varDefNode, originalError: error }));
            }, hideSuggestions);
        }
    }
    return { sources, coerced };
}
function getFragmentVariableValues(fragmentSpreadNode, fragmentSignatures, variableValues, fragmentVariableValues, hideSuggestions) {
    const varSignatures = [];
    const sources = Object.create(null);
    for (const [varName, varSignature] of Object.entries(fragmentSignatures)) {
        varSignatures.push(varSignature);
        sources[varName] = {
            signature: varSignature,
            value: fragmentVariableValues?.sources[varName]?.value ??
                variableValues.sources[varName]?.value,
        };
    }
    const coerced = experimentalGetArgumentValues(fragmentSpreadNode, varSignatures, variableValues, fragmentVariableValues, hideSuggestions);
    return { sources, coerced };
}
exports.getFragmentVariableValues = getFragmentVariableValues;
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
function getArgumentValues(def, node, variableValues, hideSuggestions) {
    return experimentalGetArgumentValues(node, def.args, variableValues, undefined, hideSuggestions);
}
exports.getArgumentValues = getArgumentValues;
function experimentalGetArgumentValues(node, argDefs, variableValues, fragmentVariableValues, hideSuggestions) {
    const coercedValues = {};
    const argumentNodes = node.arguments ?? [];
    const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
    for (const argDef of argDefs) {
        const name = argDef.name;
        const argType = argDef.type;
        const argumentNode = argNodeMap.get(name);
        if (!argumentNode) {
            if ((0, definition_js_1.isRequiredArgument)(argDef)) {
                // Note: ProvidedRequiredArgumentsRule validation should catch this before
                // execution. This is a runtime check to ensure execution does not
                // continue with an invalid argument value.
                throw new GraphQLError_js_1.GraphQLError(`Argument "${argDef.name}" of required type "${argType}" was not provided.`, { nodes: node });
            }
            if (argDef.defaultValue) {
                coercedValues[name] = (0, coerceInputValue_js_1.coerceDefaultValue)(argDef.defaultValue, argDef.type);
            }
            continue;
        }
        const valueNode = argumentNode.value;
        // Variables without a value are treated as if no argument was provided if
        // the argument is not required.
        if (valueNode.kind === kinds_js_1.Kind.VARIABLE) {
            const variableName = valueNode.name.value;
            const scopedVariableValues = fragmentVariableValues?.sources[variableName]
                ? fragmentVariableValues
                : variableValues;
            if ((scopedVariableValues == null ||
                !Object.hasOwn(scopedVariableValues.coerced, variableName)) &&
                !(0, definition_js_1.isRequiredArgument)(argDef)) {
                if (argDef.defaultValue) {
                    coercedValues[name] = (0, coerceInputValue_js_1.coerceDefaultValue)(argDef.defaultValue, argDef.type);
                }
                continue;
            }
        }
        const coercedValue = (0, coerceInputValue_js_1.coerceInputLiteral)(valueNode, argType, variableValues, fragmentVariableValues);
        if (coercedValue === undefined) {
            // Note: ValuesOfCorrectTypeRule validation should catch this before
            // execution. This is a runtime check to ensure execution does not
            // continue with an invalid argument value.
            (0, validateInputValue_js_1.validateInputLiteral)(valueNode, argType, (error, path) => {
                error.message = `Argument "${argDef.name}" has invalid value${(0, printPathArray_js_1.printPathArray)(path)}: ${error.message}`;
                throw error;
            }, variableValues, fragmentVariableValues, hideSuggestions);
            /* c8 ignore next */
            (false) || (0, invariant_js_1.invariant)(false, 'Invalid argument');
        }
        coercedValues[name] = coercedValue;
    }
    return coercedValues;
}
exports.experimentalGetArgumentValues = experimentalGetArgumentValues;
/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
function getDirectiveValues(directiveDef, node, variableValues, fragmentVariableValues, hideSuggestions) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === directiveDef.name);
    if (directiveNode) {
        return experimentalGetArgumentValues(directiveNode, directiveDef.args, variableValues, fragmentVariableValues, hideSuggestions);
    }
}
exports.getDirectiveValues = getDirectiveValues;
//# sourceMappingURL=values.js.map