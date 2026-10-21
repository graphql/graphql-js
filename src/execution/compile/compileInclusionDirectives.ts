import type { DirectiveNode } from '../../language/ast.ts';

import { GraphQLNonNull } from '../../type/definition.ts';
import { GraphQLBoolean } from '../../type/scalars.ts';

import type { VariableValues } from '../values.ts';

import type {
  CompiledBooleanDirective,
  CompiledDirectiveArgument,
} from './compileBooleanDirective.ts';
import { compileBooleanDirective } from './compileBooleanDirective.ts';
import type { FragmentVariables } from './compileFragmentVariables.ts';
import { getCompiledDirectiveIfValue } from './getCompiledDirectiveIfValue.ts';

/** @internal */
export interface InclusionDirectiveCompilation {
  skipDirective: CompiledBooleanDirective | undefined;
  includeDirective: CompiledBooleanDirective | undefined;
}

const BOOLEAN_NON_NULL = new GraphQLNonNull(GraphQLBoolean);

const SKIP_IF_ARGUMENT: CompiledDirectiveArgument = {
  coordinate: '@skip(if:)',
  type: BOOLEAN_NON_NULL,
  defaultValue: undefined,
};
const INCLUDE_IF_ARGUMENT: CompiledDirectiveArgument = {
  coordinate: '@include(if:)',
  type: BOOLEAN_NON_NULL,
  defaultValue: undefined,
};

/** @internal */
export function compileSkipDirective(
  directiveNode: DirectiveNode | undefined,
): CompiledBooleanDirective | undefined {
  return compileBooleanDirective(directiveNode, SKIP_IF_ARGUMENT);
}

/** @internal */
export function compileIncludeDirective(
  directiveNode: DirectiveNode | undefined,
): CompiledBooleanDirective | undefined {
  return compileBooleanDirective(directiveNode, INCLUDE_IF_ARGUMENT);
}

/** @internal */
export function shouldIncludeSelection(
  selection: InclusionDirectiveCompilation,
  variableValues: VariableValues,
  fragmentVariables: FragmentVariables | undefined,
  hideSuggestions: boolean,
): boolean {
  const skipDirective = selection.skipDirective;
  if (skipDirective !== undefined) {
    const skip = getCompiledDirectiveIfValue(
      skipDirective,
      variableValues,
      fragmentVariables,
      hideSuggestions,
    );
    if (skip === true) {
      return false;
    }
  }

  const includeDirective = selection.includeDirective;
  if (includeDirective !== undefined) {
    const include = getCompiledDirectiveIfValue(
      includeDirective,
      variableValues,
      fragmentVariables,
      hideSuggestions,
    );
    if (include === false) {
      return false;
    }
  }
  return true;
}
