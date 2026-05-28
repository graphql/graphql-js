import { invariant } from '../../jsutils/invariant.ts';
import { printPathArray } from '../../jsutils/printPathArray.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ValueNode } from '../../language/ast.ts';

import { validateInputLiteral } from '../../utilities/validateInputValue.ts';

import type { FragmentVariableValues } from '../collectFields.ts';
import type { VariableValues } from '../values.ts';

import type {
  CompiledBooleanDirective,
  CompiledDirectiveArgument,
} from './compileBooleanDirective.ts';
import type { FragmentVariables } from './compileFragmentVariables.ts';

/** @internal */
export function getCompiledDirectiveIfValue(
  directive: CompiledBooleanDirective | undefined,
  variableValues: VariableValues,
  fragmentVariables: FragmentVariables | undefined,
  hideSuggestions: boolean,
): boolean | undefined {
  if (directive === undefined) {
    return;
  }

  const ifBooleanValue = directive.ifBooleanValue;
  if (ifBooleanValue !== undefined) {
    return ifBooleanValue;
  }

  const ifVariableName = directive.ifVariableName;
  if (ifVariableName !== undefined) {
    const ifArgument = directive.ifArgument;
    if (fragmentVariables === undefined) {
      const coercedValues = variableValues.coerced;
      if (ifVariableName in coercedValues) {
        const value = coercedValues[ifVariableName];
        if (value != null) {
          return value === true;
        }
      } else {
        const defaultValue = ifArgument.defaultValue;
        if (defaultValue !== undefined) {
          return defaultValue === true;
        }
      }
    } else {
      const staticCoercedValues = fragmentVariables.static?.coerced;
      const staticValue = staticCoercedValues?.[ifVariableName];
      if (
        staticCoercedValues !== undefined &&
        ifVariableName in staticCoercedValues
      ) {
        if (staticValue != null) {
          return staticValue === true;
        }
        const ifValueNode = directive.ifValueNode;
        invariant(ifValueNode !== undefined, 'Expected variable value node.');
        throwInvalidDirectiveArgumentValue(
          ifArgument,
          ifValueNode,
          variableValues,
          fragmentVariables.static,
          hideSuggestions,
        );
      }

      const runtimeFragmentVariables = fragmentVariables.runtime;
      const scopedVariableValues =
        runtimeFragmentVariables !== undefined &&
        ifVariableName in runtimeFragmentVariables.sources
          ? runtimeFragmentVariables
          : variableValues;
      if (ifVariableName in scopedVariableValues.coerced) {
        const value = scopedVariableValues.coerced[ifVariableName];
        if (value != null) {
          return value === true;
        }
      } else {
        const defaultValue = ifArgument.defaultValue;
        if (defaultValue !== undefined) {
          return defaultValue === true;
        }
      }
    }
  }

  const ifValueNode = directive.ifValueNode;
  const ifArgument = directive.ifArgument;
  if (ifValueNode === undefined) {
    throw new GraphQLError(
      `Argument "${ifArgument.coordinate}" of required type "${ifArgument.type}" was not provided.`,
      { nodes: directive.node },
    );
  }

  return throwInvalidDirectiveArgumentValue(
    ifArgument,
    ifValueNode,
    variableValues,
    fragmentVariables?.runtime,
    hideSuggestions,
  );
}

function throwInvalidDirectiveArgumentValue(
  argument: CompiledDirectiveArgument,
  valueNode: ValueNode,
  variableValues: VariableValues,
  fragmentVariableValues: FragmentVariableValues | undefined,
  hideSuggestions: boolean,
): never {
  validateInputLiteral(
    valueNode,
    argument.type,
    (error, path) => {
      error.message = `Argument "${
        argument.coordinate
      }" has invalid value${printPathArray(path)}: ${error.message}`;
      throw error;
    },
    variableValues,
    fragmentVariableValues,
    hideSuggestions,
  );
  /* node:coverage ignore next */
  invariant(false, 'Invalid argument');
}
