import { GraphQLError } from '../error/GraphQLError.js';

import { print } from '../language/printer.js';

import type { GraphQLInputType, GraphQLSchema } from '../type/index.js';
import { isInputType } from '../type/index.js';

import type { VariableDefinitionNode } from '../index.js';

import { typeFromAST } from './typeFromAST.js';
import { valueFromAST } from './valueFromAST.js';

/**
 * A GraphQLVariableSignature is required to coerce a variable value.
 * */
export interface GraphQLVariableSignature {
  name: string;
  type: GraphQLInputType;
  defaultValue: unknown;
}

export function getVariableSignature(
  schema: GraphQLSchema,
  varDefNode: VariableDefinitionNode,
): GraphQLVariableSignature | GraphQLError {
  const varName = varDefNode.variable.name.value;
  const varType = typeFromAST(schema, varDefNode.type);

  if (!isInputType(varType)) {
    // Must use input types for variables. This should be caught during
    // validation, however is checked again here for safety.
    const varTypeStr = print(varDefNode.type);
    return new GraphQLError(
      `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
      { nodes: varDefNode.type },
    );
  }

  return {
    name: varName,
    type: varType,
    defaultValue: valueFromAST(varDefNode.defaultValue, varType),
  };
}
