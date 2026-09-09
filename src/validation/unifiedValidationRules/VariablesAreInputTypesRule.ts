/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import { print } from '../../language/printer.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Variables must be input types.
 *
 * See https://spec.graphql.org/draft/#sec-Variables-Are-Input-Types
 * @category Validation Rules
 
 * @internal
 */
export const VariablesAreInputTypesASTVisitor: ASTVisitorFn = (context) => {
  const indexCursor = context.indexCursor;

  return {
    VariableDefinition(node) {
      if (indexCursor.index.hasNonInputType(node.type)) {
        const variableName = node.variable.name.value;
        const typeName = print(node.type);

        context.reportError(
          new GraphQLError(
            `Variable "$${variableName}" cannot be non-input type "${typeName}".`,
            { nodes: node.type },
          ),
        );
      }
    },
  };
};
