import type { DeferUsage } from '../collectFields.ts';
import type { VariableValues } from '../values.ts';

import type { DeferDirectiveCompilation } from './compileDeferDirective.ts';
import type { FragmentVariables } from './compileFragmentVariables.ts';
import { getCompiledDirectiveIfValue } from './getCompiledDirectiveIfValue.ts';

/** @internal */
export function getCompiledDeferUsage(
  selection: DeferDirectiveCompilation,
  parentDeferUsage: DeferUsage | undefined,
  variableValues: VariableValues,
  fragmentVariables: FragmentVariables | undefined,
  hideSuggestions: boolean,
): DeferUsage | undefined {
  const deferDirective = selection.deferDirective;
  if (deferDirective === undefined) {
    return;
  }

  const ifValue = deferDirective.hasIfArgument
    ? getCompiledDirectiveIfValue(
        deferDirective,
        variableValues,
        fragmentVariables,
        hideSuggestions,
      )
    : true;
  if (ifValue === false) {
    return;
  }

  return {
    label: deferDirective.label,
    parentDeferUsage,
  };
}
