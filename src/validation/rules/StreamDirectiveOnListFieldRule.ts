import { GraphQLError } from '../../error/GraphQLError';

import type { DirectiveNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { isListType } from '../../type/definition';
import { isDirective, GraphQLStreamDirective } from '../../type/directives';

import type { ValidationContext } from '../ValidationContext';

/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
export function StreamDirectiveOnListFieldRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Directive(node: DirectiveNode) {
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();
      if (
        fieldDef &&
        parentType &&
        isDirective(GraphQLStreamDirective) &&
        !isListType(fieldDef.type)
      ) {
        context.reportError(
          new GraphQLError(
            `Stream directive cannot be used on non-list field "${fieldDef.name}" on type "${parentType.name}".`,
            node,
          ),
        );
      }
    },
  };
}
