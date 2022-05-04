import { GraphQLError } from '../../../error/GraphQLError.ts';
import type { FieldNode } from '../../../language/ast.ts';
import type { ASTVisitor } from '../../../language/visitor.ts';
import { getNamedType } from '../../../type/definition.ts';
import { isIntrospectionType } from '../../../type/introspection.ts';
import type { ValidationContext } from '../../ValidationContext.ts';
/**
 * Prohibit introspection queries
 *
 * A GraphQL document is only valid if all fields selected are not fields that
 * return an introspection type.
 *
 * Note: This rule is optional and is not part of the Validation section of the
 * GraphQL Specification. This rule effectively disables introspection, which
 * does not reflect best practices and should only be done if absolutely necessary.
 */
export function NoSchemaIntrospectionCustomRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Field(node: FieldNode) {
      const type = getNamedType(context.getType());
      if (type && isIntrospectionType(type)) {
        context.reportError(
          new GraphQLError(
            `GraphQL introspection has been disabled, but the requested query contained the field "${node.name.value}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
