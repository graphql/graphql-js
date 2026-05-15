/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError';

import type {
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
} from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { isEnumType } from '../../type/definition';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique enum value names
 *
 * A GraphQL enum type is only valid if all its values are uniquely named.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql';
 * import { UniqueEnumValueNamesRule } from 'graphql/validation';
 *
 * const invalidSDL = `
 *   enum Status { ACTIVE ACTIVE } type Query { status: Status }
 * `;
 *
 * UniqueEnumValueNamesRule.name; // => 'UniqueEnumValueNamesRule'
 * buildSchema(invalidSDL); // throws an error
 *
 * const validSDL = `
 *   enum Status { ACTIVE INACTIVE } type Query { status: Status }
 * `;
 *
 * buildSchema(validSDL); // does not throw
 * ```
 */
export function UniqueEnumValueNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
  const knownValueNames = Object.create(null);

  return {
    EnumTypeDefinition: checkValueUniqueness,
    EnumTypeExtension: checkValueUniqueness,
  };

  function checkValueUniqueness(
    node: EnumTypeDefinitionNode | EnumTypeExtensionNode,
  ) {
    const typeName = node.name.value;

    if (!knownValueNames[typeName]) {
      knownValueNames[typeName] = Object.create(null);
    }

    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const valueNodes = node.values ?? [];
    const valueNames = knownValueNames[typeName];

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
      } else if (valueNames[valueName]) {
        context.reportError(
          new GraphQLError(
            `Enum value "${typeName}.${valueName}" can only be defined once.`,
            { nodes: [valueNames[valueName], valueDef.name] },
          ),
        );
      } else {
        valueNames[valueName] = valueDef.name;
      }
    }

    return false;
  }
}
