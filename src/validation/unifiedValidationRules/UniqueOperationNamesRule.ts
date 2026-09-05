/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { NameNode } from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/** Operation definitions must have unique names.
 * @internal
 */
export const UniqueOperationNamesASTVisitor: ASTVisitorFn = (context) => {
  const knownOperationNames = new Map<string, NameNode>();
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName != null) {
        const knownOperationName = knownOperationNames.get(operationName.value);
        if (knownOperationName != null) {
          context.reportError(
            new GraphQLError(
              `There can be only one operation named "${operationName.value}".`,
              { nodes: [knownOperationName, operationName] },
            ),
          );
        } else {
          knownOperationNames.set(operationName.value, operationName);
        }
      }
      return false;
    },
    FragmentDefinition: () => false,
  };
};
