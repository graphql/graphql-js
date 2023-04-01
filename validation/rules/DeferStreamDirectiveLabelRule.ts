import { GraphQLError } from '../../error/GraphQLError.ts';
import type { DirectiveNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';
import type { ValidationContext } from '../ValidationContext.ts';
/**
 * Defer and stream directive labels are unique
 *
 * A GraphQL document is only valid if defer and stream directives' label argument is static and unique.
 */
export function DeferStreamDirectiveLabelRule(
  context: ValidationContext,
): ASTVisitor {
  const knownLabels = new Map<string, DirectiveNode>();
  return {
    Directive(node) {
      if (
        node.name.value === GraphQLDeferDirective.name ||
        node.name.value === GraphQLStreamDirective.name
      ) {
        const labelArgument = node.arguments?.find(
          (arg) => arg.name.value === 'label',
        );
        const labelValue = labelArgument?.value;
        if (!labelValue) {
          return;
        }
        if (labelValue.kind !== Kind.STRING) {
          context.reportError(
            new GraphQLError(
              `Directive "${node.name.value}"'s label argument must be a static string.`,
              { nodes: node },
            ),
          );
          return;
        }
        const knownLabel = knownLabels.get(labelValue.value);
        if (knownLabel != null) {
          context.reportError(
            new GraphQLError(
              'Defer/Stream directive label argument must be unique.',
              { nodes: [knownLabel, node] },
            ),
          );
        } else {
          knownLabels.set(labelValue.value, node);
        }
      }
    },
  };
}
