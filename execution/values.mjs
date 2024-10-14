import { inspect } from "../jsutils/inspect.mjs";
import { printPathArray } from "../jsutils/printPathArray.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { Kind } from "../language/kinds.mjs";
import { print } from "../language/printer.mjs";
import { isNonNullType } from "../type/definition.mjs";
import { coerceDefaultValue, coerceInputLiteral, coerceInputValue, } from "../utilities/coerceInputValue.mjs";
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
        if (!Object.hasOwn(inputs, varName)) {
            const defaultValue = varSignature.defaultValue;
            if (defaultValue) {
                sources[varName] = { signature: varSignature };
                coerced[varName] = coerceDefaultValue(defaultValue, varType, hideSuggestions);
            }
            else if (isNonNullType(varType)) {
                const varTypeStr = inspect(varType);
                onError(new GraphQLError(`Variable "$${varName}" of required type "${varTypeStr}" was not provided.`, { nodes: varDefNode }));
            }
            else {
                sources[varName] = { signature: varSignature };
            }
            continue;
        }
        const value = inputs[varName];
        if (value === null && isNonNullType(varType)) {
            const varTypeStr = inspect(varType);
            onError(new GraphQLError(`Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`, { nodes: varDefNode }));
            continue;
        }
        sources[varName] = { signature: varSignature, value };
        coerced[varName] = coerceInputValue(value, varType, (path, invalidValue, error) => {
            let prefix = `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
            if (path.length > 0) {
                prefix += ` at "${varName}${printPathArray(path)}"`;
            }
            onError(new GraphQLError(prefix + '; ' + error.message, {
                nodes: varDefNode,
                originalError: error,
            }));
        }, hideSuggestions);
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
export function experimentalGetArgumentValues(node, argDefs, variableValues, fragmentVariablesValues, hideSuggestions) {
    const coercedValues = {};
    const argumentNodes = node.arguments ?? [];
    const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
    for (const argDef of argDefs) {
        const name = argDef.name;
        const argType = argDef.type;
        const argumentNode = argNodeMap.get(name);
        if (argumentNode == null) {
            if (argDef.defaultValue) {
                coercedValues[name] = coerceDefaultValue(argDef.defaultValue, argDef.type, hideSuggestions);
            }
            else if (isNonNullType(argType)) {
                throw new GraphQLError(`Argument "${name}" of required type "${inspect(argType)}" ` +
                    'was not provided.', { nodes: node });
            }
            continue;
        }
        const valueNode = argumentNode.value;
        let isNull = valueNode.kind === Kind.NULL;
        if (valueNode.kind === Kind.VARIABLE) {
            const variableName = valueNode.name.value;
            const scopedVariableValues = fragmentVariablesValues?.sources[variableName]
                ? fragmentVariablesValues
                : variableValues;
            if (scopedVariableValues == null ||
                !Object.hasOwn(scopedVariableValues.coerced, variableName)) {
                if (argDef.defaultValue) {
                    coercedValues[name] = coerceDefaultValue(argDef.defaultValue, argDef.type, hideSuggestions);
                }
                else if (isNonNullType(argType)) {
                    throw new GraphQLError(`Argument "${name}" of required type "${inspect(argType)}" ` +
                        `was provided the variable "$${variableName}" which was not provided a runtime value.`, { nodes: valueNode });
                }
                continue;
            }
            isNull = scopedVariableValues.coerced[variableName] == null;
        }
        if (isNull && isNonNullType(argType)) {
            throw new GraphQLError(`Argument "${name}" of non-null type "${inspect(argType)}" ` +
                'must not be null.', { nodes: valueNode });
        }
        const coercedValue = coerceInputLiteral(valueNode, argType, variableValues, fragmentVariablesValues, hideSuggestions);
        if (coercedValue === undefined) {
            // Note: ValuesOfCorrectTypeRule validation should catch this before
            // execution. This is a runtime check to ensure execution does not
            // continue with an invalid argument value.
            throw new GraphQLError(`Argument "${name}" of type "${inspect(argType)}" has invalid value ${print(valueNode)}.`, { nodes: valueNode });
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