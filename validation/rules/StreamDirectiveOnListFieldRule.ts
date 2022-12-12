import { GraphQLError } from '../../error/GraphQLError.ts';
import type { DirectiveNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import { isListType, isWrappingType } from '../../type/definition.ts';
import { GraphQLStreamDirective } from '../../type/directives.ts';
import type { ValidationContext } from '../ValidationContext.ts';
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
            `Stream directive cannot be used on non-list field "${fieldDef.name}" on type "${parentType.name}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
