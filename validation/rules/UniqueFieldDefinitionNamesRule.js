'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueFieldDefinitionNamesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const definition_js_1 = require('../../type/definition.js');
/**
 * Unique field definition names
 *
 * A GraphQL complex type is only valid if all its fields are uniquely named.
 */
function UniqueFieldDefinitionNamesRule(context) {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
  const knownFieldNames = new Map();
  return {
    InputObjectTypeDefinition: checkFieldUniqueness,
    InputObjectTypeExtension: checkFieldUniqueness,
    InterfaceTypeDefinition: checkFieldUniqueness,
    InterfaceTypeExtension: checkFieldUniqueness,
    ObjectTypeDefinition: checkFieldUniqueness,
    ObjectTypeExtension: checkFieldUniqueness,
  };
  function checkFieldUniqueness(node) {
    const typeName = node.name.value;
    let fieldNames = knownFieldNames.get(typeName);
    if (fieldNames == null) {
      fieldNames = new Map();
      knownFieldNames.set(typeName, fieldNames);
    }
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const fieldNodes = node.fields ?? [];
    for (const fieldDef of fieldNodes) {
      const fieldName = fieldDef.name.value;
      if (hasField(existingTypeMap[typeName], fieldName)) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
            { nodes: fieldDef.name },
          ),
        );
        continue;
      }
      const knownFieldName = fieldNames.get(fieldName);
      if (knownFieldName != null) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Field "${typeName}.${fieldName}" can only be defined once.`,
            { nodes: [knownFieldName, fieldDef.name] },
          ),
        );
      } else {
        fieldNames.set(fieldName, fieldDef.name);
      }
    }
    return false;
  }
}
exports.UniqueFieldDefinitionNamesRule = UniqueFieldDefinitionNamesRule;
function hasField(type, fieldName) {
  if (
    (0, definition_js_1.isObjectType)(type) ||
    (0, definition_js_1.isInterfaceType)(type) ||
    (0, definition_js_1.isInputObjectType)(type)
  ) {
    return type.getFields()[fieldName] != null;
  }
  return false;
}
