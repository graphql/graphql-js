import invariant from "../../../jsutils/invariant.mjs";
import { GraphQLError } from "../../../error/GraphQLError.mjs";
import { getNamedType, isInputObjectType } from "../../../type/definition.mjs";

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
    Field: function Field(node) {
      var fieldDef = context.getFieldDef();
      var deprecationReason = fieldDef === null || fieldDef === void 0 ? void 0 : fieldDef.deprecationReason;

      if (fieldDef && deprecationReason != null) {
        var parentType = context.getParentType();
        parentType != null || invariant(0);
        context.reportError(new GraphQLError("The field ".concat(parentType.name, ".").concat(fieldDef.name, " is deprecated. ").concat(deprecationReason), node));
      }
    },
    Argument: function Argument(node) {
      var argDef = context.getArgument();
      var deprecationReason = argDef === null || argDef === void 0 ? void 0 : argDef.deprecationReason;

      if (argDef && deprecationReason != null) {
        var directiveDef = context.getDirective();

        if (directiveDef != null) {
          context.reportError(new GraphQLError("Directive \"@".concat(directiveDef.name, "\" argument \"").concat(argDef.name, "\" is deprecated. ").concat(deprecationReason), node));
        } else {
          var parentType = context.getParentType();
          var fieldDef = context.getFieldDef();
          parentType != null && fieldDef != null || invariant(0);
          context.reportError(new GraphQLError("Field \"".concat(parentType.name, ".").concat(fieldDef.name, "\" argument \"").concat(argDef.name, "\" is deprecated. ").concat(deprecationReason), node));
        }
      }
    },
    ObjectField: function ObjectField(node) {
      var inputObjectDef = getNamedType(context.getParentInputType());

      if (isInputObjectType(inputObjectDef)) {
        var inputFieldDef = inputObjectDef.getFields()[node.name.value]; // flowlint-next-line unnecessary-optional-chain:off

        var deprecationReason = inputFieldDef === null || inputFieldDef === void 0 ? void 0 : inputFieldDef.deprecationReason;

        if (deprecationReason != null) {
          context.reportError(new GraphQLError("The input field ".concat(inputObjectDef.name, ".").concat(inputFieldDef.name, " is deprecated. ").concat(deprecationReason), node));
        }
      }
    },
    EnumValue: function EnumValue(node) {
      var enumValueDef = context.getEnumValue();
      var deprecationReason = enumValueDef === null || enumValueDef === void 0 ? void 0 : enumValueDef.deprecationReason;

      if (enumValueDef && deprecationReason != null) {
        var enumTypeDef = getNamedType(context.getInputType());
        enumTypeDef != null || invariant(0);
        context.reportError(new GraphQLError("The enum value \"".concat(enumTypeDef.name, ".").concat(enumValueDef.name, "\" is deprecated. ").concat(deprecationReason), node));
      }
    }
  };
}
