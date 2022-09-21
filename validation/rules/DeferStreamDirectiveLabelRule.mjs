import { GraphQLError } from '../../error/GraphQLError.mjs';
import { Kind } from '../../language/kinds.mjs';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.mjs';
/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if defer and stream directives' label argument is static and unique.
 */
export function DeferStreamDirectiveLabelRule(context) {
  const knownLabels = Object.create(null);
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
        } else if (knownLabels[labelValue.value]) {
          context.reportError(
            new GraphQLError(
              'Defer/Stream directive label argument must be unique.',
              { nodes: [knownLabels[labelValue.value], node] },
            ),
          );
        } else {
          knownLabels[labelValue.value] = node;
        }
      }
    },
  };
}
