/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DirectiveNode } from '../../language/ast.ts';
import { DirectiveLocation } from '../../language/directiveLocation.ts';
import { Kind } from '../../language/kinds.ts';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Defer and stream directive labels must be static and unique.
 *
 * See https://spec.graphql.org/draft/#sec-Defer-And-Stream-Directive-Labels-Are-Unique
 * @category Validation Rules
 
 * @internal
 */
export const DeferStreamDirectiveLabelASTVisitor: ASTVisitorFn = (context) => {
  const knownLabels = new Map<string, DirectiveNode>();

  return {
    Directive(node) {
      const location = context.indexCursor.getCurrentDirectiveLocation();
      if (!isExecutableDirectiveLocation(location)) {
        return;
      }

      if (
        node.name.value !== GraphQLDeferDirective.name &&
        node.name.value !== GraphQLStreamDirective.name
      ) {
        return;
      }

      const labelArgument = node.arguments?.find(
        (arg) => arg.name.value === 'label',
      );
      const labelValue = labelArgument?.value;
      if (labelValue == null || labelValue.kind === Kind.NULL) {
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
    },
  };
};

function isExecutableDirectiveLocation(
  location: DirectiveLocation | undefined,
): boolean {
  switch (location) {
    case DirectiveLocation.QUERY:
    case DirectiveLocation.MUTATION:
    case DirectiveLocation.SUBSCRIPTION:
    case DirectiveLocation.FIELD:
    case DirectiveLocation.FRAGMENT_DEFINITION:
    case DirectiveLocation.FRAGMENT_SPREAD:
    case DirectiveLocation.INLINE_FRAGMENT:
    case DirectiveLocation.VARIABLE_DEFINITION:
      return true;
    default:
      return false;
  }
}
