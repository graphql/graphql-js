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
 * Input object types must define one or more input fields.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Objects
 * @category Validation Rules
 
 * @internal
 */
export const InputObjectTypesHaveFieldsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.schema != null && !index.hasDocumentDefinitions) {
      for (const { type, fields } of index.getSchemaValidationElements()
        .inputObjectTypes) {
        if (fields.length === 0) {
          index.reportError(inputObjectFieldSetErrorMessage(type.name), [
            type.astNode,
            ...type.extensionASTNodes,
          ]);
        }
      }
      return;
    }

    for (const typeName of index.getValidationTypeNames()) {
      if (
        index.hasTypeKind(typeName, DocumentTypeKind.INPUT_OBJECT) &&
        !index.hasTypeElements(typeName, TypeElementKind.INPUT_FIELD)
      ) {
        index.reportError(
          inputObjectFieldSetErrorMessage(typeName),
          index.documentIndex.getDocumentTypeNodes(typeName),
        );
      }
    }
  };

function inputObjectFieldSetErrorMessage(typeStr: string): string {
  return `Input Object type ${typeStr} must define one or more fields.`;
}
