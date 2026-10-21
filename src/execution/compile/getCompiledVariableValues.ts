import type { ObjMap } from '../../jsutils/ObjMap.ts';
import { printPathArray } from '../../jsutils/printPathArray.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';

import { isNonNullType } from '../../type/definition.ts';
import { validateDefaultInput } from '../../type/validate.ts';

import { validateInputValue } from '../../utilities/validateInputValue.ts';

import type { VariableValues, VariableValuesOrErrors } from '../values.ts';

import type {
  CompiledVariableValues,
  ValidVariableDefinition,
} from './compileVariableValues.ts';

/** @internal */
export function getCompiledVariableValues(
  compiled: CompiledVariableValues,
  inputs: { readonly [variable: string]: unknown },
  maxErrors: number,
): VariableValuesOrErrors {
  const errors: Array<GraphQLError> = [];
  const onError = (error: GraphQLError) => {
    if (errors.length >= maxErrors) {
      throw new GraphQLError(
        'Too many errors processing variables, error limit reached. Execution aborted.',
      );
    }
    errors.push(error);
  };

  try {
    const variableValues = coerceCompiledVariableValues(
      compiled,
      inputs,
      onError,
    );
    if (errors.length === 0) {
      return { variableValues };
    }
  } catch (error) {
    errors.push(ensureGraphQLError(error));
  }

  return { errors };
}

function coerceCompiledVariableValues(
  compiled: CompiledVariableValues,
  inputs: { readonly [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): VariableValues {
  const sources: ObjMap<VariableValues['sources'][string]> =
    Object.create(null);
  const coerced: ObjMap<unknown> = Object.create(null);

  for (const entry of compiled.entries) {
    if (entry.kind === 'invalid') {
      onError(entry.error);
      continue;
    }

    const { signature } = entry;
    const varName = signature.name;
    const value = hasOwn(inputs, varName) ? inputs[varName] : undefined;
    if (value === undefined) {
      sources[varName] = { signature };
      if (signature.default !== undefined) {
        useVariableDefaultValue(
          entry,
          coerced,
          onError,
          compiled.hideSuggestions,
        );
      } else if (isNonNullType(signature.type)) {
        reportInvalidVariableValue(
          entry,
          value,
          onError,
          compiled.hideSuggestions,
        );
      }
      continue;
    }

    sources[varName] = { signature, value };
    const coercedValue = entry.valueCoercer(value);
    if (coercedValue !== undefined) {
      coerced[varName] = coercedValue;
    } else {
      reportInvalidVariableValue(
        entry,
        value,
        onError,
        compiled.hideSuggestions,
      );
    }
  }

  return { sources, coerced };
}

function useVariableDefaultValue(
  entry: ValidVariableDefinition,
  coerced: ObjMap<unknown>,
  onError: (error: GraphQLError) => void,
  hideSuggestions: boolean,
): void {
  if (entry.defaultError === undefined) {
    coerced[entry.signature.name] = entry.defaultValue;
    return;
  }

  const defaultInput = entry.signature.default;
  // Defensive: compiled variable defaults are only used when a default exists.
  /* node:coverage ignore next 3 */
  if (defaultInput === undefined) {
    throw entry.defaultError;
  }

  let reportedValidationError = false;
  validateDefaultInput(
    defaultInput,
    entry.signature.type,
    (defaultError, path) => {
      reportedValidationError = true;
      onError(
        new GraphQLError(
          `Variable "$${entry.signature.name}" has invalid default value${printPathArray(
            path,
          )}: ${defaultError.message}`,
          { nodes: entry.node },
        ),
      );
    },
    hideSuggestions,
  );

  if (!reportedValidationError) {
    onError(
      new GraphQLError(
        `Variable "$${entry.signature.name}" has invalid default value: ${entry.defaultError.message}`,
        { nodes: entry.node },
      ),
    );
  }
}

function reportInvalidVariableValue(
  entry: ValidVariableDefinition,
  value: unknown,
  onError: (error: GraphQLError) => void,
  hideSuggestions: boolean,
): void {
  validateInputValue(
    value,
    entry.signature.type,
    (error, path) => {
      onError(
        new GraphQLError(
          `Variable "$${entry.signature.name}" has invalid value${printPathArray(
            path,
          )}: ${error.message}`,
          { nodes: entry.node, originalError: error },
        ),
      );
    },
    hideSuggestions,
  );
}

function hasOwn(
  object: { readonly [key: string]: unknown },
  key: string,
): boolean {
  return Object.hasOwn(object, key);
}
