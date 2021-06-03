import type { ObjMap, ReadOnlyObjMap } from '../jsutils/ObjMap';
import type { Maybe } from '../jsutils/Maybe';
import { keyMap } from '../jsutils/keyMap';
import { inspect } from '../jsutils/inspect';
import { printPathArray } from '../jsutils/printPathArray';

import { GraphQLError } from '../error/GraphQLError';

import type {
  FieldNode,
  DirectiveNode,
  VariableDefinitionNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLInputType, GraphQLField } from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import { isInputType, isNonNullType } from '../type/definition';

import { typeFromAST } from '../utilities/typeFromAST';
import {
  coerceInputValue,
  coerceInputLiteral,
  coerceDefaultValue,
} from '../utilities/coerceInputValue';

export interface VariableValues {
  readonly sources: ReadOnlyObjMap<VariableValueSource>;
  readonly coerced: ReadOnlyObjMap<unknown>;
}

interface VariableValueSource {
  readonly variable: VariableDefinitionNode;
  readonly type: GraphQLInputType;
  readonly value: unknown;
}

type VariableValuesOrErrors =
  | { variableValues: VariableValues; errors?: never }
  | { errors: ReadonlyArray<GraphQLError>; variableValues?: never };

/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 *
 * @internal
 */
export function getVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  options?: { maxErrors?: number },
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
  inputs: { readonly [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): VariableValues {
  const sources: ObjMap<VariableValueSource> = Object.create(null);
  const coerced: ObjMap<unknown> = Object.create(null);
  for (const varDefNode of varDefNodes) {
    const varName = varDefNode.variable.name.value;
    const varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
      // Must use input types for variables. This should be caught during
      // validation, however is checked again here for safety.
      const varTypeStr = print(varDefNode.type);
      onError(
        new GraphQLError(
          `Variable "$${varName}" expected value of type ${varTypeStr} which cannot be used as an input type.`,
          varDefNode.type,
        ),
      );
      continue;
    }

    if (!hasOwnProperty(inputs, varName)) {
      const defaultValue = varDefNode.defaultValue;
      if (defaultValue) {
        sources[varName] = {
          variable: varDefNode,
          type: varType,
          value: undefined,
        };
        coerced[varName] = coerceInputLiteral(defaultValue, varType);
      } else if (isNonNullType(varType)) {
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type ${varType} was not provided.`,
            varDefNode,
          ),
        );
      }
      continue;
    }

    const value = inputs[varName];
    if (value === null && isNonNullType(varType)) {
      onError(
        new GraphQLError(
          `Variable "$${varName}" of non-null type ${varType} must not be null.`,
          varDefNode,
        ),
      );
      continue;
    }

    sources[varName] = { variable: varDefNode, type: varType, value };
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
          new GraphQLError(
            prefix + '; ' + error.message,
            varDefNode,
            undefined,
            undefined,
            undefined,
            error.originalError,
          ),
        );
      },
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
 *
 * @internal
 */
export function getArgumentValues(
  def: GraphQLField<unknown, unknown> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<VariableValues>,
): { [argument: string]: unknown } {
  const coercedValues: { [argument: string]: unknown } = {};

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = keyMap(argumentNodes, (arg) => arg.name.value);

  for (const argDef of def.args) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap[name];

    if (!argumentNode) {
      if (argDef.defaultValue) {
        coercedValues[name] = coerceDefaultValue(
          argDef.defaultValue,
          argDef.type,
        );
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument ${argDef} of required type ${argType} was not provided.`,
          node,
        );
      }
      continue;
    }

    const valueNode = argumentNode.value;
    let isNull = valueNode.kind === Kind.NULL;

    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        variableValues == null ||
        variableValues.coerced[variableName] === undefined
      ) {
        if (argDef.defaultValue) {
          coercedValues[name] = coerceDefaultValue(
            argDef.defaultValue,
            argDef.type,
          );
        } else if (isNonNullType(argType)) {
          throw new GraphQLError(
            `Argument ${argDef} of required type ${argType} ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            valueNode,
          );
        }
        continue;
      }
      isNull = variableValues.coerced[variableName] == null;
    }

    if (isNull && isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument ${argDef} of non-null type ${argType} must not be null.`,
        valueNode,
      );
    }

    const coercedValue = coerceInputLiteral(valueNode, argType, variableValues);
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument ${argDef} of type ${argType} has invalid value ${print(
          valueNode,
        )}.`,
        valueNode,
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
  node: { readonly directives?: ReadonlyArray<DirectiveNode> },
  variableValues?: Maybe<VariableValues>,
): undefined | { [argument: string]: unknown } {
  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );

  if (directiveNode) {
    return getArgumentValues(directiveDef, directiveNode, variableValues);
  }
}

function hasOwnProperty(obj: unknown, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
