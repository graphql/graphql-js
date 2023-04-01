'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueEnumValueNamesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const definition_js_1 = require('../../type/definition.js');
/**
 * Unique enum value names
 *
 * A GraphQL enum type is only valid if all its values are uniquely named.
 */
function UniqueEnumValueNamesRule(context) {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
  const knownValueNames = new Map();
  return {
    EnumTypeDefinition: checkValueUniqueness,
    EnumTypeExtension: checkValueUniqueness,
  };
  function checkValueUniqueness(node) {
    const typeName = node.name.value;
    let valueNames = knownValueNames.get(typeName);
    if (valueNames == null) {
      valueNames = new Map();
      knownValueNames.set(typeName, valueNames);
    }
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const valueNodes = node.values ?? [];
    for (const valueDef of valueNodes) {
      const valueName = valueDef.name.value;
      const existingType = existingTypeMap[typeName];
      if (
        (0, definition_js_1.isEnumType)(existingType) &&
        existingType.getValue(valueName)
      ) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Enum value "${typeName}.${valueName}" already exists in the schema. It cannot also be defined in this type extension.`,
            { nodes: valueDef.name },
          ),
        );
        continue;
      }
      const knownValueName = valueNames.get(valueName);
      if (knownValueName != null) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Enum value "${typeName}.${valueName}" can only be defined once.`,
            { nodes: [knownValueName, valueDef.name] },
          ),
        );
      } else {
        valueNames.set(valueName, valueDef.name);
      }
    }
    return false;
  }
}
exports.UniqueEnumValueNamesRule = UniqueEnumValueNamesRule;
