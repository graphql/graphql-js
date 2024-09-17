import { inspect } from "../jsutils/inspect.mjs";
import { printPathArray } from "../jsutils/printPathArray.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { Kind } from "../language/kinds.mjs";
import { print } from "../language/printer.mjs";
import { isNonNullType } from "../type/definition.mjs";
import { coerceInputLiteral, coerceInputValue, } from "../utilities/coerceInputValue.mjs";
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
        const coerced = coerceVariableValues(schema, varDefNodes, inputs, (error) => {
            if (maxErrors != null && errors.length >= maxErrors) {
                throw new GraphQLError('Too many errors processing variables, error limit reached. Execution aborted.');
            }
            errors.push(error);
        });
        if (errors.length === 0) {
            return { coerced };
        }
    }
    catch (error) {
        errors.push(error);
    }
    return { errors };
}
function coerceVariableValues(schema, varDefNodes, inputs, onError) {
    const coercedValues = {};
    for (const varDefNode of varDefNodes) {
        const varSignature = getVariableSignature(schema, varDefNode);
        if (varSignature instanceof GraphQLError) {
            onError(varSignature);
            continue;
        }
        const { name: varName, type: varType } = varSignature;
        if (!Object.hasOwn(inputs, varName)) {
            if (varDefNode.defaultValue) {
                coercedValues[varName] = varSignature.defaultValue;
            }
            else if (isNonNullType(varType)) {
                const varTypeStr = inspect(varType);
                onError(new GraphQLError(`Variable "$${varName}" of required type "${varTypeStr}" was not provided.`, { nodes: varDefNode }));
            }
            continue;
        }
        const value = inputs[varName];
        if (value === null && isNonNullType(varType)) {
            const varTypeStr = inspect(varType);
            onError(new GraphQLError(`Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`, { nodes: varDefNode }));
            continue;
        }
        coercedValues[varName] = coerceInputValue(value, varType, (path, invalidValue, error) => {
            let prefix = `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
            if (path.length > 0) {
                prefix += ` at "${varName}${printPathArray(path)}"`;
            }
            onError(new GraphQLError(prefix + '; ' + error.message, {
                nodes: varDefNode,
                originalError: error,
            }));
        });
    }
    return coercedValues;
}
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getArgumentValues(def, node, variableValues) {
    return experimentalGetArgumentValues(node, def.args, variableValues);
}
export function experimentalGetArgumentValues(node, argDefs, variableValues, fragmentVariables) {
    const coercedValues = {};
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const argumentNodes = node.arguments ?? [];
    const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
    for (const argDef of argDefs) {
        const name = argDef.name;
        const argType = argDef.type;
        const argumentNode = argNodeMap.get(name);
        if (argumentNode == null) {
            if (argDef.defaultValue !== undefined) {
                coercedValues[name] = argDef.defaultValue;
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
            const scopedVariableValues = fragmentVariables?.signatures[variableName]
                ? fragmentVariables.values
                : variableValues;
            if (scopedVariableValues == null ||
                !Object.hasOwn(scopedVariableValues, variableName)) {
                if (argDef.defaultValue !== undefined) {
                    coercedValues[name] = argDef.defaultValue;
                }
                else if (isNonNullType(argType)) {
                    throw new GraphQLError(`Argument "${name}" of required type "${inspect(argType)}" ` +
                        `was provided the variable "$${variableName}" which was not provided a runtime value.`, { nodes: valueNode });
                }
                continue;
            }
            isNull = scopedVariableValues[variableName] == null;
        }
        if (isNull && isNonNullType(argType)) {
            throw new GraphQLError(`Argument "${name}" of non-null type "${inspect(argType)}" ` +
                'must not be null.', { nodes: valueNode });
        }
        const coercedValue = coerceInputLiteral(valueNode, argType, variableValues, fragmentVariables);
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
export function getDirectiveValues(directiveDef, node, variableValues, fragmentVariables) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === directiveDef.name);
    if (directiveNode) {
        return experimentalGetArgumentValues(directiveNode, directiveDef.args, variableValues, fragmentVariables);
    }
}
