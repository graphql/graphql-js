import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';

import type { VariableDefinitionNode } from '../../language/ast.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import type { GraphQLVariableSignature } from '../getVariableSignature.ts';
import { getVariableSignature } from '../getVariableSignature.ts';

import type { InputValueCoercer } from './compileInputValue.ts';
import {
  compileInputValue,
  getDefaultInputValue,
} from './compileInputValue.ts';

/** @internal */
export interface CompiledVariableValues {
  entries: ReadonlyArray<CompiledVariableDefinition>;
  hideSuggestions: boolean;
}

/** @internal */
export type CompiledVariableDefinition =
  | ValidVariableDefinition
  | InvalidVariableDefinition;

/** @internal */
export interface ValidVariableDefinition {
  kind: 'valid';
  node: VariableDefinitionNode;
  signature: GraphQLVariableSignature;
  valueCoercer: InputValueCoercer;
  defaultValue: unknown;
  defaultError: GraphQLError | undefined;
}

/** @internal */
export interface InvalidVariableDefinition {
  kind: 'invalid';
  error: GraphQLError;
}

/** @internal */
export function compileVariableValues(
  schema: GraphQLSchema,
  variableDefinitions: ReadonlyArray<VariableDefinitionNode>,
  hideSuggestions: boolean,
): CompiledVariableValues {
  const entries: Array<CompiledVariableDefinition> = [];
  for (const variableDefinition of variableDefinitions) {
    const signature = getVariableSignature(schema, variableDefinition);
    if (signature instanceof GraphQLError) {
      entries.push({ kind: 'invalid', error: signature });
      continue;
    }

    let defaultValue: unknown;
    let defaultError: GraphQLError | undefined;
    if (signature.default !== undefined) {
      try {
        defaultValue = getDefaultInputValue(signature);
      } catch (error) {
        defaultError = ensureGraphQLError(error);
      }
    }

    entries.push({
      kind: 'valid',
      node: variableDefinition,
      signature,
      valueCoercer: compileInputValue(signature.type),
      defaultValue,
      defaultError,
    });
  }

  return { entries, hideSuggestions };
}
