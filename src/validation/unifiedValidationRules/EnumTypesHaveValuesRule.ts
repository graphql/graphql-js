/** @category Validation Rules */

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';
import {
  DocumentTypeKind,
  TypeElementKind,
} from '../TypeSystemValidationIndex.ts';

/**
 * Enum types must define one or more values.
 *
 * See https://spec.graphql.org/draft/#sec-Enums
 * @category Validation Rules
 
 * @internal
 */
export const EnumTypesHaveValuesTypeSystemValidation: TypeSystemValidationFn = (
  index: TypeSystemValidationIndex,
): void => {
  if (index.schema != null && !index.hasDocumentDefinitions) {
    for (const { type, values } of index.getSchemaValidationElements()
      .enumTypes) {
      if (values.length === 0) {
        index.reportError(enumValueSetErrorMessage(type.name), [
          type.astNode,
          ...type.extensionASTNodes,
        ]);
      }
    }
    return;
  }

  for (const typeName of index.getValidationTypeNames()) {
    if (
      index.hasTypeKind(typeName, DocumentTypeKind.ENUM) &&
      !index.hasTypeElements(typeName, TypeElementKind.ENUM_VALUE)
    ) {
      index.reportError(
        enumValueSetErrorMessage(typeName),
        index.documentIndex.getDocumentTypeNodes(typeName),
      );
    }
  }
};

function enumValueSetErrorMessage(typeStr: string): string {
  return `Enum type ${typeStr} must define one or more values.`;
}
