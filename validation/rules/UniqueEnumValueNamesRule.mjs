import { GraphQLError } from '../../error/GraphQLError.mjs';
import { isEnumType } from '../../type/definition.mjs';
/**
 * Unique enum value names
 *
 * A GraphQL enum type is only valid if all its values are uniquely named.
 */
export function UniqueEnumValueNamesRule(context) {
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
      if (isEnumType(existingType) && existingType.getValue(valueName)) {
        context.reportError(
          new GraphQLError(
            `Enum value "${typeName}.${valueName}" already exists in the schema. It cannot also be defined in this type extension.`,
            { nodes: valueDef.name },
          ),
        );
        continue;
      }
      const knownValueName = valueNames.get(valueName);
      if (knownValueName != null) {
        context.reportError(
          new GraphQLError(
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
