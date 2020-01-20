"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findDeprecatedUsages = findDeprecatedUsages;

var _GraphQLError = require("../error/GraphQLError");

var _visitor = require("../language/visitor");

var _definition = require("../type/definition");

var _TypeInfo = require("./TypeInfo");

/**
 * A validation rule which reports deprecated usages.
 *
 * Returns a list of GraphQLError instances describing each deprecated use.
 */
function findDeprecatedUsages(schema, ast) {
  var errors = [];
  var typeInfo = new _TypeInfo.TypeInfo(schema);
  (0, _visitor.visit)(ast, (0, _TypeInfo.visitWithTypeInfo)(typeInfo, {
    Field: function Field(node) {
      var parentType = typeInfo.getParentType();
      var fieldDef = typeInfo.getFieldDef();

      if (parentType && (fieldDef === null || fieldDef === void 0 ? void 0 : fieldDef.deprecationReason) != null) {
        errors.push(new _GraphQLError.GraphQLError("The field \"".concat(parentType.name, ".").concat(fieldDef.name, "\" is deprecated. ") + fieldDef.deprecationReason, node));
      }
    },
    EnumValue: function EnumValue(node) {
      var type = (0, _definition.getNamedType)(typeInfo.getInputType());
      var enumVal = typeInfo.getEnumValue();

      if (type && (enumVal === null || enumVal === void 0 ? void 0 : enumVal.deprecationReason) != null) {
        errors.push(new _GraphQLError.GraphQLError("The enum value \"".concat(type.name, ".").concat(enumVal.name, "\" is deprecated. ") + enumVal.deprecationReason, node));
      }
    }
  }));
  return errors;
}
