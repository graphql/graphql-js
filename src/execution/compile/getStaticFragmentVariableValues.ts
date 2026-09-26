import type { ObjMap } from '../../jsutils/ObjMap.ts';

import type { ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { FragmentVariableValues } from '../collectFields.ts';

import type {
  CompiledFragmentVariables,
  DynamicCompiledFragmentVariableEntry,
} from './compileFragmentVariables.ts';

/** @internal */
export function getStaticFragmentVariableValues(
  compiledFragmentVariables: CompiledFragmentVariables | undefined,
  parentStaticValues: FragmentVariableValues | undefined,
): FragmentVariableValues | undefined {
  if (compiledFragmentVariables === undefined) {
    return;
  }

  let sources: ObjMap<FragmentVariableValues['sources'][string]> | undefined;
  let coerced: ObjMap<unknown> | undefined;
  for (const entry of compiledFragmentVariables.entries) {
    const coercedValue =
      'staticValue' in entry
        ? entry.staticValue
        : getStaticValueIfAvailable(entry, parentStaticValues);

    if (coercedValue === undefined) {
      continue;
    }

    const source =
      entry.sourceValueNode === undefined
        ? {
            signature: entry.signature,
            value: undefined,
            fragmentVariableValues: undefined,
          }
        : parentStaticValues === undefined
          ? {
              signature: entry.signature,
              value: entry.sourceValueNode,
              fragmentVariableValues: undefined,
            }
          : {
              signature: entry.signature,
              value: entry.sourceValueNode,
              fragmentVariableValues: parentStaticValues,
            };

    const staticSources = (sources ??= Object.create(null));
    const staticCoerced = (coerced ??= Object.create(null));
    staticSources[entry.name] = source;
    staticCoerced[entry.name] = coercedValue;
  }

  return sources === undefined || coerced === undefined
    ? undefined
    : { sources, coerced };
}

function getStaticValueIfAvailable(
  entry: DynamicCompiledFragmentVariableEntry,
  parentStaticValues: FragmentVariableValues | undefined,
): unknown {
  if (!canUseStaticValue(entry.valueNode, parentStaticValues)) {
    return;
  }

  return entry.valueBuilder(undefined, parentStaticValues);
}

function canUseStaticValue(
  valueNode: ValueNode,
  parentStaticValues: FragmentVariableValues | undefined,
): boolean {
  switch (valueNode.kind) {
    case Kind.VARIABLE:
      return (
        parentStaticValues !== undefined &&
        valueNode.name.value in parentStaticValues.coerced
      );
    case Kind.LIST:
      return valueNode.values.every((item) =>
        canUseStaticValue(item, parentStaticValues),
      );
    case Kind.OBJECT:
      return valueNode.fields.every((field) =>
        canUseStaticValue(field.value, parentStaticValues),
      );
    default:
      return true;
  }
}
