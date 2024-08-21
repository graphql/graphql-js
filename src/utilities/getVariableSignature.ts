import { GraphQLError } from '../error/GraphQLError.js';

import { print } from '../language/printer.js';

import type { GraphQLInputType, GraphQLSchema } from '../type/index.js';
import { isInputType } from '../type/index.js';

import type { VariableDefinitionNode } from '../index.js';

import { typeFromAST } from './typeFromAST.js';
import { valueFromAST } from './valueFromAST.js';

export interface GraphQLVariableSignature {
  name: string;
  type: GraphQLInputType;
  defaultValue: unknown;
}

export function getVariableSignature(
  schema: GraphQLSchema,
  varDefNode: VariableDefinitionNode,
): GraphQLVariableSignature {
  const varName = varDefNode.variable.name.value;
  const varType = typeFromAST(schema, varDefNode.type);

  if (!isInputType(varType)) {
    // Must use input types for variables. This should be caught during
    // validation, however is checked again here for safety.
    const varTypeStr = print(varDefNode.type);
    throw new GraphQLError(
      `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
      { nodes: varDefNode.type },
    );
  }

  const varDefaultValue = varDefNode.defaultValue;
  const defaultValue =
    varDefaultValue != null
      ? valueFromAST(varDefaultValue, varType)
      : undefined;

  return { name: varName, type: varType, defaultValue };
}
