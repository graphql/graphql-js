/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import { Kind } from '../../language/kinds.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/** An anonymous operation must be the only operation in a document.
 * @internal
 */
export const LoneAnonymousOperationASTVisitor: ASTVisitorFn = (context) => {
  let operationCount = 0;
  return {
    Document(node) {
      operationCount = node.definitions.filter(
        (definition) => definition.kind === Kind.OPERATION_DEFINITION,
      ).length;
    },
    OperationDefinition(node) {
      if (node.name == null && operationCount > 1) {
        context.reportError(
          new GraphQLError(
            'This anonymous operation must be the only defined operation.',
            { nodes: node },
          ),
        );
      }
    },
  };
};
