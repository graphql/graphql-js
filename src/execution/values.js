/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { GraphQLError } from '../error';
import find from '../jsutils/find';
import isInvalid from '../jsutils/isInvalid';
import keyMap from '../jsutils/keyMap';
import { coerceValue } from '../utilities/coerceValue';
import { typeFromAST } from '../utilities/typeFromAST';
import { valueFromAST } from '../utilities/valueFromAST';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';
import { isInputType, isNonNullType } from '../type/definition';
import type { ObjMap } from '../jsutils/ObjMap';
import type { GraphQLField } from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import type { GraphQLSchema } from '../type/schema';
import type {
  FieldNode,
  DirectiveNode,
  VariableDefinitionNode,
} from '../language/ast';

type CoercedVariableValues = {|
  errors: $ReadOnlyArray<GraphQLError> | void,
  coerced: { [variable: string]: mixed } | void,
|};

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
  varDefNodes: Array<VariableDefinitionNode>,
  inputs: ObjMap<mixed>,
): CoercedVariableValues {
  const errors = [];
  const coercedValues = {};
  for (let i = 0; i < varDefNodes.length; i++) {
    const varDefNode = varDefNodes[i];
    const varName = varDefNode.variable.name.value;
    const varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
      errors.push(
        new GraphQLError(
          `Variable "$${varName}" expected value of type ` +
            `"${print(
              varDefNode.type,
            )}" which cannot be used as an input type.`,
          [varDefNode.type],
        ),
      );
    } else {
      const value = inputs[varName];
      if (isInvalid(value)) {
        if (isNonNullType(varType)) {
          errors.push(
            new GraphQLError(
              `Variable "$${varName}" of required type ` +
                `"${String(varType)}" was not provided.`,
              [varDefNode],
            ),
          );
        } else if (varDefNode.defaultValue) {
          coercedValues[varName] = valueFromAST(
            varDefNode.defaultValue,
            varType,
          );
        }
      } else {
        const coerced = coerceValue(value, varType, varDefNode);
        const coercionErrors = coerced.errors;
        if (coercionErrors) {
          const messagePrelude = `Variable "$${varName}" got invalid value ${JSON.stringify(
            value,
          )}; `;
          coercionErrors.forEach(error => {
            error.message = messagePrelude + error.message;
          });
          errors.push(...coercionErrors);
        } else {
          coercedValues[varName] = coerced.value;
        }
      }
    }
  }
  return errors.length === 0
    ? { errors: undefined, coerced: coercedValues }
    : { errors, coerced: undefined };
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
  def: GraphQLField<*, *> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: ?ObjMap<mixed>,
): { [argument: string]: mixed } {
  const coercedValues = {};
  const argDefs = def.args;
  const argNodes = node.arguments;
  if (!argDefs || !argNodes) {
    return coercedValues;
  }
  const argNodeMap = keyMap(argNodes, arg => arg.name.value);
  for (let i = 0; i < argDefs.length; i++) {
    const argDef = argDefs[i];
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap[name];
    const defaultValue = argDef.defaultValue;
    if (!argumentNode) {
      if (!isInvalid(defaultValue)) {
        coercedValues[name] = defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type ` +
            `"${String(argType)}" was not provided.`,
          [node],
        );
      }
    } else if (argumentNode.value.kind === Kind.VARIABLE) {
      const variableName = argumentNode.value.name.value;
      if (
        variableValues &&
        Object.prototype.hasOwnProperty.call(variableValues, variableName) &&
        !isInvalid(variableValues[variableName])
      ) {
        // Note: this does not check that this variable value is correct.
        // This assumes that this query has been validated and the variable
        // usage here is of the correct type.
        coercedValues[name] = variableValues[variableName];
      } else if (!isInvalid(defaultValue)) {
        coercedValues[name] = defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${String(argType)}" was ` +
            `provided the variable "$${variableName}" which was not provided ` +
            'a runtime value.',
          [argumentNode.value],
        );
      }
    } else {
      const valueNode = argumentNode.value;
      const coercedValue = valueFromAST(valueNode, argType, variableValues);
      if (isInvalid(coercedValue)) {
        // Note: ValuesOfCorrectType validation should catch this before
        // execution. This is a runtime check to ensure execution does not
        // continue with an invalid argument value.
        throw new GraphQLError(
          `Argument "${name}" has invalid value ${print(valueNode)}.`,
          [argumentNode.value],
        );
      }
      coercedValues[name] = coercedValue;
    }
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
  node: { +directives?: $ReadOnlyArray<DirectiveNode> },
  variableValues?: ?ObjMap<mixed>,
): void | { [argument: string]: mixed } {
  const directiveNode =
    node.directives &&
    find(
      node.directives,
      directive => directive.name.value === directiveDef.name,
    );

  if (directiveNode) {
    return getArgumentValues(directiveDef, directiveNode, variableValues);
  }
}
