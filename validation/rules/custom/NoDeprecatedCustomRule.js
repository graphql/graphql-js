import { GraphQLError } from "../../../error/GraphQLError.js";
import { getNamedType } from "../../../type/definition.js";

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
export function NoDeprecatedCustomRule(context) {
  return {
    Field(node) {
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();

      if (parentType && fieldDef?.deprecationReason != null) {
        context.reportError(new GraphQLError(`The field ${parentType.name}.${fieldDef.name} is deprecated. ` + fieldDef.deprecationReason, node));
      }
    },

    EnumValue(node) {
      const type = getNamedType(context.getInputType());
      const enumValue = context.getEnumValue();

      if (type && enumValue?.deprecationReason != null) {
        context.reportError(new GraphQLError(`The enum value "${type.name}.${enumValue.name}" is deprecated. ` + enumValue.deprecationReason, node));
      }
    }

  };
}
