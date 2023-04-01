import { GraphQLError } from '../../error/GraphQLError.ts';
import type { NameNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import type { ASTValidationContext } from '../ValidationContext.ts';
/**
 * Unique fragment names
 *
 * A GraphQL document is only valid if all defined fragments have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Name-Uniqueness
 */
export function UniqueFragmentNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
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
}
