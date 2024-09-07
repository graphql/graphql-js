import { GraphQLError } from '../error/GraphQLError';

import type { VariableDefinitionNode } from '../language/ast';
import { print } from '../language/printer';

import { isInputType } from '../type/definition';
import type { GraphQLInputType, GraphQLSchema } from '../type/index';

import { typeFromAST } from './typeFromAST';
import { valueFromAST } from './valueFromAST';

/**
 * A GraphQLVariableSignature is required to coerce a variable value.
 *
 * Designed to have comparable interface to GraphQLArgument so that
 * getArgumentValues() can be reused for fragment arguments.
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
