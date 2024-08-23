import { GraphQLError } from '../../error/GraphQLError.js';

import type { DirectiveNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.js';

import type { ValidationContext } from '../ValidationContext.js';

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
              `Argument "@${node.name.value}(label:)" must be a static string.`,
              { nodes: node },
            ),
          );
          return;
        }

        const knownLabel = knownLabels.get(labelValue.value);
        if (knownLabel != null) {
          context.reportError(
            new GraphQLError(
              'Value for arguments "defer(label:)" and "stream(label:)" must be unique across all Defer/Stream directive usages.',
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
