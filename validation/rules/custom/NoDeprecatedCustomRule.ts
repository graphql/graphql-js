import { invariant } from '../../../jsutils/invariant.ts';
import { GraphQLError } from '../../../error/GraphQLError.ts';
import type { ASTVisitor } from '../../../language/visitor.ts';
import { getNamedType, isInputObjectType } from '../../../type/definition.ts';
import type { ValidationContext } from '../../ValidationContext.ts';
/**
 * No deprecated
 *
 * A GraphQL document is only valid if all selected fields and all used enum values have not been
 * deprecated.
 *
 * Note: This rule is optional and is not part of the Validation section of the GraphQL
 * Specification. The main purpose of this rule is detection of deprecated usages and not
 * necessarily to forbid their use when querying a service.
 */

export function NoDeprecatedCustomRule(context: ValidationContext): ASTVisitor {
  return {
    Field(node) {
      const fieldDef = context.getFieldDef();
      const deprecationReason = fieldDef?.deprecationReason;

      if (fieldDef && deprecationReason != null) {
        const parentType = context.getParentType();
        parentType != null || invariant(false);
        context.reportError(
          new GraphQLError(
            `The field ${parentType?.name}.${fieldDef
              ?.name} is deprecated. ${deprecationReason}`,
            node,
          ),
        );
      }
    },

    Argument(node) {
      const argDef = context.getArgument();
      const deprecationReason = argDef?.deprecationReason;

      if (argDef && deprecationReason != null) {
        const directiveDef = context.getDirective();

        if (directiveDef != null) {
          context.reportError(
            new GraphQLError(
              `Directive "@${directiveDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
              node,
            ),
          );
        } else {
          const parentType = context.getParentType();
          const fieldDef = context.getFieldDef();
          (parentType != null && fieldDef != null) || invariant(false);
          context.reportError(
            new GraphQLError(
              `Field "${parentType?.name}.${fieldDef
                ?.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
              node,
            ),
          );
        }
      }
    },

    ObjectField(node) {
      const inputObjectDef = getNamedType(context.getParentInputType());

      if (isInputObjectType(inputObjectDef)) {
        const inputFieldDef = inputObjectDef.getFields()[node.name.value];
        const deprecationReason = inputFieldDef?.deprecationReason;

        if (deprecationReason != null) {
          context.reportError(
            new GraphQLError(
              `The input field ${inputObjectDef.name}.${inputFieldDef.name} is deprecated. ${deprecationReason}`,
              node,
            ),
          );
        }
      }
    },

    EnumValue(node) {
      const enumValueDef = context.getEnumValue();
      const deprecationReason = enumValueDef?.deprecationReason;

      if (enumValueDef && deprecationReason != null) {
        const enumTypeDef = getNamedType(context.getInputType());
        enumTypeDef != null || invariant(false);
        context.reportError(
          new GraphQLError(
            `The enum value "${enumTypeDef?.name}.${enumValueDef
              ?.name}" is deprecated. ${deprecationReason}`,
            node,
          ),
        );
      }
    },
  };
}
