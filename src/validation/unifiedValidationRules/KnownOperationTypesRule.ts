/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Operations must be supported by the document's root operation types.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Type-Existence
 * @category Validation Rules
 
 * @internal
 */
export const KnownOperationTypesASTVisitor: ASTVisitorFn = (context) => {
  const rootOperationTypes = context.index.getRootOperationTypes();

  return {
    OperationDefinition(node) {
      if (
        rootOperationTypes.size !== 0 &&
        !rootOperationTypes.has(node.operation)
      ) {
        context.reportError(
          new GraphQLError(
            `The ${node.operation} operation is not supported by the schema.`,
            { nodes: node },
          ),
        );
      }
    },
  };
};
