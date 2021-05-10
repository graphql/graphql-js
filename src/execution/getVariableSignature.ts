import { GraphQLError } from '../error/GraphQLError.js';

import type { VariableDefinitionNode } from '../language/ast.js';
import { print } from '../language/printer.js';

import { isInputType } from '../type/definition.js';
import type {
  GraphQLDefaultValueUsage,
  GraphQLInputType,
  GraphQLSchema,
} from '../type/index.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

/**
 * A GraphQLVariableSignature is required to coerce a variable value.
 *
 * Designed to have comparable interface to GraphQLArgument so that
 * getArgumentValues() can be reused for fragment arguments.
 * */
export interface GraphQLVariableSignature {
  name: string;
  type: GraphQLInputType;
  defaultValue: GraphQLDefaultValueUsage | undefined;
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

  const defaultValue = varDefNode.defaultValue;

  return {
    name: varName,
    type: varType,
    defaultValue: defaultValue ? { literal: defaultValue } : undefined,
  };
}
