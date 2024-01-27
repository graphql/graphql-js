import { inspect } from '../jsutils/inspect.js';
import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { printPathArray } from '../jsutils/printPathArray.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type {
  DirectiveNode,
  FieldNode,
  FragmentSpreadNode,
  VariableDefinitionNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import { print } from '../language/printer.js';

import type { GraphQLArgument } from '../type/definition.js';
import { isInputType, isNonNullType } from '../type/definition.js';
import type { GraphQLDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { coerceInputValue } from '../utilities/coerceInputValue.js';
import { typeFromAST } from '../utilities/typeFromAST.js';
import { valueFromAST } from '../utilities/valueFromAST.js';
import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped.js';

type CoercedVariableValues =
  | { errors: ReadonlyArray<GraphQLError>; coerced?: never }
  | { coerced: { [variable: string]: unknown }; errors?: never };

/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  options?: { maxErrors?: number },
): CoercedVariableValues {
  const errors = [];
  const maxErrors = options?.maxErrors;
  try {
    const coerced = coerceVariableValues(
      schema,
      varDefNodes,
      inputs,
      (error) => {
        if (maxErrors != null && errors.length >= maxErrors) {
          throw new GraphQLError(
            'Too many errors processing variables, error limit reached. Execution aborted.',
          );
        }
        errors.push(error);
      },
    );

    if (errors.length === 0) {
      return { coerced };
    }
  } catch (error) {
    errors.push(error);
  }

  return { errors };
}

/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
function coerceVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): { [variable: string]: unknown } {
  const coercedValues: { [variable: string]: unknown } = {};
  for (const varDefNode of varDefNodes) {
    const varName = varDefNode.variable.name.value;
    const varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
      // Must use input types for variables. This should be caught during
      // validation, however is checked again here for safety.
      const varTypeStr = print(varDefNode.type);
      onError(
        new GraphQLError(
          `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
          { nodes: varDefNode.type },
        ),
      );
      continue;
    }

    if (!Object.hasOwn(inputs, varName)) {
      if (varDefNode.defaultValue) {
        coercedValues[varName] = valueFromAST(varDefNode.defaultValue, varType);
      } else if (isNonNullType(varType)) {
        const varTypeStr = inspect(varType);
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
            { nodes: varDefNode },
          ),
        );
      }
      continue;
    }

    const value = inputs[varName];
    if (value === null && isNonNullType(varType)) {
      const varTypeStr = inspect(varType);
      onError(
        new GraphQLError(
          `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
          { nodes: varDefNode },
        ),
      );
      continue;
    }

    coercedValues[varName] = coerceInputValue(
      value,
      varType,
      (path, invalidValue, error) => {
        let prefix =
          `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
        if (path.length > 0) {
          prefix += ` at "${varName}${printPathArray(path)}"`;
        }
        onError(
          new GraphQLError(prefix + '; ' + error.message, {
            nodes: varDefNode,
            originalError: error,
          }),
        );
      },
    );
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
export function getArgumentValues(
  node: FieldNode | DirectiveNode,
  argDefs: ReadonlyArray<GraphQLArgument>,
  variableValues: Maybe<ObjMap<unknown>>,
  fragmentArgValues?: Maybe<ObjMap<unknown>>,
): { [argument: string]: unknown } {
  const coercedValues: { [argument: string]: unknown } = {};
  const argNodeMap = new Map(
    node.arguments?.map((arg) => [arg.name.value, arg]),
  );

  for (const argDef of argDefs) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap.get(name);

    if (argumentNode == null) {
      if (argDef.defaultValue !== undefined) {
        coercedValues[name] = argDef.defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${inspect(argType)}" ` +
            'was not provided.',
          { nodes: node },
        );
      }
      continue;
    }

    const valueNode = argumentNode.value;

    let hasValue = valueNode.kind !== Kind.NULL;
    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        fragmentArgValues != null &&
        Object.hasOwn(fragmentArgValues, variableName)
      ) {
        hasValue = fragmentArgValues[variableName] != null;
        if (!hasValue && argDef.defaultValue !== undefined) {
          coercedValues[name] = argDef.defaultValue;
          continue;
        }
      } else if (
        variableValues != null &&
        Object.hasOwn(variableValues, variableName)
      ) {
        hasValue = variableValues[variableName] != null;
      } else if (argDef.defaultValue !== undefined) {
        coercedValues[name] = argDef.defaultValue;
        continue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${inspect(argType)}" ` +
            `was provided the variable "$${variableName}" which was not provided a runtime value.`,
          { nodes: valueNode },
        );
      } else {
        continue;
      }
    }

    if (!hasValue && isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${inspect(argType)}" ` +
          'must not be null.',
        { nodes: valueNode },
      );
    }

    // TODO: Make this follow the spec more closely
    const coercedValue = valueFromAST(valueNode, argType, {
      ...variableValues,
      ...fragmentArgValues,
    });

    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        { nodes: valueNode },
      );
    }
    coercedValues[name] = coercedValue;
  }
  return coercedValues;
}

export function getArgumentValuesFromSpread(
  /** NOTE: For error annotations only */
  node: FragmentSpreadNode,
  schema: GraphQLSchema,
  fragmentVarDefs: ReadonlyArray<VariableDefinitionNode>,
  variableValues: Maybe<ObjMap<unknown>>,
  fragmentArgValues?: Maybe<ObjMap<unknown>>,
): { [argument: string]: unknown } {
  const coercedValues: { [argument: string]: unknown } = {};
  const argNodeMap = new Map(
    node.arguments?.map((arg) => [arg.name.value, arg]),
  );

  for (const varDef of fragmentVarDefs) {
    const name = varDef.variable.name.value;
    const argType = typeFromAST(schema, varDef.type);
    const argumentNode = argNodeMap.get(name);

    if (argumentNode == null) {
      if (varDef.defaultValue !== undefined) {
        coercedValues[name] = valueFromASTUntyped(varDef.defaultValue);
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${inspect(argType)}" ` +
            'was not provided.',
          { nodes: node },
        );
      } else {
        coercedValues[name] = undefined;
      }
      continue;
    }

    const valueNode = argumentNode.value;

    let hasValue = valueNode.kind !== Kind.NULL;
    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        fragmentArgValues != null &&
        Object.hasOwn(fragmentArgValues, variableName)
      ) {
        hasValue = fragmentArgValues[variableName] != null;
      } else if (
        variableValues != null &&
        Object.hasOwn(variableValues, variableName)
      ) {
        hasValue = variableValues[variableName] != null;
      }
    }

    if (!hasValue && isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${inspect(argType)}" ` +
          'must not be null.',
        { nodes: valueNode },
      );
    }

    // TODO: Make this follow the spec more closely
    let coercedValue;
    if (argType && isInputType(argType)) {
      coercedValue = valueFromAST(valueNode, argType, {
        ...variableValues,
        ...fragmentArgValues,
      });
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
export function getDirectiveValues(
  directiveDef: GraphQLDirective,
  node: { readonly directives?: ReadonlyArray<DirectiveNode> | undefined },
  variableValues?: Maybe<ObjMap<unknown>>,
): undefined | { [argument: string]: unknown } {
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );

  if (directiveNode) {
    return getArgumentValues(directiveNode, directiveDef.args, variableValues);
  }
}
