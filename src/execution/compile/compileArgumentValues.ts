import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import type { GraphQLError } from '../../error/GraphQLError.ts';

import type { FieldNode, ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { GraphQLArgument, GraphQLField } from '../../type/definition.ts';
import { isNonNullType, isRequiredArgument } from '../../type/definition.ts';

import type { FragmentVariableValues } from '../collectFields.ts';

import type { InputLiteralCoercer } from './compileInputValue.ts';
import {
  compileInputLiteral,
  getDefaultInputValue,
  isStaticInputLiteral,
} from './compileInputValue.ts';

/** @internal */
export type ArgumentValueEntry =
  | ConstantArgumentValueEntry
  | BareVariableArgumentValueEntry
  | EmbeddedVariableArgumentValueEntry
  | InvalidLiteralArgumentValueEntry
  | InvalidDefaultArgumentValueEntry
  | MissingRequiredArgumentValueEntry;

/** @internal */
export interface ConstantArgumentValueEntry {
  kind: 'constant';
  name: string;
  value: unknown;
}

/** @internal */
export interface BareVariableArgumentValueEntry {
  kind: 'bareVariable';
  name: string;
  argDef: GraphQLArgument;
  variableName: string;
  valueNode: ValueNode;
  valueBuilder: InputLiteralCoercer;
  defaultValue: unknown;
  defaultValueError: GraphQLError | undefined;
  isNonNull: boolean;
  isRequired: boolean;
}

/** @internal */
export interface EmbeddedVariableArgumentValueEntry {
  kind: 'embeddedVariable';
  name: string;
  argDef: GraphQLArgument;
  valueNode: ValueNode;
  valueBuilder: InputLiteralCoercer;
}

/** @internal */
export interface InvalidLiteralArgumentValueEntry {
  kind: 'invalidLiteral';
  name: string;
  argDef: GraphQLArgument;
  valueNode: ValueNode;
  valueBuilder: InputLiteralCoercer;
}

/** @internal */
export interface InvalidDefaultArgumentValueEntry {
  kind: 'invalidDefault';
  name: string;
  argDef: GraphQLArgument;
  error: GraphQLError;
}

/** @internal */
export interface MissingRequiredArgumentValueEntry {
  kind: 'missing';
  name: string;
  argDef: GraphQLArgument;
}

/** @internal */
export interface CompiledArgumentValues {
  node: FieldNode;
  entries: ReadonlyArray<ArgumentValueEntry>;
  entryByName: ObjMap<ArgumentValueEntry>;
  constantValues: ObjMap<unknown> | undefined;
  fragmentVariableValues: FragmentVariableValues | undefined;
  hideSuggestions: boolean;
}

/** @internal */
export function compileArgumentValues(
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  hideSuggestions: boolean,
  fragmentVariableValues: FragmentVariableValues | undefined,
): CompiledArgumentValues {
  const argValueNodeMap = new Map<string, ValueNode>();
  for (const argNode of fieldNode.arguments ?? []) {
    argValueNodeMap.set(argNode.name.value, argNode.value);
  }
  const entries: Array<ArgumentValueEntry> = [];
  const entryByName: ObjMap<ArgumentValueEntry> = Object.create(null);
  const constantValues: ObjMap<unknown> = Object.create(null);
  let allConstant = true;

  for (const argDef of fieldDef.args) {
    const entry = compileArgumentValueEntry(
      argDef,
      argValueNodeMap.get(argDef.name),
    );
    if (entry === undefined) {
      continue;
    }

    entries.push(entry);
    entryByName[entry.name] = entry;
    if (entry.kind === 'constant') {
      constantValues[entry.name] = entry.value;
    } else {
      allConstant = false;
    }
  }

  return {
    node: fieldNode,
    entries,
    entryByName,
    constantValues: allConstant ? constantValues : undefined,
    fragmentVariableValues,
    hideSuggestions,
  };
}

function compileArgumentValueEntry(
  argDef: GraphQLArgument,
  valueNode: ValueNode | undefined,
): ArgumentValueEntry | undefined {
  if (valueNode === undefined) {
    if (isRequiredArgument(argDef)) {
      return { kind: 'missing', name: argDef.name, argDef };
    }

    try {
      const defaultValue = getDefaultInputValue(argDef);
      return defaultValue === undefined
        ? undefined
        : { kind: 'constant', name: argDef.name, value: defaultValue };
    } catch (error) {
      return {
        kind: 'invalidDefault',
        name: argDef.name,
        argDef,
        error: ensureGraphQLError(error),
      };
    }
  }

  const valueBuilder = compileInputLiteral(valueNode, argDef.type);

  if (valueNode.kind === Kind.VARIABLE) {
    let defaultValue;
    let defaultValueError;
    try {
      defaultValue = getDefaultInputValue(argDef);
    } catch (error) {
      defaultValueError = ensureGraphQLError(error);
    }
    return {
      kind: 'bareVariable',
      name: argDef.name,
      argDef,
      variableName: valueNode.name.value,
      valueNode,
      valueBuilder,
      defaultValue,
      defaultValueError,
      isNonNull: isNonNullType(argDef.type),
      isRequired: isRequiredArgument(argDef),
    };
  }

  if (isStaticInputLiteral(valueNode)) {
    const coercedValue = valueBuilder();
    if (coercedValue !== undefined) {
      return { kind: 'constant', name: argDef.name, value: coercedValue };
    }
    return {
      kind: 'invalidLiteral',
      name: argDef.name,
      argDef,
      valueNode,
      valueBuilder,
    };
  }

  return {
    kind: 'embeddedVariable',
    name: argDef.name,
    argDef,
    valueNode,
    valueBuilder,
  };
}
