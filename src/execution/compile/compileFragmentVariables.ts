import type { ObjMap } from '../../jsutils/ObjMap.ts';

import type {
  FragmentArgumentNode,
  FragmentSpreadNode,
  ValueNode,
} from '../../language/ast.ts';

import type { FragmentVariableValues } from '../collectFields.ts';
import type { GraphQLVariableSignature } from '../getVariableSignature.ts';

import type { InputLiteralCoercer } from './compileInputValue.ts';
import {
  compileInputLiteral,
  isStaticInputLiteral,
} from './compileInputValue.ts';

/** @internal */
export interface FragmentVariables {
  runtime: FragmentVariableValues | undefined;
  static: FragmentVariableValues | undefined;
}

/** @internal */
export interface CompiledFragmentVariables {
  entries: ReadonlyArray<CompiledFragmentVariableEntry>;
}

/** @internal */
export type CompiledFragmentVariableEntry =
  | StaticCompiledFragmentVariableEntry
  | DynamicCompiledFragmentVariableEntry;

/** @internal */
export interface StaticCompiledFragmentVariableEntry {
  name: string;
  signature: GraphQLVariableSignature;
  sourceValueNode: ValueNode | undefined;
  staticValue: unknown;
}

/** @internal */
export interface DynamicCompiledFragmentVariableEntry {
  name: string;
  signature: GraphQLVariableSignature;
  sourceValueNode: ValueNode;
  valueNode: ValueNode;
  valueBuilder: InputLiteralCoercer;
}

/** @internal */
export function compileFragmentVariables(
  fragmentSpreadNode: FragmentSpreadNode,
  variableSignatures: ObjMap<GraphQLVariableSignature>,
): CompiledFragmentVariables | undefined {
  const argNodeMap = new Map<string, FragmentArgumentNode>();
  for (const argNode of fragmentSpreadNode.arguments ?? []) {
    argNodeMap.set(argNode.name.value, argNode);
  }
  const entries: Array<CompiledFragmentVariableEntry> = [];

  for (const [name, variableSignature] of Object.entries(variableSignatures)) {
    const argumentNode = argNodeMap.get(name);
    const valueNode = argumentNode?.value ?? variableSignature.default?.literal;
    const entry =
      valueNode === undefined
        ? undefined
        : compileFragmentVariableEntry(
            name,
            variableSignature,
            valueNode,
            argumentNode?.value,
          );

    if (entry) {
      entries.push(entry);
    }
  }

  return entries.length === 0 ? undefined : { entries };
}

function compileFragmentVariableEntry(
  name: string,
  signature: GraphQLVariableSignature,
  valueNode: ValueNode,
  sourceValueNode: ValueNode | undefined,
): CompiledFragmentVariableEntry | undefined {
  const valueBuilder = compileInputLiteral(valueNode, signature.type);
  if (isStaticInputLiteral(valueNode)) {
    const staticValue = valueBuilder();
    return staticValue === undefined
      ? undefined
      : {
          name,
          signature,
          sourceValueNode,
          staticValue,
        };
  }

  if (sourceValueNode !== undefined) {
    return {
      name,
      signature,
      sourceValueNode,
      valueNode,
      valueBuilder,
    };
  }
}
