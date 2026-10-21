import type { DirectiveNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { GraphQLNonNull } from '../../type/definition.ts';
import { GraphQLBoolean } from '../../type/scalars.ts';

import type {
  CompiledBooleanDirective,
  CompiledDirectiveArgument,
} from './compileBooleanDirective.ts';
import { compileBooleanDirective } from './compileBooleanDirective.ts';

/** @internal */
export interface DeferDirectiveCompilation {
  deferDirective: CompiledDeferDirective | undefined;
}

/** @internal */
export interface CompiledDeferDirective extends CompiledBooleanDirective {
  label: string | undefined;
}

const DEFER_IF_ARGUMENT: CompiledDirectiveArgument = {
  coordinate: '@defer(if:)',
  type: new GraphQLNonNull(GraphQLBoolean),
  defaultValue: true,
};

/** @internal */
export function compileDeferDirective(
  directiveNode: DirectiveNode | undefined,
): CompiledDeferDirective | undefined {
  const compiled = compileBooleanDirective(directiveNode, DEFER_IF_ARGUMENT);
  if (compiled === undefined || directiveNode === undefined) {
    return;
  }

  let labelValue;
  for (const argumentNode of directiveNode.arguments ?? []) {
    if (argumentNode.name.value === 'label') {
      labelValue = argumentNode.value;
      break;
    }
  }

  return {
    ...compiled,
    label: labelValue?.kind === Kind.STRING ? labelValue.value : undefined,
  };
}
