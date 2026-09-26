import type { DirectiveNode, ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { GraphQLInputType } from '../../type/definition.ts';

/** @internal */
export interface CompiledDirectiveArgument {
  coordinate: string;
  type: GraphQLInputType;
  defaultValue: unknown;
}

/** @internal */
export interface CompiledBooleanDirective {
  node: DirectiveNode;
  ifArgument: CompiledDirectiveArgument;
  hasIfArgument: boolean;
  ifValueNode: ValueNode | undefined;
  ifBooleanValue: boolean | undefined;
  ifVariableName: string | undefined;
}

/** @internal */
export function compileBooleanDirective(
  directiveNode: DirectiveNode | undefined,
  ifArgument: CompiledDirectiveArgument,
): CompiledBooleanDirective | undefined {
  if (directiveNode === undefined) {
    return;
  }

  let ifValue;
  for (const argumentNode of directiveNode.arguments ?? []) {
    if (argumentNode.name.value === 'if') {
      ifValue = argumentNode.value;
      break;
    }
  }
  return {
    node: directiveNode,
    ifArgument,
    hasIfArgument: ifValue !== undefined,
    ifValueNode: ifValue,
    ifBooleanValue: ifValue?.kind === Kind.BOOLEAN ? ifValue.value : undefined,
    ifVariableName:
      ifValue?.kind === Kind.VARIABLE ? ifValue.name.value : undefined,
  };
}
