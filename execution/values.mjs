import { invariant } from "../jsutils/invariant.mjs";
import { printPathArray } from "../jsutils/printPathArray.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { Kind } from "../language/kinds.mjs";
import { isArgument, isNonNullType, isRequiredArgument, } from "../type/definition.mjs";
import { coerceDefaultValue, coerceInputLiteral, coerceInputValue, } from "../utilities/coerceInputValue.mjs";
import { validateInputLiteral, validateInputValue, } from "../utilities/validateInputValue.mjs";
import { getVariableSignature } from "./getVariableSignature.mjs";
/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
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
        errors.push(error);
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
        let value;
        if (!Object.hasOwn(inputs, varName)) {
            sources[varName] = { signature: varSignature };
            if (varDefNode.defaultValue) {
                coerced[varName] = coerceInputLiteral(varDefNode.defaultValue, varType);
                continue;
            }
            else if (!isNonNullType(varType)) {
                // Non-provided values for nullable variables are omitted.
                continue;
            }
        }
        else {
            value = inputs[varName];
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
export function getFragmentVariableValues(fragmentSpreadNode, fragmentSignatures, variableValues, fragmentVariableValues, hideSuggestions) {
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
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getArgumentValues(def, node, variableValues, hideSuggestions) {
    return experimentalGetArgumentValues(node, def.args, variableValues, undefined, hideSuggestions);
}
export function experimentalGetArgumentValues(node, argDefs, variableValues, fragmentVariableValues, hideSuggestions) {
    const coercedValues = {};
    const argumentNodes = node.arguments ?? [];
    const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
    for (const argDef of argDefs) {
        const name = argDef.name;
        const argType = argDef.type;
        const argumentNode = argNodeMap.get(name);
        if (!argumentNode) {
            if (isRequiredArgument(argDef)) {
                // Note: ProvidedRequiredArgumentsRule validation should catch this before
                // execution. This is a runtime check to ensure execution does not
                // continue with an invalid argument value.
                throw new GraphQLError(
                // TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
                `Argument "${isArgument(argDef) ? argDef : argDef.name}" of required type "${argType}" was not provided.`, { nodes: node });
            }
            if (argDef.defaultValue) {
                coercedValues[name] = coerceDefaultValue(argDef.defaultValue, argDef.type);
            }
            continue;
        }
        const valueNode = argumentNode.value;
        // Variables without a value are treated as if no argument was provided if
        // the argument is not required.
        if (valueNode.kind === Kind.VARIABLE) {
            const variableName = valueNode.name.value;
            const scopedVariableValues = fragmentVariableValues?.sources[variableName]
                ? fragmentVariableValues
                : variableValues;
            if ((scopedVariableValues == null ||
                !Object.hasOwn(scopedVariableValues.coerced, variableName)) &&
                !isRequiredArgument(argDef)) {
                if (argDef.defaultValue) {
                    coercedValues[name] = coerceDefaultValue(argDef.defaultValue, argDef.type);
                }
                continue;
            }
        }
        const coercedValue = coerceInputLiteral(valueNode, argType, variableValues, fragmentVariableValues);
        if (coercedValue === undefined) {
            // Note: ValuesOfCorrectTypeRule validation should catch this before
            // execution. This is a runtime check to ensure execution does not
            // continue with an invalid argument value.
            validateInputLiteral(valueNode, argType, (error, path) => {
                // TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
                error.message = `Argument "${isArgument(argDef) ? argDef : argDef.name}" has invalid value${printPathArray(path)}: ${error.message}`;
                throw error;
            }, variableValues, fragmentVariableValues, hideSuggestions);
            /* c8 ignore next */
            (false) || invariant(false, 'Invalid argument');
        }
        coercedValues[name] = coercedValue;
    }
    return coercedValues;
}
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
export function getDirectiveValues(directiveDef, node, variableValues, fragmentVariableValues, hideSuggestions) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === directiveDef.name);
    if (directiveNode) {
        return experimentalGetArgumentValues(directiveNode, directiveDef.args, variableValues, fragmentVariableValues, hideSuggestions);
    }
}
//# sourceMappingURL=values.js.map