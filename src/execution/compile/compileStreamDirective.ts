import type { Maybe } from '../../jsutils/Maybe.ts';

import type { DirectiveNode, ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { GraphQLInputType } from '../../type/definition.ts';
import { GraphQLNonNull } from '../../type/definition.ts';
import { GraphQLBoolean, GraphQLInt } from '../../type/scalars.ts';

import type { FragmentVariableValues } from '../collectFields.ts';

import {
  compileInputLiteral,
  isStaticInputLiteral,
} from './compileInputValue.ts';

/** @internal */
export type CompiledStreamArgument =
  | StaticStreamArgument
  | VariableStreamArgument
  | InvalidStreamArgument;

/** @internal */
export interface StaticStreamArgument {
  kind: 'static';
  value: unknown;
}

/** @internal */
export interface VariableStreamArgument {
  kind: 'variable';
  argument: StreamArgumentDefinition;
  variableName: string;
  defaultValue: unknown;
}

/** @internal */
export interface InvalidStreamArgument {
  kind: 'invalid';
  argument: StreamArgumentDefinition;
  valueNode: ValueNode;
}

/** @internal */
export interface StreamDirectiveCompilation {
  initialCount: CompiledStreamArgument;
  if: CompiledStreamArgument;
  label: string | undefined;
  usesVariableValues: boolean;
  fragmentVariableValues: FragmentVariableValues | undefined;
  staticFragmentVariableValues: FragmentVariableValues | undefined;
}

/** @internal */
export type CompiledStreamDirective = StreamDirectiveCompilation | null;

/** @internal */
export interface StreamArgumentDefinition {
  coordinate: string;
  type: GraphQLInputType;
  defaultValue: unknown;
}

const STREAM_INITIAL_COUNT_ARGUMENT: StreamArgumentDefinition = {
  coordinate: '@stream(initialCount:)',
  type: new GraphQLNonNull(GraphQLInt),
  defaultValue: 0,
};

const STREAM_IF_ARGUMENT: StreamArgumentDefinition = {
  coordinate: '@stream(if:)',
  type: new GraphQLNonNull(GraphQLBoolean),
  defaultValue: true,
};

/** @internal */
export function compileStreamDirective(
  directiveNode: DirectiveNode | undefined,
): CompiledStreamDirective {
  if (directiveNode === undefined) {
    return null;
  }

  let initialCountValueNode;
  let ifValueNode;
  let labelValueNode;
  for (const argumentNode of directiveNode.arguments ?? []) {
    switch (argumentNode.name.value) {
      case 'initialCount':
        initialCountValueNode = argumentNode.value;
        break;
      case 'if':
        ifValueNode = argumentNode.value;
        break;
      case 'label':
        labelValueNode = argumentNode.value;
        break;
    }
  }

  const initialCount = compileStreamArgument(
    STREAM_INITIAL_COUNT_ARGUMENT,
    initialCountValueNode,
  );
  const ifValue = compileStreamArgument(STREAM_IF_ARGUMENT, ifValueNode);

  return {
    initialCount,
    if: ifValue,
    label:
      labelValueNode?.kind === Kind.STRING ? labelValueNode.value : undefined,
    usesVariableValues:
      initialCount.kind === 'variable' || ifValue.kind === 'variable',
    fragmentVariableValues: undefined,
    staticFragmentVariableValues: undefined,
  };
}

/** @internal */
export function withStreamDirectiveVariableValues(
  compiled: CompiledStreamDirective,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  staticFragmentVariableValues?: Maybe<FragmentVariableValues>,
): CompiledStreamDirective {
  if (
    compiled === null ||
    !compiled.usesVariableValues ||
    (fragmentVariableValues == null && staticFragmentVariableValues == null)
  ) {
    return compiled;
  }

  return {
    ...compiled,
    fragmentVariableValues: fragmentVariableValues ?? undefined,
    staticFragmentVariableValues: staticFragmentVariableValues ?? undefined,
  };
}

function compileStreamArgument(
  argument: StreamArgumentDefinition,
  valueNode: ValueNode | undefined,
): CompiledStreamArgument {
  if (valueNode === undefined) {
    return {
      kind: 'static',
      value: argument.defaultValue,
    };
  }

  if (valueNode.kind === Kind.VARIABLE) {
    return {
      kind: 'variable',
      argument,
      variableName: valueNode.name.value,
      defaultValue: argument.defaultValue,
    };
  }

  const valueBuilder = compileInputLiteral(valueNode, argument.type);
  const coercedValue = isStaticInputLiteral(valueNode)
    ? valueBuilder()
    : undefined;
  return coercedValue !== undefined
    ? { kind: 'static', value: coercedValue }
    : { kind: 'invalid', argument, valueNode };
}
