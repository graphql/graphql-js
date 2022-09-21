'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueTypeNamesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * Unique type names
 *
 * A GraphQL document is only valid if all defined types have unique names.
 */
function UniqueTypeNamesRule(context) {
  const knownTypeNames = Object.create(null);
  const schema = context.getSchema();
  return {
    ScalarTypeDefinition: checkTypeName,
    ObjectTypeDefinition: checkTypeName,
    InterfaceTypeDefinition: checkTypeName,
    UnionTypeDefinition: checkTypeName,
    EnumTypeDefinition: checkTypeName,
    InputObjectTypeDefinition: checkTypeName,
  };
  function checkTypeName(node) {
    const typeName = node.name.value;
    if (schema?.getType(typeName)) {
      context.reportError(
        new GraphQLError_js_1.GraphQLError(
          `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`,
          { nodes: node.name },
        ),
      );
      return;
    }
    if (knownTypeNames[typeName]) {
      context.reportError(
        new GraphQLError_js_1.GraphQLError(
          `There can be only one type named "${typeName}".`,
          {
            nodes: [knownTypeNames[typeName], node.name],
          },
        ),
      );
    } else {
      knownTypeNames[typeName] = node.name;
    }
    return false;
  }
}
exports.UniqueTypeNamesRule = UniqueTypeNamesRule;
