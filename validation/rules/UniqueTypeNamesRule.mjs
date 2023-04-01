import { GraphQLError } from '../../error/GraphQLError.mjs';
/**
 * Unique type names
 *
 * A GraphQL document is only valid if all defined types have unique names.
 */
export function UniqueTypeNamesRule(context) {
  const knownTypeNames = new Map();
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
        new GraphQLError(
          `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`,
          { nodes: node.name },
        ),
      );
      return;
    }
    const knownNameNode = knownTypeNames.get(typeName);
    if (knownNameNode != null) {
      context.reportError(
        new GraphQLError(`There can be only one type named "${typeName}".`, {
          nodes: [knownNameNode, node.name],
        }),
      );
    } else {
      knownTypeNames.set(typeName, node.name);
    }
    return false;
  }
}
