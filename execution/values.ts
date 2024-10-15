import { inspect } from '../jsutils/inspect.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap, ReadOnlyObjMap } from '../jsutils/ObjMap.ts';
import { printPathArray } from '../jsutils/printPathArray.ts';
import { GraphQLError } from '../error/GraphQLError.ts';
import type {
  DirectiveNode,
  FieldNode,
  FragmentSpreadNode,
  VariableDefinitionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { print } from '../language/printer.ts';
import type { GraphQLArgument, GraphQLField } from '../type/definition.ts';
import { isNonNullType } from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import {
  coerceDefaultValue,
  coerceInputLiteral,
  coerceInputValue,
} from '../utilities/coerceInputValue.ts';
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
    if (!Object.hasOwn(inputs, varName)) {
      const defaultValue = varSignature.defaultValue;
      if (defaultValue) {
        sources[varName] = { signature: varSignature };
        coerced[varName] = coerceDefaultValue(
          defaultValue,
          varType,
          hideSuggestions,
        );
      } else if (isNonNullType(varType)) {
        const varTypeStr = inspect(varType);
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
            { nodes: varDefNode },
          ),
        );
      } else {
        sources[varName] = { signature: varSignature };
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
    sources[varName] = { signature: varSignature, value };
    coerced[varName] = coerceInputValue(
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
      hideSuggestions,
    );
  }
  return { sources, coerced };
}
export function getFragmentVariableValues(
  fragmentSpreadNode: FragmentSpreadNode,
  fragmentSignatures: ReadOnlyObjMap<GraphQLVariableSignature>,
  variableValues: VariableValues,
  fragmentVariableValues?: Maybe<VariableValues>,
  hideSuggestions?: Maybe<boolean>,
): VariableValues {
  const varSignatures: Array<GraphQLVariableSignature> = [];
  const sources = Object.create(null);
  for (const [varName, varSignature] of Object.entries(fragmentSignatures)) {
    varSignatures.push(varSignature);
    sources[varName] = {
      signature: varSignature,
      value:
        fragmentVariableValues?.sources[varName]?.value ??
        variableValues.sources[varName]?.value,
    };
  }
  const coerced = experimentalGetArgumentValues(
    fragmentSpreadNode,
    varSignatures,
    variableValues,
    fragmentVariableValues,
    hideSuggestions,
  );
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
  hideSuggestions?: Maybe<boolean>,
): {
  [argument: string]: unknown;
} {
  return experimentalGetArgumentValues(
    node,
    def.args,
    variableValues,
    undefined,
    hideSuggestions,
  );
}
export function experimentalGetArgumentValues(
  node: FieldNode | DirectiveNode | FragmentSpreadNode,
  argDefs: ReadonlyArray<GraphQLArgument | GraphQLVariableSignature>,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<VariableValues>,
  hideSuggestions?: Maybe<boolean>,
): {
  [argument: string]: unknown;
} {
  const coercedValues: {
    [argument: string]: unknown;
  } = {};
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
  for (const argDef of argDefs) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap.get(name);
    if (argumentNode == null) {
      if (argDef.defaultValue) {
        coercedValues[name] = coerceDefaultValue(
          argDef.defaultValue,
          argDef.type,
          hideSuggestions,
        );
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
    let isNull = valueNode.kind === Kind.NULL;
    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      const scopedVariableValues = fragmentVariableValues?.sources[variableName]
        ? fragmentVariableValues
        : variableValues;
      if (
        scopedVariableValues == null ||
        !Object.hasOwn(scopedVariableValues.coerced, variableName)
      ) {
        if (argDef.defaultValue) {
          coercedValues[name] = coerceDefaultValue(
            argDef.defaultValue,
            argDef.type,
            hideSuggestions,
          );
        } else if (isNonNullType(argType)) {
          throw new GraphQLError(
            `Argument "${name}" of required type "${inspect(argType)}" ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            { nodes: valueNode },
          );
        }
        continue;
      }
      isNull = scopedVariableValues.coerced[variableName] == null;
    }
    if (isNull && isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${inspect(argType)}" ` +
          'must not be null.',
        { nodes: valueNode },
      );
    }
    const coercedValue = coerceInputLiteral(
      valueNode,
      argType,
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" of type "${inspect(argType)}" has invalid value ${print(valueNode)}.`,
        { nodes: valueNode },
      );
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
  node: {
    readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  },
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<VariableValues>,
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
    return experimentalGetArgumentValues(
      directiveNode,
      directiveDef.args,
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }
}
