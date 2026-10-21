import { invariant } from '../../jsutils/invariant.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import { printPathArray } from '../../jsutils/printPathArray.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';

import { validateDefaultInput } from '../../type/validate.ts';

import { validateInputLiteral } from '../../utilities/validateInputValue.ts';

import type { FragmentVariableValues } from '../collectFields.ts';
import type { VariableValues } from '../values.ts';

import type {
  BareVariableArgumentValueEntry,
  CompiledArgumentValues,
  EmbeddedVariableArgumentValueEntry,
  InvalidLiteralArgumentValueEntry,
} from './compileArgumentValues.ts';

/** @internal */
export const UNKNOWN_ARGUMENT_VALUE: unique symbol = Symbol(
  'UNKNOWN_ARGUMENT_VALUE',
);

/** @internal */
export function getCompiledArgumentValues(
  compiled: CompiledArgumentValues,
  variableValues?: Maybe<VariableValues>,
): ObjMap<unknown> {
  const constantValues = compiled.constantValues;
  if (constantValues !== undefined) {
    return constantValues;
  }

  const coercedValues: ObjMap<unknown> = Object.create(null);
  const { fragmentVariableValues } = compiled;
  if (fragmentVariableValues === undefined) {
    const variableCoercedValues = variableValues?.coerced;
    for (const entry of compiled.entries) {
      switch (entry.kind) {
        case 'constant':
          coercedValues[entry.name] = entry.value;
          break;
        case 'bareVariable':
          coerceVariableArgumentWithoutFragmentValues(
            coercedValues,
            entry,
            compiled.node,
            variableValues,
            variableCoercedValues,
            compiled.hideSuggestions,
          );
          break;
        case 'embeddedVariable':
        case 'invalidLiteral':
          coerceArgumentValueNode(
            coercedValues,
            entry,
            variableValues,
            undefined,
            compiled.hideSuggestions,
          );
          break;
        case 'invalidDefault':
          return throwInvalidDefaultArgument(
            entry.argDef,
            entry.error,
            compiled.node,
            compiled.hideSuggestions,
          );
        case 'missing':
          throw new GraphQLError(
            `Argument "${entry.argDef}" of required type "${entry.argDef.type}" was not provided.`,
            { nodes: compiled.node },
          );
      }
    }

    return coercedValues;
  }

  for (const entry of compiled.entries) {
    switch (entry.kind) {
      case 'constant':
        coercedValues[entry.name] = entry.value;
        break;
      case 'bareVariable':
        coerceVariableArgument(
          coercedValues,
          entry,
          compiled.node,
          variableValues,
          fragmentVariableValues,
          compiled.hideSuggestions,
        );
        break;
      case 'embeddedVariable':
      case 'invalidLiteral':
        coerceArgumentValueNode(
          coercedValues,
          entry,
          variableValues,
          fragmentVariableValues,
          compiled.hideSuggestions,
        );
        break;
      case 'invalidDefault':
        return throwInvalidDefaultArgument(
          entry.argDef,
          entry.error,
          compiled.node,
          compiled.hideSuggestions,
        );
      case 'missing':
        throw new GraphQLError(
          `Argument "${entry.argDef}" of required type "${entry.argDef.type}" was not provided.`,
          { nodes: compiled.node },
        );
    }
  }

  return coercedValues;
}

/** @internal */
export function getCompiledArgumentValue(
  compiled: CompiledArgumentValues,
  name: string,
  variableValues?: Maybe<VariableValues>,
): unknown {
  const entry = compiled.entryByName[name];
  if (entry === undefined) {
    return undefined;
  }

  switch (entry.kind) {
    case 'constant':
      return entry.value;
    case 'bareVariable':
      return getVariableArgumentValue(
        entry,
        variableValues,
        compiled.fragmentVariableValues,
      );
    case 'embeddedVariable':
    case 'invalidLiteral':
    case 'invalidDefault':
    case 'missing':
      return UNKNOWN_ARGUMENT_VALUE;
  }
}

