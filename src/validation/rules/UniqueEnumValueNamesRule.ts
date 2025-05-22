import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  NameNode,
} from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import { isEnumType } from '../../type/definition.js';

import type { SDLValidationContext } from '../ValidationContext.js';

/**
 * Unique enum value names
 *
 * A GraphQL enum type is only valid if all its values are uniquely named.
 */
export function UniqueEnumValueNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
  const knownValueNames = new Map<string, Map<string, NameNode>>();

  return {
    EnumTypeDefinition: checkValueUniqueness,
    EnumTypeExtension: checkValueUniqueness,
  };

  function checkValueUniqueness(
    node: EnumTypeDefinitionNode | EnumTypeExtensionNode,
  ) {
    const typeName = node.name.value;

    let valueNames = knownValueNames.get(typeName);
    if (valueNames == null) {
      valueNames = new Map();
      knownValueNames.set(typeName, valueNames);
    }

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
