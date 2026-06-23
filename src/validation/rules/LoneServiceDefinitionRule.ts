import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Lone Service definition
 *
 * A GraphQL document is only valid if it contains at most one service definition.
 */
export function LoneServiceDefinitionRule(
  context: SDLValidationContext,
): ASTVisitor {
  const oldSchema = context.getSchema();
  const alreadyDefined = oldSchema?.getService()?.astNode;

  let serviceDefinitionsCount = 0;
  return {
    ServiceDefinition(node) {
      if (alreadyDefined) {
        context.reportError(
          new GraphQLError(
            'Cannot define a new service within a schema extension.',
            { nodes: node },
          ),
        );
        return;
      }

      if (serviceDefinitionsCount > 0) {
        context.reportError(
          new GraphQLError('Must provide only one service definition.', {
            nodes: node,
          }),
        );
      }
      ++serviceDefinitionsCount;
    },
  };
}
