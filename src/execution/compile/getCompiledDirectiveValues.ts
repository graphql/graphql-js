import { invariant } from '../../jsutils/invariant.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import { printPathArray } from '../../jsutils/printPathArray.ts';

import type { ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { isNonNullType } from '../../type/definition.ts';

import { validateInputLiteral } from '../../utilities/validateInputValue.ts';

import type { FragmentVariableValues } from '../collectFields.ts';
import type { VariableValues } from '../values.ts';

import type {
  CompiledStreamArgument,
  CompiledStreamDirective,
  StreamArgumentDefinition,
  VariableStreamArgument,
} from './compileStreamDirective.ts';

/** @internal */
export function getCompiledDirectiveValues(
  compiled: CompiledStreamDirective,
  variableValues?: Maybe<VariableValues>,
): undefined | ObjMap<unknown> {
  if (compiled === null) {
    return;
  }

  const initialCount = getStreamArgumentValue(
    compiled.initialCount,
    variableValues,
    compiled.fragmentVariableValues,
    compiled.staticFragmentVariableValues,
  );
  const ifValue = getStreamArgumentValue(
    compiled.if,
    variableValues,
    compiled.fragmentVariableValues,
    compiled.staticFragmentVariableValues,
  );

  const stream: ObjMap<unknown> = Object.create(null);
  stream.initialCount = initialCount;
  stream.if = ifValue;
  if (compiled.label !== undefined) {
    stream.label = compiled.label;
  }
  return stream;
}

function getStreamArgumentValue(
  argument: CompiledStreamArgument,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
  staticFragmentVariableValues: Maybe<FragmentVariableValues>,
): unknown {
  switch (argument.kind) {
    case 'static':
      return argument.value;
    case 'variable':
      return getVariableStreamArgumentValue(
        argument,
        variableValues,
        fragmentVariableValues,
        staticFragmentVariableValues,
      );
    case 'invalid':
      return getInvalidStreamArgumentValue(
        argument.argument,
        argument.valueNode,
        variableValues,
        fragmentVariableValues,
      );
  }
}

function getVariableStreamArgumentValue(
  argument: VariableStreamArgument,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
  staticFragmentVariableValues: Maybe<FragmentVariableValues>,
): unknown {
  const staticCoercedValues = staticFragmentVariableValues?.coerced;
  if (
    staticCoercedValues !== undefined &&
    argument.variableName in staticCoercedValues
  ) {
    return getValidatedVariableValue(
      argument,
      staticCoercedValues[argument.variableName],
      variableValues,
      fragmentVariableValues,
    );
  }

  const scopedVariableValues =
    fragmentVariableValues != null &&
    argument.variableName in fragmentVariableValues.sources
      ? fragmentVariableValues
      : variableValues;

  if (
    scopedVariableValues == null ||
    !(argument.variableName in scopedVariableValues.coerced)
  ) {
    return argument.defaultValue;
  }

  return getValidatedVariableValue(
    argument,
    scopedVariableValues.coerced[argument.variableName],
    variableValues,
    fragmentVariableValues,
  );
}

function getValidatedVariableValue(
  argument: VariableStreamArgument,
  value: unknown,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): unknown {
  if (value == null && isNonNullType(argument.argument.type)) {
    return getInvalidStreamArgumentValue(
      argument.argument,
      {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: argument.variableName },
      },
      variableValues,
      fragmentVariableValues,
    );
  }
  return value;
}

function getInvalidStreamArgumentValue(
  argument: StreamArgumentDefinition,
  valueNode: ValueNode,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
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
    false,
  );
  /* node:coverage ignore next */
  invariant(false, 'Invalid argument');
}
