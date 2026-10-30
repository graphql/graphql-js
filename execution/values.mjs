import { invariant } from "../jsutils/invariant.mjs";
import { printPathArray } from "../jsutils/printPathArray.mjs";
import { ensureGraphQLError } from "../error/ensureGraphQLError.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { Kind } from "../language/kinds.mjs";
import { isArgument, isNonNullType, isRequiredArgument, } from "../type/definition.mjs";
import { validateDefaultInput } from "../type/validate.mjs";
import { coerceDefaultValue, coerceInputLiteral, coerceInputValue, } from "../utilities/coerceInputValue.mjs";
import { validateInputLiteral, validateInputValue, } from "../utilities/validateInputValue.mjs";
import { getVariableSignature } from "./getVariableSignature.mjs";
export function getVariableValues(schema, varDefNodes, inputs, options) {
    const errors = [];
    const maxErrors = options?.maxErrors;
    try {
        const variableValues = coerceVariableValues(schema, varDefNodes, inputs, (error) => {
            if (maxErrors != null && errors.length >= maxErrors) {
                throw new GraphQLError('Too many errors processing variables, error limit reached. Execution aborted.');
            }
            errors.push(error);
        }, options?.hideSuggestions);
        if (errors.length === 0) {
            return { variableValues };
        }
    }
    catch (error) {
        errors.push(ensureGraphQLError(error));
    }
    return { errors };
}
function coerceVariableValues(schema, varDefNodes, inputs, onError, hideSuggestions) {
    const sources = Object.create(null);
    const coerced = Object.create(null);
    for (const varDefNode of varDefNodes) {
        const varSignature = getVariableSignature(schema, varDefNode);
        if (varSignature instanceof GraphQLError) {
            onError(varSignature);
            continue;
        }
        const { name: varName, type: varType } = varSignature;
        const value = Object.hasOwn(inputs, varName) ? inputs[varName] : undefined;
        if (value === undefined) {
            sources[varName] = { signature: varSignature };
            if (varDefNode.defaultValue) {
                maybeUseDefaultValue(coerced, varName, varSignature, (error, path) => {
                    onError(new GraphQLError(`Variable "$${varName}" has invalid default value${printPathArray(path)}: ${error.message}`, { nodes: varDefNode }));
                }, hideSuggestions);
                continue;
            }
            else if (!isNonNullType(varType)) {
                continue;
            }
        }
        else {
            sources[varName] = { signature: varSignature, value };
        }
        const coercedValue = coerceInputValue(value, varType);
        if (coercedValue !== undefined) {
            coerced[varName] = coercedValue;
        }
        else {
            validateInputValue(value, varType, (error, path) => {
                onError(new GraphQLError(`Variable "$${varName}" has invalid value${printPathArray(path)}: ${error.message}`, { nodes: varDefNode, originalError: error }));
            }, hideSuggestions);
        }
    }
    return { sources, coerced };
}
function maybeUseDefaultValue(coercedValues, name, inputValue, onError, hideSuggestions) {
    try {
        const coercedDefaultValue = coerceDefaultValue(inputValue);
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
        validateDefaultInput(defaultInput, inputValue.type, (defaultError, path) => {
            reportedValidationError = true;
            onError(defaultError, path);
        }, hideSuggestions);
        if (!reportedValidationError) {
            onError(ensureGraphQLError(error), []);
        }
    }
}
export function getFragmentVariableValues(fragmentSpreadNode, fragmentSignatures, variableValues, fragmentVariableValues, hideSuggestions) {
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
export function getArgumentValues(def, node, variableValues, fragmentVariableValues, hideSuggestions) {
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
        throw new GraphQLError(`${printArgumentOrFragmentVariable(argDef, node)} has invalid default value${printPathArray(path)}: ${error.message}`, { nodes: node });
    };
    if (!argumentNode) {
        if (isRequiredArgument(argDef)) {
            throw new GraphQLError(`${printArgumentOrFragmentVariable(argDef, node)} of required type "${argType}" was not provided.`, { nodes: node });
        }
        maybeUseDefaultValue(coercedValues, argName, argDef, onArgDefaultValueError, hideSuggestions);
        return;
    }
    const valueNode = argumentNode.value;
    if (valueNode.kind === Kind.VARIABLE) {
        const variableName = valueNode.name.value;
        const scopedVariableValues = fragmentVariableValues?.sources[variableName]
            ? fragmentVariableValues
            : variableValues;
        if ((scopedVariableValues == null ||
            !Object.hasOwn(scopedVariableValues.coerced, variableName)) &&
            !isRequiredArgument(argDef)) {
            maybeUseDefaultValue(coercedValues, argName, argDef, onArgDefaultValueError, hideSuggestions);
            return;
        }
    }
    const coercedValue = coerceInputLiteral(valueNode, argType, variableValues, fragmentVariableValues);
    if (coercedValue === undefined) {
        validateInputLiteral(valueNode, argType, (error, path) => {
            error.message = `${printArgumentOrFragmentVariable(argDef, node)} has invalid value${printPathArray(path)}: ${error.message}`;
            throw error;
        }, variableValues, fragmentVariableValues, hideSuggestions);
        invariant(false, 'Invalid argument');
    }
    coercedValues[argName] = coercedValue;
}
function printArgumentOrFragmentVariable(argDef, node) {
    return isArgument(argDef)
        ? `Argument "${argDef}"`
        : `Variable "$${argDef.name}" defined by fragment "${node.name.value}"`;
}
export function getDirectiveValues(directiveDef, node, variableValues, fragmentVariableValues, hideSuggestions) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === directiveDef.name);
    if (directiveNode) {
        return getArgumentValues(directiveDef, directiveNode, variableValues, fragmentVariableValues, hideSuggestions);
    }
}
//# sourceMappingURL=values.js.map