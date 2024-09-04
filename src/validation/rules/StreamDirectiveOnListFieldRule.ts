import { GraphQLError } from '../../error/GraphQLError.js';

import type { DirectiveNode } from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import { isListType, isWrappingType } from '../../type/definition.js';
import { GraphQLStreamDirective } from '../../type/directives.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * Stream directives are used on list fields
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
        node.name.value === GraphQLStreamDirective.name &&
        !(
          isListType(fieldDef.type) ||
          (isWrappingType(fieldDef.type) && isListType(fieldDef.type.ofType))
        )
      ) {
        context.reportError(
          new GraphQLError(
            `Directive "@stream" cannot be used on non-list field "${parentType}.${fieldDef.name}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
