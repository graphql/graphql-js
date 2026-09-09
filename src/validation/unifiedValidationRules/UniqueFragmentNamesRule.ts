/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { NameNode } from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/** Fragment definitions must have unique names.
 * @internal
 */
export const UniqueFragmentNamesASTVisitor: ASTVisitorFn = (context) => {
  const knownFragmentNames = new Map<string, NameNode>();
  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      const fragmentName = node.name.value;
      const knownFragmentName = knownFragmentNames.get(fragmentName);
      if (knownFragmentName != null) {
        context.reportError(
          new GraphQLError(
            `There can be only one fragment named "${fragmentName}".`,
            { nodes: [knownFragmentName, node.name] },
          ),
        );
      } else {
        knownFragmentNames.set(fragmentName, node.name);
      }
      return false;
    },
  };
};