// eslint-disable-next-line max-params
function coerceVariableArgumentWithoutFragmentValues(
  coercedValues: ObjMap<unknown>,
  entry: BareVariableArgumentValueEntry,
  node: CompiledArgumentValues['node'],
  variableValues: Maybe<VariableValues>,
  variableCoercedValues: ObjMap<unknown> | undefined,
  hideSuggestions: boolean,
): void {
  let value: unknown;
  if (
    variableCoercedValues === undefined ||
    !(entry.variableName in variableCoercedValues)
  ) {
    value =
      entry.isRequired || entry.defaultValueError !== undefined
        ? UNKNOWN_ARGUMENT_VALUE
        : entry.defaultValue;
  } else {
    value = variableCoercedValues[entry.variableName];
    if (value == null && entry.isNonNull) {
      value = UNKNOWN_ARGUMENT_VALUE;
    }
  }

  if (value !== UNKNOWN_ARGUMENT_VALUE) {
    if (value !== undefined || entry.defaultValue !== undefined) {
      coercedValues[entry.name] = value;
    }
    return;
  }

  if (entry.defaultValueError !== undefined && !entry.isRequired) {
    throwInvalidDefaultArgument(
      entry.argDef,
      entry.defaultValueError,
      node,
      hideSuggestions,
    );
  }
  coerceArgumentValueNode(
    coercedValues,
    entry,
    variableValues,
    undefined,
    hideSuggestions,
  );
}

// eslint-disable-next-line max-params
function coerceVariableArgument(
  coercedValues: ObjMap<unknown>,
  entry: BareVariableArgumentValueEntry,
  node: CompiledArgumentValues['node'],
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
  hideSuggestions: boolean,
): void {
  const value = getVariableArgumentValue(
    entry,
    variableValues,
    fragmentVariableValues,
  );
  if (
    value === UNKNOWN_ARGUMENT_VALUE &&
    entry.defaultValueError !== undefined &&
    !entry.isRequired
  ) {
    throwInvalidDefaultArgument(
      entry.argDef,
      entry.defaultValueError,
      node,
      hideSuggestions,
    );
  }
  if (value !== UNKNOWN_ARGUMENT_VALUE) {
    if (value !== undefined || entry.defaultValue !== undefined) {
      coercedValues[entry.name] = value;
    }
    return;
  }

  coerceArgumentValueNode(
    coercedValues,
    entry,
    variableValues,
    fragmentVariableValues,
    hideSuggestions,
  );
}

function throwInvalidDefaultArgument(
  argDef: BareVariableArgumentValueEntry['argDef'],
  rawError: unknown,
  node:
    | BareVariableArgumentValueEntry['valueNode']
    | CompiledArgumentValues['node'],
  hideSuggestions: boolean,
): never {
  const defaultInput = argDef.default;
  if (defaultInput !== undefined) {
    let reportedValidationError = false;
    validateDefaultInput(
      defaultInput,
      argDef.type,
      (error, path) => {
        reportedValidationError = true;
        error.message = `Argument "${argDef}" has invalid default value${printPathArray(
          path,
        )}: ${error.message}`;
        throw error;
      },
      hideSuggestions,
    );
    /* node:coverage ignore next 3 */
    if (reportedValidationError) {
      invariant(false, 'Invalid default value');
    }
  }

  const error = ensureGraphQLError(rawError);
  throw new GraphQLError(
    `Argument "${argDef}" has invalid default value: ${error.message}`,
    { nodes: node, originalError: error },
  );
}

function getVariableArgumentValue(
  entry: BareVariableArgumentValueEntry,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): unknown {
  const scopedVariableValues = getScopedVariableValues(
    entry.variableName,
    variableValues,
    fragmentVariableValues,
  );
  if (
    scopedVariableValues == null ||
    !(entry.variableName in scopedVariableValues.coerced)
  ) {
    if (entry.isRequired || entry.defaultValueError !== undefined) {
      return UNKNOWN_ARGUMENT_VALUE;
    }
    return entry.defaultValue;
  }

  const value = scopedVariableValues.coerced[entry.variableName];
  return value == null && entry.isNonNull ? UNKNOWN_ARGUMENT_VALUE : value;
}

function getScopedVariableValues(
  variableName: string,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): Maybe<VariableValues | FragmentVariableValues> {
  return fragmentVariableValues !== undefined &&
    fragmentVariableValues !== null &&
    variableName in fragmentVariableValues.sources
    ? fragmentVariableValues
    : variableValues;
}

function coerceArgumentValueNode(
  coercedValues: ObjMap<unknown>,
  entry:
    | BareVariableArgumentValueEntry
    | EmbeddedVariableArgumentValueEntry
    | InvalidLiteralArgumentValueEntry,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
  hideSuggestions: boolean,
): void {
  const coercedValue = entry.valueBuilder(
    variableValues,
    fragmentVariableValues,
  );
  if (coercedValue === undefined) {
    validateInputLiteral(
      entry.valueNode,
      entry.argDef.type,
      (error, path) => {
        error.message = `Argument "${
          entry.argDef
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
  coercedValues[entry.name] = coercedValue;
}
