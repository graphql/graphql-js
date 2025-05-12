import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap, ReadOnlyObjMap } from '../jsutils/ObjMap.ts';
import { printPathArray } from '../jsutils/printPathArray.ts';
import { GraphQLError } from '../error/GraphQLError.ts';
import type {
  ArgumentNode,
  DirectiveNode,
  FieldNode,
  FragmentArgumentNode,
  FragmentSpreadNode,
  VariableDefinitionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type { GraphQLArgument, GraphQLField } from '../type/definition.ts';
import {
  isArgument,
  isNonNullType,
  isRequiredArgument,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import {
  coerceDefaultValue,
  coerceInputLiteral,
  coerceInputValue,
} from '../utilities/coerceInputValue.ts';
import {
  validateInputLiteral,
  validateInputValue,
} from '../utilities/validateInputValue.ts';
import type { FragmentVariableValues } from './collectFields.ts';
import type { GraphQLVariableSignature } from './getVariableSignature.ts';
import { getVariableSignature } from './getVariableSignature.ts';
export interface VariableValues {
  readonly sources: ReadOnlyObjMap<VariableValueSource>;
  readonly coerced: ReadOnlyObjMap<unknown>;
}
interface VariableValueSource {
  readonly signature: GraphQLVariableSignature;
  readonly value?: unknown;
}
type VariableValuesOrErrors =
  | {
      variableValues: VariableValues;
      errors?: never;
    }
  | {
      errors: ReadonlyArray<GraphQLError>;
      variableValues?: never;
    };
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
  inputs: {
    readonly [variable: string]: unknown;
  },
  options?: {
    maxErrors?: number;
    hideSuggestions?: boolean;
  },
): VariableValuesOrErrors {
  const errors: Array<GraphQLError> = [];
  const maxErrors = options?.maxErrors;
  try {
    const variableValues = coerceVariableValues(
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
      options?.hideSuggestions,
    );
    if (errors.length === 0) {
      return { variableValues };
    }
  } catch (error) {
    errors.push(error);
  }
  return { errors };
}
function coerceVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: {
    readonly [variable: string]: unknown;
  },
  onError: (error: GraphQLError) => void,
  hideSuggestions?: Maybe<boolean>,
): VariableValues {
  const sources: ObjMap<VariableValueSource> = Object.create(null);
  const coerced: ObjMap<unknown> = Object.create(null);
  for (const varDefNode of varDefNodes) {
    const varSignature = getVariableSignature(schema, varDefNode);
    if (varSignature instanceof GraphQLError) {
      onError(varSignature);
      continue;
    }
    const { name: varName, type: varType } = varSignature;
    let value: unknown;
    if (!Object.hasOwn(inputs, varName)) {
      sources[varName] = { signature: varSignature };
      if (varDefNode.defaultValue) {
        coerced[varName] = coerceInputLiteral(varDefNode.defaultValue, varType);
        continue;
      } else if (!isNonNullType(varType)) {
        // Non-provided values for nullable variables are omitted.
        continue;
      }
    } else {
      value = inputs[varName];
      sources[varName] = { signature: varSignature, value };
    }
    const coercedValue = coerceInputValue(value, varType);
    if (coercedValue !== undefined) {
      coerced[varName] = coercedValue;
    } else {
      validateInputValue(
        value,
        varType,
        (error, path) => {
          onError(
            new GraphQLError(
              `Variable "$${varName}" has invalid value${printPathArray(path)}: ${error.message}`,
              { nodes: varDefNode, originalError: error },
            ),
          );
        },
        hideSuggestions,
      );
    }
  }
  return { sources, coerced };
}
export function getFragmentVariableValues(
  fragmentSpreadNode: FragmentSpreadNode,
  fragmentSignatures: ReadOnlyObjMap<GraphQLVariableSignature>,
  variableValues: VariableValues,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): FragmentVariableValues {
  const argumentNodes = fragmentSpreadNode.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
  const sources = Object.create(null);
  const coerced = Object.create(null);
  for (const [varName, varSignature] of Object.entries(fragmentSignatures)) {
    sources[varName] = {
      signature: varSignature,
    };
    const argumentNode = argNodeMap.get(varName);
    if (argumentNode !== undefined) {
      const source = sources[varName];
      source.value = argumentNode.value;
      source.fragmentVariableValues = fragmentVariableValues;
    }
    coerceArgument(
      coerced,
      fragmentSpreadNode,
      varName,
      varSignature,
      argumentNode,
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }
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
export function getArgumentValues(
  def: GraphQLField<unknown, unknown> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): {
  [argument: string]: unknown;
} {
  const coercedValues: {
    [argument: string]: unknown;
  } = {};
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
  for (const argDef of def.args) {
    const name = argDef.name;
    coerceArgument(
      coercedValues,
      node,
      name,
      argDef,
      argNodeMap.get(argDef.name),
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }
  return coercedValues;
}
// eslint-disable-next-line @typescript-eslint/max-params
function coerceArgument(
  coercedValues: ObjMap<unknown>,
  node: FieldNode | DirectiveNode | FragmentSpreadNode,
  argName: string,
  argDef: GraphQLArgument | GraphQLVariableSignature,
  argumentNode: ArgumentNode | FragmentArgumentNode | undefined,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): void {
  const argType = argDef.type;
  if (!argumentNode) {
    if (isRequiredArgument(argDef)) {
      // Note: ProvidedRequiredArgumentsRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        // TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
        `Argument "${isArgument(argDef) ? argDef : argName}" of required type "${argType}" was not provided.`,
        { nodes: node },
      );
    }
    const coercedDefaultValue = coerceDefaultValue(argDef);
    if (coercedDefaultValue !== undefined) {
      coercedValues[argName] = coercedDefaultValue;
    }
    return;
  }
  const valueNode = argumentNode.value;
  // Variables without a value are treated as if no argument was provided if
  // the argument is not required.
  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    const scopedVariableValues = fragmentVariableValues?.sources[variableName]
      ? fragmentVariableValues
      : variableValues;
    if (
      (scopedVariableValues == null ||
        !Object.hasOwn(scopedVariableValues.coerced, variableName)) &&
      !isRequiredArgument(argDef)
    ) {
      const coercedDefaultValue = coerceDefaultValue(argDef);
      if (coercedDefaultValue !== undefined) {
        coercedValues[argName] = coercedDefaultValue;
      }
      return;
    }
  }
  const coercedValue = coerceInputLiteral(
    valueNode,
    argType,
    variableValues,
    fragmentVariableValues,
  );
  if (coercedValue === undefined) {
    // Note: ValuesOfCorrectTypeRule validation should catch this before
    // execution. This is a runtime check to ensure execution does not
    // continue with an invalid argument value.
    validateInputLiteral(
      valueNode,
      argType,
      (error, path) => {
        // TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
        error.message = `Argument "${isArgument(argDef) ? argDef : argDef.name}" has invalid value${printPathArray(path)}: ${error.message}`;
        throw error;
      },
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
    /* c8 ignore next */
    false || invariant(false, 'Invalid argument');
  }
  coercedValues[argName] = coercedValue;
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
  node: {
    readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  },
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
):
  | undefined
  | {
      [argument: string]: unknown;
    } {
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );
  if (directiveNode) {
    return getArgumentValues(
      directiveDef,
      directiveNode,
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }
}
