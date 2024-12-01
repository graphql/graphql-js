import { GraphQLError } from '../../../error/GraphQLError.js';

import type { ASTVisitor } from '../../../language/visitor.js';

import { getNamedType, isInputObjectType } from '../../../type/definition.js';

import type { ValidationContext } from '../../ValidationContext.js';

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
        context.reportError(
          new GraphQLError(
            `The field ${fieldDef} is deprecated. ${deprecationReason}`,
            { nodes: node },
          ),
        );
      }
    },
    Argument(node) {
      const argDef = context.getArgument();
      const deprecationReason = argDef?.deprecationReason;
      if (argDef && deprecationReason != null) {
        context.reportError(
          new GraphQLError(
            `The argument "${argDef}" is deprecated. ${deprecationReason}`,
            { nodes: node },
          ),
        );
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
              `The input field ${inputFieldDef} is deprecated. ${deprecationReason}`,
              { nodes: node },
            ),
          );
        }
      }
    },
    EnumValue(node) {
      const enumValueDef = context.getEnumValue();
      const deprecationReason = enumValueDef?.deprecationReason;
      if (enumValueDef && deprecationReason != null) {
        context.reportError(
          new GraphQLError(
            `The enum value "${enumValueDef}" is deprecated. ${deprecationReason}`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
